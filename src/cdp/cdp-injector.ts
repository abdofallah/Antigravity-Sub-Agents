/**
 * CDP Sidebar Injector - Injects sub-agent status into
 * the Antigravity Agent Manager's RIGHT panel.
 *
 * Architecture:
 *   - Phase 1: Create #sa-section shell once (header + items wrapper)
 *   - Phase 2: Clear & repopulate children on data change
 *   - Conversation detection via TanStack Router subscription (event-driven)
 *   - Agent updates via Orchestrator events (event-driven)
 *   - 5s fallback poll for edge cases only
 *
 * Uses pure DOM API (no innerHTML) to satisfy Trusted Types CSP.
 *
 * @module cdp/cdp-injector
 */

import * as vscode from 'vscode';
import { Orchestrator } from '../orchestrator';
import { SubAgentStatus, STATUS_ICONS, MODEL_NAMES, formatElapsed, isActiveStatus } from '../types';
import { CdpTarget, getTargets, loadWs, findBestTarget, setLogger } from './target-manager';
import { buildCSS } from './scripts/css';
import { buildRouterSubscription } from './scripts/build-router-sub';
import { buildPanelScript, PanelInjectionData, AgentUIData } from './scripts/build-panel-script';
import { getHeartbeatInterval, getTargetRescanInterval, getUiPollInterval, getDebugLogging } from '../config/settings';

// --- Configuration ---

const CDP_PORT = 9347;
const P = 'sa';

// --- Output Channel ---

let _outputChannel: vscode.OutputChannel | null = null;

/** Always log — for critical messages (connections, errors, status changes) */
function log(msg: string): void {
    if (!_outputChannel) {
        _outputChannel = vscode.window.createOutputChannel('Sub-Agents CDP');
    }
    const ts = new Date().toISOString().substring(11, 23);
    _outputChannel.appendLine(`[${ts}] ${msg}`);
    console.log(`[SubAgents:CDP] ${msg}`);
}

/** Debug-only log — gated by subagents.debugLogging setting */
function logDebug(msg: string): void {
    if (!getDebugLogging()) return;
    log(msg);
}

// Set logger for target-manager module
setLogger(log);

// --- CDP Injector Class ---

export class CdpSidebarInjector implements vscode.Disposable {
    private _orchestrator: Orchestrator;
    private _ws: any = null;
    private _connected = false;
    private _cdpPort: number | null = null;
    private _targetId: string = '';
    private _targetTitle: string = '';
    private _targetWsUrl: string | null = null;
    private _msgId = 1;
    private _pendingCalls = new Map<number, { resolve: Function; reject: Function; timer: NodeJS.Timeout }>();
    private _heartbeatTimer: NodeJS.Timeout | null = null;
    private _retryTimer: NodeJS.Timeout | null = null;
    private _rescanTimer: NodeJS.Timeout | null = null;
    private _disposed = false;
    private _cssInjected = false;

    // State tracking
    private _lastState: string = '';
    private _lastDataHash: string = '';
    private _eventSub: vscode.Disposable | null = null;
    private _eventDebounceTimer: NodeJS.Timeout | null = null;
    private _routerSubscribed = false;
    private _lastRouterConvoId: string = '';
    private _shellRetryTimer: NodeJS.Timeout | null = null;
    private _shellRetryCount = 0;
    /** Incremented on every route change — stamps timer closures so stale ones self-discard */
    private _routeGeneration = 0;
    /** Set when a fresh injection was requested while one was already inflight */
    private _pendingInjection = false;
    /** High-water mark: active agent count from last successful injection for current route */
    private _lastInjectedActiveCount = 0;
    /** Timestamp of last successful injection with active agents */
    private _lastInjectedAt = 0;
    /**
     * Strictly-monotonic injection sequence number. Stamped into every payload
     * and used by the browser-side panel script to reject out-of-order CDP
     * evaluations (Defense 1). Increments on EVERY _injectSubAgentPanelInner
     * dispatch — never resets, even on route changes, to guarantee uniqueness.
     */
    private _injectSeq = 0;
    private _switching = false;
    private _injecting = false;
    private _parentTitleCache = new Map<string, string>();

    // Inflight guards — prevent async-in-interval overlaps
    private _retryInflight = false;
    private _rescanInflight = false;
    private _heartbeatInflight = false;
    private _refreshTimers: NodeJS.Timeout[] = [];

    constructor(orchestrator: Orchestrator, port?: number) {
        this._orchestrator = orchestrator;
        if (port) this._cdpPort = port;
        // Subscribe to orchestrator events for instant UI updates
        this._eventSub = orchestrator.onEvent(() => this._onAgentEvent());
    }

    /** Whether CDP is currently connected */
    get isConnected(): boolean {
        return this._connected;
    }

    /**
     * Debounced handler for orchestrator events.
     * Triggers an immediate DOM refresh when agent state changes.
     */
    private _onAgentEvent(): void {
        logDebug('Agent event received');
        if (this._eventDebounceTimer) clearTimeout(this._eventDebounceTimer);
        // Cancel any pending retry — fresh data supersedes stale retry
        if (this._shellRetryTimer) { clearTimeout(this._shellRetryTimer); this._shellRetryTimer = null; }
        // Skip injection on non-conversation routes (root '/', '/history', etc.)
        // — there's no sidebar or chatbox to inject into on these pages
        if (!this._lastRouterConvoId) return;
        // Stamp with generation so stale debounce from a previous route self-discards
        const eventGen = this._routeGeneration;
        this._eventDebounceTimer = setTimeout(() => {
            if (this._routeGeneration !== eventGen) return; // Route changed — discard
            this._lastDataHash = ''; // Force rebuild
            this._shellRetryCount = 0; // Reset retries on new data
            if (this._connected) this.injectSubAgentPanel();
        }, 300);
    }

    // ─── Connection ──────────────────────────────────────────────────

    async connect(): Promise<boolean> {
        if (this._connected) return true;
        log('Attempting CDP connection...');

        const ok = await this._tryAllPorts();
        if (ok) return true;

        log('CDP not available yet. Will retry every 10s...');
        this._startRetryLoop();
        return false;
    }

    private _startRetryLoop(): void {
        this._stopRetryLoop();
        this._retryTimer = setInterval(async () => {
            if (this._disposed || this._connected || this._retryInflight) return;
            this._retryInflight = true;
            try {
                const ok = await this._tryAllPorts();
                if (ok) this._stopRetryLoop();
            } finally {
                this._retryInflight = false;
            }
        }, 10000);
    }

    private _stopRetryLoop(): void {
        if (this._retryTimer) { clearInterval(this._retryTimer); this._retryTimer = null; }
    }

    private _startTargetRescan(): void {
        this._stopTargetRescan();
        this._rescanTimer = setInterval(async () => {
            if (this._disposed || !this._connected || this._rescanInflight) return;
            this._rescanInflight = true;
            try {
                const targets = await getTargets(this._cdpPort || CDP_PORT);
                const managerTarget = targets.find((t: CdpTarget) => t.type === 'page' && t.title === 'Manager');
                if (managerTarget && managerTarget.id !== this._targetId && managerTarget.webSocketDebuggerUrl) {
                    log(`Manager target appeared! Switching from "${this._targetTitle}"...`);
                    this._switching = true; // Suppress close handler reconnection
                    this._stopRefreshLoop();
                    this._stopHeartbeat();
                    try { this._ws?.close(); } catch { }
                    this._connected = false;
                    this._cssInjected = false;
                    this._routerSubscribed = false;
                    this._lastState = '';
                    // Small delay to let the old socket fully close
                    await new Promise(r => setTimeout(r, 200));
                    this._switching = false;
                    await this._connectToTarget(managerTarget, this._cdpPort || CDP_PORT);
                }
            } catch { }
            finally {
                this._rescanInflight = false;
            }
        }, getTargetRescanInterval());
    }

    private _stopTargetRescan(): void {
        if (this._rescanTimer) { clearInterval(this._rescanTimer); this._rescanTimer = null; }
    }

    private async _tryAllPorts(): Promise<boolean> {
        const ports = [this._cdpPort || CDP_PORT];
        for (const port of ports) {
            const targets = await getTargets(port);
            if (targets.length === 0) continue;

            log(`Port ${port}: found ${targets.length} targets`);
            targets.forEach((t: CdpTarget) => {
                log(`[${t.type}] "${t.title}" \u2192 ${t.url || '(no url)'}`);
            });

            const target = findBestTarget(targets);
            if (target && target.webSocketDebuggerUrl) {
                log(`Found target: "${target.title}" id=${target.id.substring(0, 8)}`);
                return this._connectToTarget(target, port);
            }
        }
        return false;
    }

    private _connectToTarget(target: CdpTarget, port: number): Promise<boolean> {
        const WebSocket = loadWs();
        if (!WebSocket) {
            log('Cannot connect: ws module not available');
            return Promise.resolve(false);
        }

        const wsUrl = target.webSocketDebuggerUrl!;

        return new Promise((resolve) => {
            try { this._ws?.close(); } catch { }

            this._ws = new WebSocket(wsUrl);
            this._targetId = target.id;
            this._targetTitle = target.title;
            this._targetWsUrl = wsUrl;

            const timeout = setTimeout(() => {
                log('WebSocket connection timeout');
                try { this._ws?.close(); } catch { }
                resolve(false);
            }, 5000);

            this._ws.on('open', async () => {
                clearTimeout(timeout);
                this._connected = true;
                this._cdpPort = port;
                log(`Connected to "${target.title}" on port ${port}`);

                try {
                    await this._cdpCall('Runtime.enable', {});
                    log('Runtime.enable OK');
                } catch (err: any) {
                    log(`Runtime.enable failed: ${err?.message}`);
                }

                // Register CDP binding for router events from the page
                try {
                    await this._cdpCall('Runtime.addBinding', { name: '__saRouterChange' });
                    log('Router binding registered');
                } catch (err: any) {
                    // Binding may already exist from previous connection
                    if (!err?.message?.includes('already exists')) {
                        log(`Router binding failed: ${err?.message}`);
                    }
                }

                // Register CDP binding for cancel actions from the page
                try {
                    await this._cdpCall('Runtime.addBinding', { name: '__saCancelAction' });
                    log('Cancel binding registered');
                } catch (err: any) {
                    if (!err?.message?.includes('already exists')) {
                        log(`Cancel binding failed: ${err?.message}`);
                    }
                }

                // Register CDP binding for approve/reject actions from the page
                try {
                    await this._cdpCall('Runtime.addBinding', { name: '__saActionHandler' });
                    log('Action binding registered');
                } catch (err: any) {
                    if (!err?.message?.includes('already exists')) {
                        log(`Action binding failed: ${err?.message}`);
                    }
                }

                this._startRefreshLoop();
                this._startHeartbeat();
                this._startTargetRescan();
                resolve(true);
            });

            this._ws.on('message', (raw: any) => {
                try {
                    const msg = JSON.parse(raw.toString());

                    // Handle CDP response (id-based)
                    if (msg.id && this._pendingCalls.has(msg.id)) {
                        const { resolve, timer } = this._pendingCalls.get(msg.id)!;
                        clearTimeout(timer);
                        this._pendingCalls.delete(msg.id);
                        resolve(msg);
                    }

                    // Handle Runtime.bindingCalled - router change events from the page
                    if (msg.method === 'Runtime.bindingCalled' && msg.params?.name === '__saRouterChange') {
                        try {
                            const data = JSON.parse(msg.params.payload || '{}');
                            this._onRouterChange(data.convoId || null);
                        } catch { }
                    }

                    // Handle Runtime.bindingCalled - cancel actions from the page
                    if (msg.method === 'Runtime.bindingCalled' && msg.params?.name === '__saCancelAction') {
                        try {
                            const data = JSON.parse(msg.params.payload || '{}');
                            log(`Cancel action: type=${data.type}, id=${data.id || 'n/a'}`);
                            if (data.type === 'agent' && data.id) {
                                this._orchestrator.cancel(data.id);
                            } else if (data.type === 'batch' && data.id) {
                                this._orchestrator.cancelBatch(data.id);
                            } else if (data.type === 'all') {
                                this._orchestrator.cancelAll();
                            } else if (data.type === 'silent') {
                                // Silent cancel — stop all sub-agents without reporting to parent
                                const active = this._orchestrator.getActive();
                                const parentIds = [...new Set(active.map(a => a.parentId))];
                                for (const pid of parentIds) {
                                    this._orchestrator.cancelByParent(pid);
                                }
                            }
                        } catch { }
                    }

                    // Handle Runtime.bindingCalled - approve/reject actions from the page
                    if (msg.method === 'Runtime.bindingCalled' && msg.params?.name === '__saActionHandler') {
                        try {
                            const data = JSON.parse(msg.params.payload || '{}');
                            log(`Action handler: type=${data.type}, id=${data.id || 'n/a'}, msg=${data.message || ''}`);
                            if (data.type === 'approve' && data.id) {
                                this._orchestrator.approveAction(data.id);
                            } else if (data.type === 'respond' && data.id) {
                                this._orchestrator.respondAction(data.id, data.message || undefined);
                            } else if (data.type === 'reject' && data.id) {
                                this._orchestrator.rejectAction(data.id);
                            }
                        } catch { }
                    }
                } catch { }
            });

            this._ws.on('close', () => {
                if (this._switching) return; // Intentional switch — don't reconnect
                if (!this._disposed) {
                    log('WebSocket closed. Reconnecting...');
                    this._connected = false;
                    this._cssInjected = false;
                    this._routerSubscribed = false;
                    this._lastState = '';
                    this._stopTargetRescan();
                    this._startRetryLoop();
                }
            });

            this._ws.on('error', (err: any) => {
                if (!this._disposed) {
                    log(`WebSocket error: ${err?.message}`);
                }
            });
        });
    }

    // ─── CDP Call ─────────────────────────────────────────────────────

    private _cdpCall(method: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this._ws || !this._connected) {
                reject(new Error('Not connected'));
                return;
            }
            const id = this._msgId++;
            const timer = setTimeout(() => {
                this._pendingCalls.delete(id);
                reject(new Error(`CDP call ${method} timed out`));
            }, 5000);
            this._pendingCalls.set(id, { resolve, reject, timer });
            this._ws.send(JSON.stringify({ id, method, params }));
        }).then((msg: any) => msg.result);
    }

    // ─── Router Subscription (Event-Driven Conversation Detection) ────

    /**
     * Subscribe to TanStack Router navigation events in the page.
     * When the user navigates to a different conversation (/c/$cascadeId),
     * the page calls our CDP binding which fires _onRouterChange instantly.
     */
    private async _setupRouterSubscription(): Promise<void> {
        if (this._routerSubscribed || !this._connected) return;

        const script = buildRouterSubscription();

        try {
            const result = await this._cdpCall('Runtime.evaluate', {
                expression: script,
                returnByValue: true,
            });
            const val = result?.result?.value;
            if (val && val.startsWith('subscribed')) {
                this._routerSubscribed = true;
                const convoId = val.split(':')[1];
                this._lastRouterConvoId = convoId === 'none' ? '' : convoId;
                log(`Router subscription active (current convo: ${convoId})`);
            } else if (val === 'already-subscribed') {
                this._routerSubscribed = true;
            } else {
                log(`Router subscription: ${val}`);
            }
        } catch (err: any) {
            log(`Router subscription failed: ${err?.message}`);
        }
    }

    /**
     * Handle a conversation change event from the router.
     * Triggers an immediate panel refresh.
     */
    private _onRouterChange(convoId: string | null): void {
        const id = convoId || '';
        if (id === this._lastRouterConvoId) return;
        log(`ROUTE CHANGED -> convo=${id ? id.substring(0, 8) : 'none'} | lastConvoId=${this._lastRouterConvoId ? this._lastRouterConvoId.substring(0, 8) : 'none'} `);
        this._lastRouterConvoId = id;
        this._lastDataHash = '';
        this._shellRetryCount = 0;
        // Bump generation — any inflight or queued retry closures will see the mismatch
        // and self-discard, so stale results from the previous route can't pollute this one
        this._routeGeneration++;
        this._pendingInjection = false; // Clear any queued work from the previous route
        // Reset high-water mark for the new route
        this._lastInjectedActiveCount = 0;
        this._lastInjectedAt = 0;
        // Kill ALL pending timers from the previous route context.
        // The graduated-retry chain (1.5s/4s/8s) lives in _refreshTimers — those
        // closures would also fire on the new route if not cleared. The generation
        // guard inside the timer callbacks would discard the result, but it's
        // cleaner to cancel the timers outright.
        if (this._shellRetryTimer) { clearTimeout(this._shellRetryTimer); this._shellRetryTimer = null; }
        if (this._eventDebounceTimer) { clearTimeout(this._eventDebounceTimer); this._eventDebounceTimer = null; }
        for (const t of this._refreshTimers) clearTimeout(t);
        this._refreshTimers = [];

        // Non-conversation routes (root '/', '/history', empty) — just clean up, don't inject.
        // There's no sidebar or chatbox on these pages so injection always fails with
        // 'no-scroll-area' / 'missing-inputbox' and enters a futile retry loop.
        if (!id) {
            logDebug('Non-conversation route — skipping injection');
            return;
        }

        if (this._connected) {
            this.injectSubAgentPanel();
        }
    }

    // ─── Main Injection ───────────────────────────────────────────────

    async injectSubAgentPanel(): Promise<void> {
        logDebug('injectSubAgentPanel called');
        if (!this._connected || !this._ws) return;
        if (this._injecting) {
            // A route change or agent event arrived while a CDP call was in flight.
            // Queue one follow-up run so the request is never silently dropped.
            this._pendingInjection = true;
            return;
        }
        this._injecting = true;
        try {
            await this._injectSubAgentPanelInner();
        } finally {
            this._injecting = false;
            // Execute the queued injection immediately after (with fresh data)
            if (this._pendingInjection) {
                this._pendingInjection = false;
                this._lastDataHash = '';
                this.injectSubAgentPanel();
            }
        }
    }

    private async _injectSubAgentPanelInner(): Promise<void> {
        logDebug('_injectSubAgentPanelInner called');
        if (!this._connected || !this._ws) return;

        // Capture generation BEFORE any async work — if a route change occurs
        // while a CDP call is in-flight, the result belongs to a stale route
        // and must be discarded entirely to prevent false-positive retries.
        const callGeneration = this._routeGeneration;

        if (!this._cssInjected) {
            await this._injectCSS();
        }
        if (this._routeGeneration !== callGeneration) return; // Route changed during CSS injection

        if (!this._routerSubscribed) {
            await this._setupRouterSubscription();
        }
        if (this._routeGeneration !== callGeneration) return; // Route changed during router setup

        const agents = this._orchestrator.getAll();
        const VISIBLE_LIMIT = 5;

        // High-water mark guard: if we previously injected active agents for this route
        // but the orchestrator transiently shows 0 (monitor polling oscillation),
        // suppress the injection to prevent UI flicker. Allow through after 2s for
        // genuine completions or if no active convo is tracked.
        if (this._lastRouterConvoId && this._lastInjectedActiveCount > 0) {
            logDebug(`High-water check: activeCount=${this._lastInjectedActiveCount}, elapsed=${Date.now() - this._lastInjectedAt}ms`);
            const activeForRoute = agents.filter(a =>
                isActiveStatus(a.status) && a.parentId === this._lastRouterConvoId
            ).length;
            if (activeForRoute === 0 && (Date.now() - this._lastInjectedAt) < 2000) {
                logDebug(`Suppressed 0-agent injection (high-water=${this._lastInjectedActiveCount}, elapsed=${Date.now() - this._lastInjectedAt}ms)`);
                // Schedule a verification retry after the oscillation settles
                if (!this._shellRetryTimer) {
                    const gen = this._routeGeneration;
                    this._shellRetryTimer = setTimeout(() => {
                        if (this._routeGeneration !== gen) return;
                        this._lastDataHash = '';
                        this.injectSubAgentPanel();
                    }, 500);
                }
                return;
            }
        }

        const agentData: AgentUIData[] = agents.map(agent => ({
            id: agent.id,
            parentId: agent.parentId,
            batchId: agent.batchId,
            label: agent.label,
            task: agent.task.length > 55 ? agent.task.substring(0, 52) + '...' : agent.task,
            fullTask: agent.task,
            status: agent.status,
            statusClass: agent.status === SubAgentStatus.Running ? 'running'
                : agent.status === SubAgentStatus.Completed ? 'completed'
                    : agent.status === SubAgentStatus.Failed ? 'failed'
                        : agent.status === SubAgentStatus.WaitingForAction ? 'waiting'
                            : 'pending',
            icon: STATUS_ICONS[agent.status] || '\u23F3',
            model: MODEL_NAMES[agent.model] || '?',
            elapsed: formatElapsed(agent.createdAt),
            steps: agent.stepCount,
            isActive: isActiveStatus(agent.status),
            completedAt: agent.completedAt || 0,
            createdAt: agent.createdAt,
            pendingAction: agent.pendingAction ? {
                actionType: agent.pendingAction.actionType,
                target: agent.pendingAction.target.length > 40
                    ? agent.pendingAction.target.substring(0, 37) + '...'
                    : agent.pendingAction.target,
            } : null,
        }));

        const dataHash = agentData.map(a => `${a.id}:${a.status}:${a.steps}:${a.isActive}:${a.pendingAction?.target || ''}`).join('|');

        // subAgentIds: all cascade IDs that are sub-agents (for cosmetic tweaks like archive banner)
        const subAgentIds = agents.map(a => a.id);

        // Pending actions map — for cosmetic watcher to render action buttons on archive banner
        const pendingActionsMap: Record<string, { actionType: string; target: string }> = {};
        for (const agent of agents) {
            if (agent.pendingAction) {
                pendingActionsMap[agent.id] = {
                    actionType: agent.pendingAction.actionType,
                    target: agent.pendingAction.target.length > 50
                        ? agent.pendingAction.target.substring(0, 47) + '...'
                        : agent.pendingAction.target,
                };
            }
        }

        // Parent map — subAgentId → parentId (for breadcrumb rewriting)
        const parentMap: Record<string, string> = {};
        for (const agent of agents) {
            parentMap[agent.id] = agent.parentId;
        }

        // Parent titles — fetch from SDK (cached to avoid repeated RPC calls)
        const uniqueParentIds = [...new Set(agents.map(a => a.parentId))];
        for (const pid of uniqueParentIds) {
            if (!this._parentTitleCache.has(pid)) {
                const title = await this._orchestrator.getConversationTitle(pid);
                if (title) {
                    this._parentTitleCache.set(pid, title);
                }
            }
        }
        const parentTitles: Record<string, string> = {};
        for (const pid of uniqueParentIds) {
            parentTitles[pid] = this._parentTitleCache.get(pid) || 'Parent Chat';
        }

        // Defense 3: diagnostic — capture orchestrator snapshot state at the EXACT
        // moment this payload is built. Compare against expected counts in the logs
        // to identify which code path captured a stale snapshot.
        const allIds = agents.map(a => a.id);
        const lastIds = allIds.slice(-3).map(id => id.substring(0, 8)).join(',');
        const activeIds = agents.filter(a => isActiveStatus(a.status))
            .map(a => `${a.id.substring(0, 8)}:${a.status}:${a.parentId.substring(0, 8)}`)
            .join('|');

        // Allocate the next monotonic sequence number. CRUCIALLY done HERE — right
        // before serialization — so the sequence reflects the actual order in
        // which payloads are committed to CDP, not the order of method entry.
        const injectSeq = ++this._injectSeq;

        // Build injection script using modular builder
        const injectionData: PanelInjectionData = {
            prefix: P,
            agents: agentData,
            visibleLimit: VISIBLE_LIMIT,
            dataHash,
            subAgentIds,
            pendingActions: pendingActionsMap,
            parentMap,
            parentTitles,
            uiPollInterval: getUiPollInterval(),
            debugLogging: getDebugLogging(),
            // Stamp the payload with Node's expected route context. The browser
            // script uses this as a strict guard: if the router's resolved
            // cascadeId doesn't match expectedConvoId, the injection aborts
            // WITHOUT mutating the DOM — preventing transient router-state
            // misses (e.g. during the shell-created retry after navigating
            // back from '/' or '/history') from wiping a freshly-rendered panel.
            expectedConvoId: this._lastRouterConvoId,
            routeGeneration: callGeneration,
            // Defense 1: monotonic sequence number. Browser rejects any
            // evaluation with seq < last accepted seq for the same convo.
            dataSequence: injectSeq,
        };
        // Defense 3 diagnostic log — emitted unconditionally (not gated by debug)
        // so we can correlate stale snapshots to their construction point.
        log(`PAYLOAD#${injectSeq} expected=${this._lastRouterConvoId ? this._lastRouterConvoId.substring(0, 8) : 'none'} gen=${callGeneration} | allAgents=${allIds.length} lastIds=[${lastIds}] active=[${activeIds || 'none'}]`);

        const script = buildPanelScript(injectionData);

        try {
            const result = await this._cdpCall('Runtime.evaluate', {
                expression: script,
                returnByValue: true,
            });
            logDebug(`CDP evaluation completed for script: ${result}`);

            // ══ CRITICAL: Discard stale result if route changed during CDP call ══
            // Without this guard, retries scheduled from the stale result would capture
            // the NEW _routeGeneration (already bumped by _onRouterChange), making the
            // generation check in the retry closure useless — the core race condition.
            if (this._routeGeneration !== callGeneration) {
                logDebug(`Discarding stale CDP result (gen ${callGeneration} → ${this._routeGeneration})`);
                return;
            }

            const val = result?.result?.value;

            // Log CDP exceptions that would otherwise be silently swallowed
            if (!val) {
                const exc = result?.exceptionDetails;
                if (exc) {
                    log(`SCRIPT ERROR: ${exc.text || ''} ${exc.exception?.description || JSON.stringify(exc).substring(0, 300)}`);
                }
                return;
            }

            const res = JSON.parse(val);
            const d = res.debug || {};
            const stateKey = `${res.state}|${d.activeConvoId}`;

            // Defense 1/2 diagnostic: log when the browser guards rejected our
            // payload. This tells us EXACTLY when a stale snapshot would have
            // wiped the panel — invaluable for tracking down the underlying race.
            if (res.state === 'guard-skip' && d.guard) {
                log(`GUARD-SKIP#${injectSeq} reason=${d.guard} expected=${this._lastRouterConvoId ? this._lastRouterConvoId.substring(0, 8) : 'none'} browser=${d.activeConvoId} (panel preserved)`);
            }

            // Update high-water mark on successful injection with active agents
            const injectedActive = typeof res.activeCount === 'number' ? res.activeCount : 0;
            if (injectedActive > 0) {
                this._lastInjectedActiveCount = injectedActive;
                this._lastInjectedAt = Date.now();
            }

            // Log meaningful state changes only
            if (stateKey !== this._lastState) {
                logDebug(`State changed to: ${stateKey}, from ${this._lastState}`);
            }

            const convoStr = d.activeConvoId || 'none';
            if (res.state === 'updated') {
                log(`UPDATED#${injectSeq}: ${d.filteredCount}/${d.totalAgentsInStore} agents for convo=${convoStr} (${res.activeCount} active) | agents=[${d.agentIds}]${d.createdShell ? ' [shell created]' : ''}`);
            } else if (res.state === 'empty') {
                log(`EMPTY#${injectSeq}: convo=${convoStr}`);
            } else if (!res.ok) {
                log(`ERROR#${injectSeq}: ${res.reason}`);
            }
            this._lastState = stateKey;

            // Dump trace from browser-side script
            if (d.trace && d.trace.length > 0) {
                for (const t of d.trace) {
                    logDebug(`  ↳ ${t}`);
                }
            }

            // Per-section retry: if any section is incomplete, schedule a retry.
            // Only retry for missing-inputbox when there are active agents that
            // actually need the chatbox dropdown. On sub-agent pages (archived chats),
            // the inputBox is replaced by the archive banner and will never appear —
            // retrying there with 0 active agents is futile and causes an infinite loop.
            const sections = res.sections || {};
            const needsRetry =
                sections.sidebar === 'no-scroll-area' ||
                (sections.chatbox === 'missing-inputbox' && injectedActive > 0);

            // rpMissing = right panel container not found. This can mean:
            //   a) Sidebar is genuinely closed by user (don't retry forever)
            //   b) Page is still loading after navigation (must retry)
            // Allow retries during the initial window (first 20 attempts ≈ 6s)
            // to cover case (b), then stop to avoid wasting cycles on case (a).
            const rpMissing = d.trace?.some((t: string) => t.includes('rp=missing'));
            const RP_MISSING_RETRY_LIMIT_LOGS = 3;

            if (needsRetry && !rpMissing) {
                this._shellRetryCount++;
                if (this._shellRetryCount > RP_MISSING_RETRY_LIMIT_LOGS && this._shellRetryCount % 10 === 0) {
                    logDebug(`Scheduling retry ${this._shellRetryCount} (sidebar=${sections.sidebar}, chatbox=${sections.chatbox}${rpMissing ? ', rp=missing' : ''})`);
                }
                if (this._shellRetryTimer) clearTimeout(this._shellRetryTimer);
                // Stamp with current generation — if route changes before this fires,
                // the mismatch causes it to self-discard rather than inject stale data
                const retryGen = this._routeGeneration;
                this._shellRetryTimer = setTimeout(() => {
                    if (this._routeGeneration !== retryGen) return; // Route changed — discard
                    this._lastState = '';
                    this._lastDataHash = '';
                    this.injectSubAgentPanel();
                }, 300);
            }

            // When the sidebar shell was just created, the data may be stale
            // (the orchestrator event that triggered this injection may have
            // arrived before the DOM was ready). Schedule a follow-up refresh
            // with fresh orchestrator data to ensure correct counts.
            if (d.createdShell) {
                logDebug('Shell just created — scheduling data refresh');
                if (this._shellRetryTimer) clearTimeout(this._shellRetryTimer);
                const shellGen = this._routeGeneration;
                this._shellRetryTimer = setTimeout(() => {
                    if (this._routeGeneration !== shellGen) return; // Route changed — discard
                    this._lastState = '';
                    this._lastDataHash = '';
                    this.injectSubAgentPanel();
                }, 500);
            }

        } catch (err: any) {
            if (!err.message?.includes('timed out')) {
                log(`Injection error: ${err?.message}`);
            }
        }
    }

    // ─── CSS Injection ────────────────────────────────────────────────

    private async _injectCSS(): Promise<void> {
        const css = buildCSS(P);
        const script = `(() => {
            if (document.getElementById('${P}-style')) return 'already-exists';
            var style = document.createElement('style');
            style.id = '${P}-style';
            style.textContent = ${JSON.stringify(css)};
            (document.head || document.documentElement).appendChild(style);
            return 'injected';
        })()`;

        try {
            const result = await this._cdpCall('Runtime.evaluate', {
                expression: script,
                returnByValue: true,
            });
            const val = result?.result?.value;
            log(`CSS: ${val || 'undefined'}`);
            this._cssInjected = (val === 'injected' || val === 'already-exists');
        } catch (err: any) {
            log(`CSS failed: ${err?.message}`);
        }
    }

    // ─── Open DevTools ────────────────────────────────────────────────

    /**
     * Opens NATIVE Electron DevTools for the Manager window.
     * Uses the same IPC channel as Help -> Toggle Developer Tools.
     */
    async openDevTools(): Promise<void> {
        if (!this._connected) {
            vscode.window.showWarningMessage('CDP not connected. Cannot open DevTools.');
            return;
        }

        const script = `(() => {
            try {
                var ipc = window.vscode?.ipcRenderer;
                if (!ipc) return 'no-ipc';
                ipc.send('vscode:toggleDevTools');
                return 'ok';
            } catch(e) {
                return 'error: ' + e.message;
            }
        })()`;

        try {
            const result = await this._cdpCall('Runtime.evaluate', {
                expression: script,
                returnByValue: true,
            });
            const val = result?.result?.value;
            if (val === 'ok') {
                log('Native DevTools toggled for Manager window');
            } else {
                log(`DevTools toggle failed: ${val}`);
                vscode.window.showWarningMessage(`Could not toggle DevTools: ${val}`);
            }
        } catch (err: any) {
            log(`DevTools error: ${err?.message}`);
            vscode.window.showErrorMessage(`Failed to open DevTools: ${err?.message}`);
        }
    }

    // ─── Refresh & Heartbeat ──────────────────────────────────────────

    /** Initial injection + graduated retries on connect. No polling. */
    private _startRefreshLoop(): void {
        this._stopRefreshLoop();
        this._shellRetryCount = 0;
        // Graduated retries: 1.5s, 4s, 8s — stored so _stopRefreshLoop can cancel them
        const delays = [1500, 4000, 8000];
        for (const delay of delays) {
            this._refreshTimers.push(setTimeout(() => {
                if (this._connected) this.injectSubAgentPanel();
            }, delay));
        }
    }

    private _stopRefreshLoop(): void {
        for (const t of this._refreshTimers) clearTimeout(t);
        this._refreshTimers = [];
        if (this._shellRetryTimer) { clearTimeout(this._shellRetryTimer); this._shellRetryTimer = null; }
    }

    private _startHeartbeat(): void {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(async () => {
            if (!this._connected || this._disposed || this._heartbeatInflight) return;
            this._heartbeatInflight = true;
            try {
                await this._cdpCall('Runtime.evaluate', {
                    expression: '1+1',
                    returnByValue: true,
                });
            } catch {
                log('Heartbeat failed - connection lost');
                this._connected = false;
                this._cssInjected = false;
                this._routerSubscribed = false;
                this._lastState = '';
                try { this._ws?.close(); } catch { }
                this._startRetryLoop();
            } finally {
                this._heartbeatInflight = false;
            }
        }, getHeartbeatInterval());
    }

    private _stopHeartbeat(): void {
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    }

    // ─── Public API ───────────────────────────────────────────────────

    get cdpPort(): number | null { return this._cdpPort; }
    get targetTitle(): string { return this._targetTitle; }
    showLogs(): void { _outputChannel?.show(); }

    // ─── Disposal ─────────────────────────────────────────────────────

    dispose(): void {
        this._disposed = true;
        this._stopRetryLoop();
        this._stopRefreshLoop();
        this._stopHeartbeat();
        this._stopTargetRescan();
        if (this._eventSub) { this._eventSub.dispose(); this._eventSub = null; }
        if (this._eventDebounceTimer) { clearTimeout(this._eventDebounceTimer); this._eventDebounceTimer = null; }
        if (this._shellRetryTimer) { clearTimeout(this._shellRetryTimer); this._shellRetryTimer = null; }
        if (this._ws) {
            try { this._ws.close(); } catch { }
            this._ws = null;
        }
        for (const [, { timer }] of this._pendingCalls) clearTimeout(timer);
        this._pendingCalls.clear();
        _outputChannel?.dispose();
        _outputChannel = null;
    }
}
