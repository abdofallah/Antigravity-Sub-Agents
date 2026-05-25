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
 * @module cdp-injector
 */

import * as vscode from 'vscode';
import * as http from 'http';
import { Orchestrator } from './orchestrator';
import { ISubAgent, SubAgentStatus, STATUS_ICONS, MODEL_NAMES, formatElapsed, isActiveStatus } from './types';

// --- Configuration ---

const CDP_PORT = 9347;
const HEARTBEAT_INTERVAL = 10000;
const TARGET_RESCAN_INTERVAL = 5000;
const P = 'sa';

// --- Types ---

interface CdpTarget {
    id: string;
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl?: string;
}

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

// --- CSS ---

function buildCSS(): string {
    return `
    .${P}-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
    .${P}-dot-running { background:#4fc3f7;box-shadow:0 0 4px #4fc3f7;animation:${P}-pulse 1.5s ease-in-out infinite; }
    .${P}-dot-completed { background:#66bb6a; }
    .${P}-dot-failed { background:#ef5350; }
    .${P}-dot-waiting { background:#ffa726;animation:${P}-pulse 2s ease-in-out infinite; }
    .${P}-dot-pending { background:#78909c; }
    .${P}-spinner {
        display:inline-block;width:12px;height:12px;flex-shrink:0;
        border:1.5px solid rgba(128,128,128,0.3);border-top-color:#4fc3f7;
        border-radius:50%;animation:${P}-spin 0.8s linear infinite;
    }
    @keyframes ${P}-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes ${P}-spin { to{transform:rotate(360deg)} }`;
}

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
    private _wsModule: any = undefined;

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

    // --- Connection ---

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
                const targets = await this._getTargets(this._cdpPort || CDP_PORT);
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
            const targets = await this._getTargets(port);
            if (targets.length === 0) continue;

            log(`Port ${port}: found ${targets.length} targets`);
            targets.forEach((t: CdpTarget) => {
                log(`[${t.type}] "${t.title}" \u2192 ${t.url || '(no url)'}`);
            });

            // Prefer Manager window, then first page
            const managerTarget = targets.find((t: CdpTarget) => t.type === 'page' && t.title === 'Manager');
            const pageTarget = targets.find((t: CdpTarget) => t.type === 'page' && t.webSocketDebuggerUrl);
            const target = managerTarget || pageTarget;

            if (target && target.webSocketDebuggerUrl) {
                log(`Found target: "${target.title}" id=${target.id.substring(0, 8)}`);
                return this._connectToTarget(target, port);
            }
        }
        return false;
    }

    private _connectToTarget(target: CdpTarget, port: number): Promise<boolean> {
        const WebSocket = this._loadWs();
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

    // --- CDP Call ---

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

    // --- Router Subscription (Event-Driven Conversation Detection) ---

    /**
     * Subscribe to TanStack Router navigation events in the page.
     * When the user navigates to a different conversation (/c/$cascadeId),
     * the page calls our CDP binding which fires _onRouterChange instantly.
     */
    private async _setupRouterSubscription(): Promise<void> {
        if (this._routerSubscribed || !this._connected) return;

        const script = `(() => {
            try {
                if (window.__saRouterSub) return 'already-subscribed';

                const router = window.__TSR_ROUTER__;
                if (!router || !router.subscribe) return 'no-router';

                function getConvoId() {
                    try {
                        const matches = router.state?.matches || [];
                        for (let i = 0; i < matches.length; i++) {
                            if (matches[i].params && matches[i].params.cascadeId) {
                                return matches[i].params.cascadeId;
                            }
                        }
                    } catch(e) {}
                    return null;
                }

                let lastConvo = getConvoId();

                window.__saRouterSub = router.subscribe('onResolved', function() {
                    const newConvo = getConvoId();
                    if (newConvo !== lastConvo) {
                        lastConvo = newConvo;
                        try {
                            window.__saRouterChange(JSON.stringify({ convoId: newConvo }));
                        } catch(e) {}
                    }
                });

                return 'subscribed:' + (lastConvo || 'none');
            } catch(e) {
                return 'error:' + e.message;
            }
        })()`;

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

    // --- Main Injection ---

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

        const agentData = agents.map(agent => ({
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

        const dataJson = JSON.stringify(agentData);
        const dataHash = agentData.map(a => `${a.id}:${a.status}:${a.steps}:${a.isActive}:${a.pendingAction?.target || ''}`).join('|');

        // - subAgentIds: all cascade IDs that are sub-agents (for cosmetic tweaks like archive banner)
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

        // --- Build injection script ---
        // Phase 1: Ensure #sa-section shell exists (created once)
        // Phase 2: Clear & repopulate children based on active conversation
        // No sidebar visibility checks - section stays in DOM
        const script = `(() => {
            try {
                var P = '${P}';
                var allAgents = ${dataJson};
                var LIMIT = ${VISIBLE_LIMIT};
                var dataHash = '${dataHash}';
                var subAgentIds = ${JSON.stringify(subAgentIds)};
                var pendingActions = ${JSON.stringify(pendingActionsMap)};
                var debug = {};

                if (!window.__saState) window.__saState = {};
                var uiState = window.__saState;

                function el(tag, cls, text) {
                    var e = document.createElement(tag);
                    if (cls) e.className = cls;
                    if (text) e.textContent = text;
                    return e;
                }

                // Detect active conversation via TanStack Router
                var activeConvoId = null;
                try {
                    var router = window.__TSR_ROUTER__;
                    if (router && router.state && router.state.matches) {
                        var matches = router.state.matches;
                        for (var i = 0; i < matches.length; i++) {
                            if (matches[i].params && matches[i].params.cascadeId) {
                                activeConvoId = matches[i].params.cascadeId;
                                break;
                            }
                        }
                    }
                } catch(e) {}
                if (!activeConvoId) {
                    var pill = document.querySelector('[role="button"][class*="bg-list-hover"] span[data-testid^="convo-pill-"]');
                    if (pill) activeConvoId = (pill.getAttribute('data-testid') || '').replace('convo-pill-', '');
                }
                debug.activeConvoId = activeConvoId ? activeConvoId.substring(0, 8) : 'none';

                // Hash check - skip if nothing changed
                var fullHash = dataHash + '|' + (activeConvoId || 'none');
                if (uiState._dataHash === fullHash && document.getElementById(P + '-section')) {
                    return JSON.stringify({ ok: true, state: 'unchanged' });
                }
                uiState._dataHash = fullHash;

                // Filter & sort agents for active conversation
                var agents = activeConvoId ? allAgents.filter(function(a) { return a.parentId === activeConvoId; }) : [];
                agents.sort(function(a, b) {
                    if (a.isActive && !b.isActive) return -1;
                    if (!a.isActive && b.isActive) return 1;
                    return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
                });

                var activeCount = agents.filter(function(a) { return a.isActive; }).length;
                var totalCount = agents.length;
                var hiddenCount = Math.max(0, totalCount - LIMIT);

                // Reset UI state on conversation change
                if (uiState.lastConvoId && uiState.lastConvoId !== activeConvoId) {
                    uiState.collapsed = false;
                    uiState.expanded = false;
                    uiState.dropdownCollapsed = false;
                }
                if (uiState.dropdownCollapsed === undefined) uiState.dropdownCollapsed = false;
                uiState.lastConvoId = activeConvoId;

                debug.filteredCount = totalCount;
                debug.totalAgentsInStore = allAgents.length;

                // Cleanup legacy injection
                var oldRoot = document.getElementById('sa-inject-root');
                if (oldRoot) oldRoot.remove();

                // --- Active agents dropdown above chat input ---
                var inputBox = document.getElementById('antigravity.agentSidePanelInputBox');
                var oldDrop = document.getElementById(P + '-running-dropdown');
                if (oldDrop) oldDrop.remove();

                var activeAgents = agents.filter(function(a) { return a.status === 'running' || a.status === 'waiting_for_action'; });
                var runningAgents = agents.filter(function(a) { return a.status === 'running'; });
                var waitingAgents = agents.filter(function(a) { return a.status === 'waiting_for_action'; });
                var activeCount = activeAgents.length;

                // Cancel helper — calls CDP binding
                function cancelAction(type, id) {
                    try { window.__saCancelAction(JSON.stringify({ type: type, id: id || '' })); } catch(e) { console.warn('Cancel failed', e); }
                }

                // Build stop button helper
                function stopBtn(text, type, id, small) {
                    var b = el('span', '');
                    b.textContent = text || 'Stop';
                    b.style.cssText = 'cursor:pointer;color:#ef4444;font-size:' + (small ? '11' : '12') + 'px;padding:1px 6px;border:1px solid rgba(239,68,68,0.3);border-radius:4px;opacity:0.7;transition:opacity 0.15s;flex-shrink:0;';
                    b.addEventListener('mouseenter', function() { b.style.opacity = '1'; });
                    b.addEventListener('mouseleave', function() { b.style.opacity = '0.7'; });
                    b.addEventListener('click', function(e) { e.stopPropagation(); cancelAction(type, id); });
                    return b;
                }

                // Action handler — calls CDP binding for approve/respond/reject
                function actionHandler(type, id, message) {
                    try { window.__saActionHandler(JSON.stringify({ type: type, id: id, message: message || '' })); } catch(e) { console.warn('Action failed', e); }
                }

                // Build action button helper (approve/deny style)
                function actionBtn(text, type, id, color, bgColor) {
                    var b = el('span', '');
                    b.textContent = text;
                    b.style.cssText = 'cursor:pointer;color:' + color + ';background:' + bgColor + ';font-size:11px;font-weight:500;padding:2px 10px;border-radius:4px;transition:opacity 0.15s,filter 0.15s;flex-shrink:0;user-select:none;';
                    b.addEventListener('mouseenter', function() { b.style.filter = 'brightness(1.2)'; });
                    b.addEventListener('mouseleave', function() { b.style.filter = ''; });
                    b.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (type === 'respond') {
                            var msg = prompt('Tell the agent what to do instead:');
                            if (msg !== null) actionHandler('respond', id, msg);
                        } else {
                            actionHandler(type, id);
                        }
                    });
                    return b;
                }

                if (inputBox && activeCount > 0) {
                    var z30 = null;
                    var ii = inputBox.querySelector('.bg-input');
                    if (ii) z30 = ii.querySelector('.absolute.bottom-full');
                    if (z30) {
                        var dd = el('div', 'flex flex-col gap-1 p-3 rounded-xl mb-1');
                        dd.id = P + '-running-dropdown';
                        var borderColor = waitingAgents.length > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)';
                        dd.style.cssText = 'background:var(--ag-input-background, rgba(30,30,30,0.95));border:1px solid ' + borderColor + ';max-height:300px;overflow-y:auto;';

                        // --- Global header with collapse + summary ---
                        var dh = el('div', 'flex items-center justify-between pb-1');
                        var headerParts = [];
                        if (runningAgents.length > 0) headerParts.push(runningAgents.length + ' running');
                        if (waitingAgents.length > 0) headerParts.push(waitingAgents.length + ' needs action');
                        var headerLeft = el('div', 'flex items-center gap-2');
                        headerLeft.appendChild(el('span', 'text-xs opacity-70', headerParts.join(', ')));

                        var headerRight = el('div', 'flex items-center gap-2');
                        // Stop all button
                        headerRight.appendChild(stopBtn('Stop All', 'all', null, true));
                        // Collapse toggle
                        var dc = el('span', 'google-symbols opacity-50 hover:opacity-80 cursor-pointer', uiState.dropdownCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up');
                        dc.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:14px;user-select:none;';
                        dc.addEventListener('click', function(e) { e.stopPropagation(); uiState.dropdownCollapsed = !uiState.dropdownCollapsed; });
                        headerRight.appendChild(dc);

                        dh.appendChild(headerLeft);
                        dh.appendChild(headerRight);
                        dd.appendChild(dh);

                        if (!uiState.dropdownCollapsed) {
                            // Group agents by batchId
                            var batches = {};
                            var batchOrder = [];
                            activeAgents.forEach(function(a) {
                                if (!batches[a.batchId]) { batches[a.batchId] = []; batchOrder.push(a.batchId); }
                                batches[a.batchId].push(a);
                            });

                            batchOrder.forEach(function(bid) {
                                var bAgents = batches[bid];
                                var isBatch = bAgents.length > 1;

                                if (isBatch) {
                                    // --- Batch group header ---
                                    if (!uiState.batchCollapsed) uiState.batchCollapsed = {};
                                    var bCollapsed = uiState.batchCollapsed[bid] || false;

                                    var bHeader = el('div', 'flex items-center justify-between py-1 cursor-pointer');
                                    bHeader.style.cssText = 'border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:6px;';

                                    var bLeft = el('div', 'flex items-center gap-2');
                                    var bIcon = el('span', 'google-symbols');
                                    bIcon.textContent = bCollapsed ? 'expand_more' : 'expand_less';
                                    bIcon.style.cssText = 'font-size:14px;opacity:0.5;';
                                    bLeft.appendChild(bIcon);

                                    // Batch summary when collapsed
                                    var bRunning = bAgents.filter(function(a) { return a.status === 'running'; }).length;
                                    var bWaiting = bAgents.filter(function(a) { return a.status === 'waiting_for_action'; }).length;
                                    var bParts = [];
                                    if (bRunning) bParts.push(bRunning + ' running');
                                    if (bWaiting) bParts.push(bWaiting + ' action');
                                    bLeft.appendChild(el('span', 'text-xs opacity-60', 'Batch (' + bAgents.length + ' agents' + (bParts.length ? ': ' + bParts.join(', ') : '') + ')'));

                                    var bRight = el('div', 'flex items-center gap-1');
                                    bRight.appendChild(stopBtn('Stop Batch', 'batch', bid, true));

                                    bHeader.appendChild(bLeft);
                                    bHeader.appendChild(bRight);
                                    bHeader.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        if (!uiState.batchCollapsed) uiState.batchCollapsed = {};
                                        uiState.batchCollapsed[bid] = !uiState.batchCollapsed[bid];
                                    });
                                    dd.appendChild(bHeader);

                                    if (!bCollapsed) {
                                        bAgents.forEach(function(a) {
                                            dd.appendChild(buildAgentRow(a, true));
                                        });
                                    }
                                } else {
                                    // Solo agent
                                    dd.appendChild(buildAgentRow(bAgents[0], false));
                                }
                            });
                        }
                        z30.appendChild(dd);
                    }
                }

                // Build an agent row (shared between solo and batch agents)
                function buildAgentRow(a, inBatch) {
                    if (a.status === 'waiting_for_action') {
                        // ── Waiting agent: show label + task desc + Approve/Deny buttons ──
                        var wrapper = el('div', '');
                        wrapper.style.cssText = 'padding:4px 6px;border-radius:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15);margin:2px 0;' + (inBatch ? 'margin-left:16px;' : '');

                        // Top row: icon + label + view link
                        var topRow = el('div', 'flex items-center gap-2');
                        topRow.style.cssText = 'margin-bottom:4px;cursor:pointer;';
                        var bell = el('span', 'google-symbols');
                        bell.textContent = 'notifications';
                        bell.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:13px;color:#fbbf24;animation:' + P + '-pulse 1.5s ease-in-out infinite;';
                        topRow.appendChild(bell);

                        var nameSpan = el('span', 'text-sm truncate flex-1');
                        nameSpan.textContent = a.label;
                        nameSpan.style.cssText = 'color:#fbbf24;font-weight:500;';
                        topRow.appendChild(nameSpan);

                        // View icon (open in chat)
                        var viewIcon = el('span', 'google-symbols');
                        viewIcon.textContent = 'open_in_new';
                        viewIcon.style.cssText = 'display:flex;align-items:center;font-size:12px;opacity:0.5;cursor:pointer;';
                        viewIcon.addEventListener('click', function(e) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        topRow.appendChild(viewIcon);

                        topRow.addEventListener('click', function(e) { if (e.target === viewIcon) return; var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        wrapper.appendChild(topRow);

                        // Task description (from pending action or task)
                        if (a.pendingAction) {
                            var desc = el('div', 'text-xs truncate');
                            desc.style.cssText = 'opacity:0.6;margin-bottom:6px;padding-left:21px;font-family:monospace;';
                            desc.textContent = (a.pendingAction.actionType === 'command' ? 'Run ' : '') + a.pendingAction.target;
                            wrapper.appendChild(desc);
                        }

                        // Action buttons row: Approve + Deny
                        var btnRow = el('div', 'flex items-center gap-2');
                        btnRow.style.cssText = 'padding-left:21px;';
                        btnRow.appendChild(actionBtn('Approve', 'approve', a.id, '#fff', '#2563eb'));
                        btnRow.appendChild(actionBtn('Deny', 'reject', a.id, '#fff', 'rgba(239,68,68,0.8)'));
                        wrapper.appendChild(btnRow);

                        return wrapper;
                    }

                    // ── Running agent: standard row ──
                    var r = el('div', 'flex items-center gap-2 py-0.5 group');
                    r.style.cssText = 'cursor:pointer;opacity:0.8;transition:opacity 0.15s;' + (inBatch ? 'padding-left:20px;' : '');
                    r.addEventListener('mouseenter', function() { r.style.opacity = '1'; r.querySelector('.' + P + '-row-stop').style.display = 'inline'; });
                    r.addEventListener('mouseleave', function() { r.style.opacity = '0.8'; r.querySelector('.' + P + '-row-stop').style.display = 'none'; });

                    r.appendChild(el('span', P + '-spinner'));
                    r.appendChild(el('span', 'text-sm truncate flex-1', a.label));

                    // Per-agent stop button (visible on hover)
                    var agentStop = stopBtn('', 'agent', a.id, true);
                    agentStop.className = P + '-row-stop google-symbols';
                    agentStop.textContent = 'stop_circle';
                    agentStop.style.cssText += 'display:none;border:none;padding:0;font-size:14px;';
                    r.appendChild(agentStop);

                    r.addEventListener('click', function(e) { if (e.target !== agentStop) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); } });
                    return r;
                }

                // --- Notification badge on parent chat in left sidebar ---
                var oldBadges = document.querySelectorAll('.' + P + '-chat-notify');
                oldBadges.forEach(function(b) { b.remove(); });
                if (waitingAgents.length > 0 && activeConvoId) {
                    var pill = document.querySelector('span[data-testid="convo-pill-' + activeConvoId + '"]');
                    if (pill) {
                        var badge = el('span', P + '-chat-notify google-symbols');
                        badge.textContent = 'notifications';
                        badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:#fbbf24;margin-right:4px;animation:' + P + '-pulse 1.5s ease-in-out infinite;flex-shrink:0;';
                        pill.parentNode.insertBefore(badge, pill);
                    }
                }

                // --- Sub-agent chat cosmetic tweaks (persistent watcher) ---
                // Install a persistent watcher that continuously enforces restrictions.
                // This solves the race where React hasn't rendered the DOM yet.
                if (!window.__saLockWatcher) {
                    window.__saLockWatcher = { subAgentIds: [], pendingActions: {} };
                }
                // Update the watcher's data on every injection cycle
                window.__saLockWatcher.subAgentIds = subAgentIds;
                window.__saLockWatcher.pendingActions = pendingActions;

                if (!window.__saLockWatcherInstalled) {
                    window.__saLockWatcherInstalled = true;

                    function enforceLocks() {
                        var w = window.__saLockWatcher;
                        if (!w) return;

                        // Detect active conversation
                        var convoId = null;
                        try {
                            var router = window.__TSR_ROUTER__;
                            if (router && router.state && router.state.matches) {
                                for (var i = 0; i < router.state.matches.length; i++) {
                                    if (router.state.matches[i].params && router.state.matches[i].params.cascadeId) {
                                        convoId = router.state.matches[i].params.cascadeId;
                                        break;
                                    }
                                }
                            }
                        } catch(e) {}
                        if (!convoId) return;

                        var isSub = w.subAgentIds.indexOf(convoId) !== -1;

                        if (isSub) {
                            // Hide revert/undo buttons on sub-agent chats
                            var revertBtns = document.querySelectorAll('[data-testid="revert-button"]');
                            revertBtns.forEach(function(btn) { btn.style.display = 'none'; });

                            var action = w.pendingActions && w.pendingActions[convoId];

                            // Find the archive banner container
                            var bannerContainer = document.querySelector('.relative.flex.items-center.justify-center.gap-2.p-1');
                            if (!bannerContainer) {
                                // Also check for the input box area when chat is unarchived
                                var inputArea = document.getElementById('antigravity.agentSidePanelInputBox');
                                if (inputArea && action) bannerContainer = inputArea;
                            }

                            if (bannerContainer && action && !document.getElementById(P + '-action-bar')) {
                                // ── Pending action: replace the entire banner with action UI ──
                                // Hide original children but keep container
                                var origChildren = bannerContainer.children;
                                for (var ci = 0; ci < origChildren.length; ci++) {
                                    origChildren[ci].style.display = 'none';
                                }

                                var actionBar = document.createElement('div');
                                actionBar.id = P + '-action-bar';
                                actionBar.style.cssText = 'display:flex;flex-direction:column;gap:6px;width:100%;padding:8px 12px;';

                                // Top: icon + description
                                var topLine = document.createElement('div');
                                topLine.style.cssText = 'display:flex;align-items:center;gap:8px;';

                                var lockIcon = document.createElement('span');
                                lockIcon.textContent = String.fromCodePoint(0x1F512);
                                lockIcon.style.cssText = 'font-size:14px;flex-shrink:0;';
                                topLine.appendChild(lockIcon);

                                var descText = document.createElement('span');
                                descText.style.cssText = 'font-size:13px;opacity:0.85;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                                var prefix = action.actionType === 'command' ? 'Allow running ' : 'Allow ';
                                descText.textContent = prefix + action.target + '?';
                                topLine.appendChild(descText);

                                actionBar.appendChild(topLine);

                                // Bottom: action buttons
                                var btnLine = document.createElement('div');
                                btnLine.style.cssText = 'display:flex;align-items:center;gap:8px;padding-left:22px;';

                                function makeActionBtn(text, type, bgColor, textColor) {
                                    var b = document.createElement('button');
                                    b.textContent = text;
                                    b.style.cssText = 'cursor:pointer;border:none;border-radius:4px;padding:3px 14px;font-size:12px;font-weight:500;color:' + textColor + ';background:' + bgColor + ';transition:filter 0.15s;';
                                    b.addEventListener('mouseenter', function() { b.style.filter = 'brightness(1.2)'; });
                                    b.addEventListener('mouseleave', function() { b.style.filter = ''; });
                                    b.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        if (type === 'respond') {
                                            var msg = prompt('Tell the agent what to do instead:');
                                            if (msg !== null) {
                                                try { window.__saActionHandler(JSON.stringify({ type: 'respond', id: convoId, message: msg })); } catch(ex) {}
                                            }
                                        } else {
                                            try { window.__saActionHandler(JSON.stringify({ type: type, id: convoId })); } catch(ex) {}
                                        }
                                    });
                                    return b;
                                }

                                btnLine.appendChild(makeActionBtn('Run', 'approve', '#2563eb', '#fff'));
                                btnLine.appendChild(makeActionBtn('No', 'respond', 'rgba(120,120,120,0.3)', '#ccc'));
                                btnLine.appendChild(makeActionBtn('Reject', 'reject', 'rgba(239,68,68,0.8)', '#fff'));

                                actionBar.appendChild(btnLine);
                                bannerContainer.appendChild(actionBar);

                            } else if (bannerContainer && !action) {
                                // ── No pending action: clean up action bar if it exists ──
                                var existingBar = document.getElementById(P + '-action-bar');
                                if (existingBar) {
                                    existingBar.remove();
                                    // Restore original children
                                    var restoredChildren = bannerContainer.children;
                                    for (var ri = 0; ri < restoredChildren.length; ri++) {
                                        restoredChildren[ri].style.display = '';
                                    }
                                }

                                // Replace "archived" text with view-only label
                                var allSpans = document.querySelectorAll('span.text-sm.opacity-70');
                                allSpans.forEach(function(sp) {
                                    if (sp.textContent && sp.textContent.indexOf('archived') !== -1) {
                                        sp.textContent = String.fromCodePoint(0x1F512) + ' Sub-agent chat ' + String.fromCharCode(0x2014) + ' view only';
                                    }
                                });
                            }
                        }

                        // Clean up any legacy overlays from previous versions
                        var legacyOverlay = document.getElementById(P + '-input-overlay');
                        if (legacyOverlay) legacyOverlay.remove();
                        var legacyBanner = document.getElementById(P + '-lock-banner');
                        if (legacyBanner) legacyBanner.remove();
                    }

                    // Run immediately + on interval
                    enforceLocks();
                    setInterval(enforceLocks, 500);
                }

                // ========================================
                // Phase 1: Ensure section shell exists
                // ========================================
                var section = document.getElementById(P + '-section');
                var itemsList = section ? document.getElementById(P + '-items') : null;
                var badge = section ? document.getElementById(P + '-badge') : null;
                var runBadge = section ? document.getElementById(P + '-run-badge') : null;

                if (!section) {
                    // Find scroll area in right sidebar
                    var allPanels = document.querySelectorAll('[class*="bg-agent-convo-background"]');
                    var rp = null;
                    for (var i = 0; i < allPanels.length; i++) {
                        var c = allPanels[i].className || '';
                        if (c.includes('items-stretch') && !c.includes('sticky')) { rp = allPanels[i]; break; }
                    }
                    if (!rp) {
                        for (var i = 0; i < allPanels.length; i++) {
                            if (allPanels[i].querySelector('[class*="overflow-y-auto"]')) { rp = allPanels[i]; break; }
                        }
                    }
                    var scrollArea = rp ? rp.querySelector('[class*="overflow-y-auto"]') : null;
                    if (!scrollArea) {
                        return JSON.stringify({ ok: true, state: 'no-scroll-area', debug: debug });
                    }

                    // Build shell
                    section = el('div', 'w-full flex flex-col gap-2');
                    section.id = P + '-section';

                    var hdr = el('div', 'flex items-center justify-between gap-1.5 cursor-pointer select-none pl-4 pr-3 group');
                    var hl = el('div', 'flex items-center gap-1.5');
                    hl.appendChild(el('span', 'text-xs opacity-80 group-hover:opacity-100 transition-opacity', 'Sub-Agents'));

                    badge = el('span', 'text-[10px] opacity-80 bg-white/10 rounded-full px-1.5 py-0.5 leading-none', '0');
                    badge.id = P + '-badge';
                    hl.appendChild(badge);

                    runBadge = el('span', 'text-[10px] rounded-full px-1.5 py-0.5 leading-none');
                    runBadge.id = P + '-run-badge';
                    runBadge.style.cssText = 'background:rgba(79,195,247,0.15);color:#4fc3f7;display:none;';
                    hl.appendChild(runBadge);
                    hdr.appendChild(hl);

                    var chev = el('span', 'google-symbols opacity-80 group-hover:opacity-100 transition-opacity', 'keyboard_arrow_down');
                    chev.id = P + '-chevron';
                    chev.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:16px;user-select:none;';
                    hdr.appendChild(chev);

                    var iw = el('div', 'px-2');
                    iw.id = P + '-items-wrapper';
                    itemsList = el('div', 'flex flex-col gap-px');
                    itemsList.id = P + '-items';
                    iw.appendChild(itemsList);

                    hdr.addEventListener('click', function() {
                        uiState.collapsed = !uiState.collapsed;
                        iw.style.display = uiState.collapsed ? 'none' : '';
                        chev.textContent = uiState.collapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
                    });

                    section.appendChild(hdr);
                    section.appendChild(iw);

                    if (scrollArea.firstChild) scrollArea.insertBefore(section, scrollArea.firstChild);
                    else scrollArea.appendChild(section);

                    debug.createdShell = true;
                }

                // ========================================
                // Phase 2: Update children in place
                // ========================================

                // Update badge counts
                if (badge) badge.textContent = '' + totalCount;
                if (runBadge) {
                    if (activeCount > 0) { runBadge.textContent = activeCount + ' running'; runBadge.style.display = ''; }
                    else { runBadge.style.display = 'none'; }
                }

                // Clear existing rows
                if (itemsList) while (itemsList.firstChild) itemsList.removeChild(itemsList.firstChild);

                // Populate with current agents
                if (itemsList && totalCount > 0) {
                    agents.forEach(function(a, idx) {
                        var row = el('div', 'flex w-full items-center gap-2 px-2 py-1 rounded-md opacity-90 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer');
                        row.title = a.fullTask;
                        if (idx >= LIMIT && !uiState.expanded) row.style.display = 'none';
                        row.setAttribute('data-sa-row', '' + idx);

                        if (a.isActive) row.appendChild(el('span', P + '-spinner'));
                        else row.appendChild(el('span', P + '-dot ' + P + '-dot-' + a.statusClass));

                        var info = el('div', 'flex flex-col min-w-0 flex-1');
                        info.appendChild(el('div', 'text-sm truncate', a.label));
                        info.appendChild(el('div', 'text-xs opacity-50 truncate', a.task));
                        row.appendChild(info);

                        var ri = el('div', 'flex flex-col items-end gap-0.5 shrink-0');
                        ri.appendChild(el('span', 'text-[10px] opacity-60 bg-white/5 rounded px-1 py-0.5', a.model));
                        ri.appendChild(el('span', 'text-[10px] opacity-40', a.isActive && a.steps > 0 ? a.steps + ' steps' : a.elapsed));
                        row.appendChild(ri);

                        row.addEventListener('click', function(e) { e.stopPropagation(); var rt = window.__TSR_ROUTER__; if (rt && rt.navigate) rt.navigate({ to: '/c/' + a.id }); });
                        itemsList.appendChild(row);
                    });

                    // "See all" footer
                    if (hiddenCount > 0) {
                        var seeAll = el('button', 'text-xs opacity-60 hover:opacity-80 cursor-pointer select-none pl-4 pr-3 text-left transition-opacity',
                            uiState.expanded ? 'Show less' : 'See all (' + totalCount + ')');
                        seeAll.addEventListener('click', function(e) {
                            e.stopPropagation();
                            uiState.expanded = !uiState.expanded;
                            var rows = itemsList.querySelectorAll('[data-sa-row]');
                            if (uiState.expanded) { rows.forEach(function(r) { r.style.display = ''; }); seeAll.textContent = 'Show less'; }
                            else { rows.forEach(function(r) { if (parseInt(r.getAttribute('data-sa-row')) >= LIMIT) r.style.display = 'none'; }); seeAll.textContent = 'See all (' + totalCount + ')'; }
                        });
                        itemsList.appendChild(seeAll);
                    }
                }

                // Restore collapse state for items wrapper
                var wr = document.getElementById(P + '-items-wrapper');
                var cv = document.getElementById(P + '-chevron');
                if (wr && uiState.collapsed) { wr.style.display = 'none'; if (cv) cv.textContent = 'keyboard_arrow_right'; }

                debug.agentIds = agents.map(function(a) { return a.id.substring(0, 8); }).join(',');

                return JSON.stringify({ ok: true, state: totalCount > 0 ? 'updated' : 'empty', count: totalCount, activeCount: activeCount, debug: debug });
            } catch (e) {
                return JSON.stringify({ ok: false, reason: e.message, stack: e.stack ? e.stack.substring(0, 300) : '' });
            }
        })()`;

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

    // --- CSS Injection ---

    private async _injectCSS(): Promise<void> {
        const css = buildCSS();
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

    // --- Open DevTools ---

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

    // --- Refresh & Heartbeat ---

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

    // --- HTTP Target Discovery ---

    private _getTargets(port: number): Promise<CdpTarget[]> {
        return new Promise((resolve) => {
            const req = http.get(
                { hostname: '127.0.0.1', port, path: '/json', timeout: 3000 },
                (res) => {
                    let data = '';
                    res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch { resolve([]); }
                    });
                },
            );
            req.on('error', () => resolve([]));
            req.on('timeout', () => { req.destroy(); resolve([]); });
        });
    }

    // --- WebSocket Module ---

    private _loadWs(): any {
        if (this._wsModule !== undefined) return this._wsModule;

        const pathMod = require('path');
        const exeDir = pathMod.dirname(process.execPath);
        const agWsPath = pathMod.join(exeDir, 'resources', 'app', 'node_modules', 'ws');
        const paths = ['ws', agWsPath];
        log(`ws search: execPath=${process.execPath}, wsPath=${agWsPath}`);

        for (const p of paths) {
            try {
                const mod = require(p);
                log(`ws module loaded from: ${p}`);
                this._wsModule = mod;
                return mod;
            } catch { /* next */ }
        }

        log(`ws NOT found. Tried: ${paths.join(', ')}`);
        this._wsModule = null;
        return null;
    }

    // --- Public API ---

    get cdpPort(): number | null { return this._cdpPort; }
    get targetTitle(): string { return this._targetTitle; }
    showLogs(): void { _outputChannel?.show(); }

    // --- Disposal ---

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
