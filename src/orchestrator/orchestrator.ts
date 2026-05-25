/**
 * Sub-Agent Orchestrator — The Brain
 *
 * Manages the full lifecycle of sub-agents:
 * - Creates headless cascades via LSBridge
 * - Tags and titles them for organization
 * - Tracks status in a live in-memory store
 * - Emits events that drive ALL UI updates (TreeView, StatusBar, Notifications)
 * - Persists sub-agent metadata to extension globalState
 *
 * Architecture: Event-driven — every state change fires an ISubAgentEvent
 * that all consumers (TreeView, StatusBar, Notifications) react to simultaneously.
 *
 * Heavy operations are delegated to focused helper modules:
 * - launcher.ts — workspace discovery + cascade creation
 * - monitor.ts — realtime polling + stale detection
 * - messaging.ts — send_message buffering + batch delivery
 * - actions.ts — cancel, approve, respond, reject, viewChat
 *
 * @module orchestrator/orchestrator
 */

import * as vscode from 'vscode';
import { AntigravitySDK, Models, ModelId } from 'antigravity-sdk';
import {
    ISubAgent,
    ISubAgentBatch,
    ILaunchConfig,
    IQuickLaunchConfig,
    ISubAgentEvent,
    IMessageBuffer,
    SubAgentStatus,
    isActiveStatus,
    isTerminalStatus,
} from '../types';

import { LaunchContext, launchBatch } from './launcher';
import { MonitorContext, MonitorState, createMonitorState, pollProgress } from './monitor';
import { MessagingContext, sendMessage as msgSendMessage, checkBatchDelivery as msgCheckBatchDelivery, storeTrajectoryResult as msgStoreTrajectoryResult } from './messaging';
import { ActionContext, cancel as actCancel, cancelAll as actCancelAll, cancelBatch as actCancelBatch, cancelByParent as actCancelByParent, viewChat as actViewChat, approveAction as actApproveAction, respondAction as actRespondAction, rejectAction as actRejectAction, clearHistory as actClearHistory } from './actions';

// ─── Orchestrator ───────────────────────────────────────────────────────

export class Orchestrator implements vscode.Disposable {
    private readonly _disposables: vscode.Disposable[] = [];

    /** Live sub-agent store — cascadeId → ISubAgent */
    private readonly _agents = new Map<string, ISubAgent>();
    /** Batch registry — batchId → ISubAgentBatch */
    private readonly _batches = new Map<string, ISubAgentBatch>();
    /** Message buffers — batchId → IMessageBuffer */
    private readonly _messageBuffers = new Map<string, IMessageBuffer>();
    /** Tracks batches that have already been delivered (prevent duplicates) */
    private readonly _deliveredBatches = new Set<string>();

    /** Event emitter for sub-agent state changes */
    private readonly _onEvent = new vscode.EventEmitter<ISubAgentEvent>();
    /** Fires on every sub-agent state change — subscribe from TreeView, StatusBar, etc. */
    public readonly onEvent = this._onEvent.event;

    /** Polling timer for realtime monitoring */
    private _pollTimer: ReturnType<typeof setInterval> | null = null;
    /** Monitor internal tracking state */
    private _monitorState: MonitorState = createMonitorState();
    /** Visible output channel for orchestrator diagnostics */
    private readonly _out: vscode.OutputChannel;

    constructor(
        private readonly _sdk: AntigravitySDK,
        private readonly _context: vscode.ExtensionContext,
    ) {
        this._out = vscode.window.createOutputChannel('Sub-Agents Orchestrator');
        this._disposables.push(this._onEvent, this._out);
        this._restoreState();
    }

    // ─── Queries ────────────────────────────────────────────────────────

    /** Get all sub-agents (active + historical) */
    getAll(): ISubAgent[] {
        return Array.from(this._agents.values());
    }

    /** Get active sub-agents only */
    getActive(): ISubAgent[] {
        return this.getAll().filter(a => isActiveStatus(a.status));
    }

    /** Get completed/historical sub-agents */
    getHistory(): ISubAgent[] {
        return this.getAll().filter(a => isTerminalStatus(a.status));
    }

    /** Get a specific sub-agent by cascade ID */
    get(id: string): ISubAgent | undefined {
        return this._agents.get(id);
    }

    /** Get a batch by ID */
    getBatch(batchId: string): ISubAgentBatch | undefined {
        return this._batches.get(batchId);
    }

    /** Get all sub-agents belonging to a specific batch */
    getByBatch(batchId: string): ISubAgent[] {
        return this.getAll().filter(a => a.batchId === batchId);
    }

    /** Get all batches */
    getBatches(): ISubAgentBatch[] {
        return Array.from(this._batches.values());
    }

    /** Get sub-agents belonging to a batch (by batch record) */
    getBatchAgents(batchId: string): ISubAgent[] {
        const batch = this._batches.get(batchId);
        if (!batch) return [];
        return batch.agentIds.map(id => this._agents.get(id)).filter(Boolean) as ISubAgent[];
    }

    /** Count of currently active sub-agents */
    get activeCount(): number {
        return this.getActive().length;
    }

    /** Count of sub-agents waiting for action */
    get actionRequiredCount(): number {
        return this.getAll().filter(a => a.status === SubAgentStatus.WaitingForAction).length;
    }

    // ─── Launch ─────────────────────────────────────────────────────────

    /**
     * Launch a batch of sub-agents.
     */
    async launch(config: ILaunchConfig): Promise<{ batchId: string; ids: string[] }> {
        const ctx: LaunchContext = {
            sdk: this._sdk,
            context: this._context,
            agents: this._agents,
            batches: this._batches,
            out: this._out,
            fire: (agent, type, prev) => this._fire(agent, type, prev),
            persistState: () => this._persistState(),
            ensureMonitoring: () => this._ensureMonitoring(),
        };
        return launchBatch(ctx, config);
    }

    /**
     * Quick-launch a single sub-agent.
     */
    async quickLaunch(config: IQuickLaunchConfig): Promise<string | null> {
        const result = await this.launch({
            tasks: [config.task],
            model: config.model,
            parentId: config.parentId,
            description: `Quick: ${config.task.substring(0, 50)}...`,
        });
        return result.ids[0] || null;
    }

    // ─── Control ────────────────────────────────────────────────────────

    async cancel(id: string): Promise<void> {
        return actCancel(this._actionCtx(), id);
    }

    async cancelByParent(parentId: string): Promise<void> {
        return actCancelByParent(this._actionCtx(), parentId);
    }

    async cancelAll(): Promise<void> {
        return actCancelAll(this._actionCtx());
    }

    async cancelBatch(batchId: string): Promise<void> {
        return actCancelBatch(this._actionCtx(), batchId);
    }

    async viewChat(id: string): Promise<void> {
        return actViewChat(this._actionCtx(), id);
    }

    async approveAction(id: string): Promise<void> {
        return actApproveAction(this._actionCtx(), id);
    }

    async respondAction(id: string, message?: string): Promise<void> {
        return actRespondAction(this._actionCtx(), id, message);
    }

    async rejectAction(id: string): Promise<void> {
        return actRejectAction(this._actionCtx(), id);
    }

    clearHistory(): void {
        actClearHistory(this._actionCtx());
    }

    // ─── Messaging ──────────────────────────────────────────────────────

    async sendMessage(agentId: string, parentId: string, message: string): Promise<{ buffered: boolean; delivered: boolean }> {
        return msgSendMessage(this._messagingCtx(), agentId, parentId, message);
    }

    // ─── Realtime Monitoring ────────────────────────────────────────────

    private _ensureMonitoring(): void {
        if (this._pollTimer) return;
        if (this.activeCount === 0) return;

        this._pollTimer = setInterval(() => this._pollProgress(), 3000);
        this._disposables.push({ dispose: () => this._stopMonitoring() });
    }

    private _stopMonitoring(): void {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    }

    private async _pollProgress(): Promise<void> {
        const ctx: MonitorContext = {
            sdk: this._sdk,
            agents: this._agents,
            out: this._out,
            fire: (agent, type, prev) => this._fire(agent, type, prev),
            persistState: () => this._persistState(),
            checkBatchDelivery: (batchId) => this._checkBatchDelivery(batchId),
            storeTrajectoryResult: (agent) => this._storeTrajectoryResult(agent),
        };

        const keepGoing = await pollProgress(ctx, this._monitorState);
        if (!keepGoing) {
            this._stopMonitoring();
        }
    }

    // ─── Query Helpers (for monitoring/messaging/action contexts) ─────

    /** Check if a given cascade ID belongs to a sub-agent we manage. */
    isSubAgent(cascadeId: string): boolean {
        return this._agents.has(cascadeId);
    }

    /** Check if a given cascade ID is a parent that has active sub-agents. */
    hasActiveSubAgents(parentId: string): boolean {
        return this.getAll().some(a => a.parentId === parentId && isActiveStatus(a.status));
    }

    // ─── Event Firing ───────────────────────────────────────────────────

    private _fire(agent: ISubAgent, type: ISubAgentEvent['type'], previousStatus?: SubAgentStatus): void {
        this._onEvent.fire({ agent, type, previousStatus });

        // On completion (by monitoring), check if batch delivery should trigger.
        if (type === 'completed') {
            if (!agent.hasSentMessage) {
                this._storeTrajectoryResult(agent).catch(e =>
                    this._out.appendLine(`[REPORT] Error storing trajectory result: ${e?.message}`));
            }
            this._checkBatchDelivery(agent.batchId);
        }
    }

    // ─── Context Builders ───────────────────────────────────────────────

    private _actionCtx(): ActionContext {
        return {
            sdk: this._sdk,
            agents: this._agents,
            out: this._out,
            fire: (agent, type, prev) => this._fire(agent, type, prev),
            persistState: () => this._persistState(),
            getAll: () => this.getAll(),
            getActive: () => this.getActive(),
            getByBatch: (batchId) => this.getByBatch(batchId),
            checkBatchDelivery: (batchId) => this._checkBatchDelivery(batchId),
        };
    }

    private _messagingCtx(): MessagingContext {
        return {
            sdk: this._sdk,
            agents: this._agents,
            batches: this._batches,
            messageBuffers: this._messageBuffers,
            deliveredBatches: this._deliveredBatches,
            out: this._out,
            persistState: () => this._persistState(),
            getByBatch: (batchId) => this.getByBatch(batchId),
        };
    }

    // ─── Batch Delivery ─────────────────────────────────────────────────

    private async _checkBatchDelivery(batchId: string): Promise<boolean> {
        return msgCheckBatchDelivery(this._messagingCtx(), batchId);
    }

    private async _storeTrajectoryResult(agent: ISubAgent): Promise<void> {
        return msgStoreTrajectoryResult(this._messagingCtx(), agent);
    }

    // ─── Persistence ────────────────────────────────────────────────────

    private _persistState(): void {
        const agents = Array.from(this._agents.values());
        const batches = Array.from(this._batches.values());
        this._context.globalState.update('subagents.agents', agents);
        this._context.globalState.update('subagents.batches', batches);
    }

    private _restoreState(): void {
        const agents = this._context.globalState.get<ISubAgent[]>('subagents.agents', []);
        const batches = this._context.globalState.get<ISubAgentBatch[]>('subagents.batches', []);

        for (const a of agents) {
            // Mark previously-running agents as failed on restart
            if (isActiveStatus(a.status)) {
                a.status = SubAgentStatus.Failed;
                a.error = 'Extension restarted — lost tracking';
                a.completedAt = Date.now();
            }
            this._agents.set(a.id, a);
        }

        for (const b of batches) {
            this._batches.set(b.id, b);
        }
    }

    // ─── Disposal ───────────────────────────────────────────────────────

    dispose(): void {
        this._stopMonitoring();
        this._persistState();
        for (const d of this._disposables) d.dispose();
    }
}
