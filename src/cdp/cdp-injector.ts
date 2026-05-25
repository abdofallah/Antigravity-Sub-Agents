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

// --- Configuration ---

const CDP_PORT = 9347;
const HEARTBEAT_INTERVAL = 10000;
const TARGET_RESCAN_INTERVAL = 5000;
const P = 'sa';

// --- Output Channel ---

let _outputChannel: vscode.OutputChannel | null = null;

function log(msg: string): void {
    if (!_outputChannel) {
        _outputChannel = vscode.window.createOutputChannel('Sub-Agents CDP');
    }
    const ts = new Date().toISOString().substring(11, 23);
    _outputChannel.appendLine(`[${ts}] ${msg}`);
    console.log(`[SubAgents:CDP] ${msg}`);
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
    private _switching = false;

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
        if (this._eventDebounceTimer) clearTimeout(this._eventDebounceTimer);
        this._eventDebounceTimer = setTimeout(() => {
            this._lastDataHash = ''; // Force rebuild
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
            if (this._disposed || this._connected) return;
            const ok = await this._tryAllPorts();
            if (ok) {
                this._stopRetryLoop();
            }
        }, 10000);
    }

    private _stopRetryLoop(): void {
        if (this._retryTimer) { clearInterval(this._retryTimer); this._retryTimer = null; }
    }

    private _startTargetRescan(): void {
        this._stopTargetRescan();
        this._rescanTimer = setInterval(async () => {
            if (this._disposed || !this._connected) return;
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
        }, TARGET_RESCAN_INTERVAL);
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
        this._lastRouterConvoId = id;
        log(`ROUTE CHANGED -> convo=${id ? id.substring(0, 8) : 'none'}`);
        this._lastDataHash = '';
        if (this._connected) {
            this.injectSubAgentPanel();
        }
    }

    // ─── Main Injection ───────────────────────────────────────────────

    async injectSubAgentPanel(): Promise<void> {
        if (!this._connected || !this._ws) return;

        if (!this._cssInjected) {
            await this._injectCSS();
        }

        if (!this._routerSubscribed) {
            await this._setupRouterSubscription();
        }

        const agents = this._orchestrator.getAll();
        const VISIBLE_LIMIT = 5;

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

        // Build injection script using modular builder
        const injectionData: PanelInjectionData = {
            prefix: P,
            agents: agentData,
            visibleLimit: VISIBLE_LIMIT,
            dataHash,
            subAgentIds,
            pendingActions: pendingActionsMap,
        };

        const script = buildPanelScript(injectionData);

        try {
            const result = await this._cdpCall('Runtime.evaluate', {
                expression: script,
                returnByValue: true,
            });

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

            // Log meaningful state changes only
            if (stateKey !== this._lastState) {
                const convoStr = d.activeConvoId || 'none';
                if (res.state === 'updated') {
                    log(`UPDATED: ${d.filteredCount}/${d.totalAgentsInStore} agents for convo=${convoStr} (${res.activeCount} active) | agents=[${d.agentIds}]${d.createdShell ? ' [shell created]' : ''}`);
                } else if (res.state === 'empty') {
                    log(`EMPTY: convo=${convoStr}`);
                } else if (res.state === 'no-scroll-area') {
                    log(`No scroll area found yet (retry ${this._shellRetryCount}/10)`);
                    // Schedule retry — sidebar may not have rendered yet
                    if (this._shellRetryCount < 10) {
                        this._shellRetryCount++;
                        if (this._shellRetryTimer) clearTimeout(this._shellRetryTimer);
                        this._shellRetryTimer = setTimeout(() => {
                            this._lastState = ''; // Force log on next attempt
                            this._lastDataHash = '';
                            this.injectSubAgentPanel();
                        }, 2000);
                    }
                } else if (!res.ok) {
                    log(`ERROR: ${res.reason}`);
                }
                this._lastState = stateKey;
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
        // Graduated retries: 1.5s, 4s, 8s
        const delays = [1500, 4000, 8000];
        delays.forEach(delay => {
            setTimeout(() => {
                if (this._connected) this.injectSubAgentPanel();
            }, delay);
        });
    }

    private _stopRefreshLoop(): void {
        if (this._shellRetryTimer) { clearTimeout(this._shellRetryTimer); this._shellRetryTimer = null; }
    }

    private _startHeartbeat(): void {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(async () => {
            if (!this._connected || this._disposed) return;
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
            }
        }, HEARTBEAT_INTERVAL);
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
