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
    LOST_TRACKING_ERROR,
    IDE_CANCELLED_ERROR,
} from '../types';

import { LaunchContext, launchBatch } from './launcher';
import { MonitorContext, MonitorState, createMonitorState, pollProgress } from './monitor';
import { MessagingContext, sendMessage as msgSendMessage, checkBatchDelivery as msgCheckBatchDelivery, storeTrajectoryResult as msgStoreTrajectoryResult } from './messaging';
import { ActionContext, cancel as actCancel, cancelAll as actCancelAll, cancelBatch as actCancelBatch, cancelByParent as actCancelByParent, viewChat as actViewChat, approveAction as actApproveAction, respondAction as actRespondAction, rejectAction as actRejectAction, clearHistory as actClearHistory } from './actions';
import { getProgressPollInterval } from '../config/settings';

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
    /** Tracks simulated agent/batch IDs (dev only, never persisted) */
    private readonly _simulatedIds = new Set<string>();

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

        this._pollTimer = setInterval(() => this._pollProgress(), getProgressPollInterval());
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
        // Never persist simulated agents (ephemeral dev-only fakes)
        const agents = Array.from(this._agents.values()).filter(a => !this._simulatedIds.has(a.id));
        const batches = Array.from(this._batches.values()).filter(b => !this._simulatedIds.has(b.id));
        this._context.globalState.update('subagents.agents', agents);
        this._context.globalState.update('subagents.batches', batches);
    }

    private _restoreState(): void {
        const agents = this._context.globalState.get<ISubAgent[]>('subagents.agents', []);
        const batches = this._context.globalState.get<ISubAgentBatch[]>('subagents.batches', []);

        for (const a of agents) {
            // Previously-active agents are tentatively marked Failed with the lost-tracking
            // sentinel. The recoverLostAgents() pass run by extension.ts on activation will
            // poll the Language Server and revive any cascades that are still alive.
            if (isActiveStatus(a.status)) {
                a.status = SubAgentStatus.Failed;
                a.error = LOST_TRACKING_ERROR;
                a.completedAt = Date.now();
            }
            this._agents.set(a.id, a);
        }

        for (const b of batches) {
            this._batches.set(b.id, b);
        }
    }

    // ─── Restart Recovery ────────────────────────────────────────

    /**
     * Recover sub-agents whose tracking was lost due to an extension or IDE restart.
     *
     * For every persisted agent marked Failed with the LOST_TRACKING_ERROR sentinel,
     * we query the Language Server's listCascades RPC to see if the underlying cascade
     * is still alive. If so, we restore the appropriate live status
     * (Running / WaitingForAction / Completed) and re-arm monitoring.
     *
     * This is called once from extension.ts after the SDK & LS Bridge are ready.
     */
    async recoverLostAgents(): Promise<{ checked: number; recovered: number }> {
        const lost = this.getAll().filter(
            a => a.status === SubAgentStatus.Failed && a.error === LOST_TRACKING_ERROR
        );

        if (lost.length === 0) {
            return { checked: 0, recovered: 0 };
        }

        this._out.appendLine(`\n── Recovery: checking ${lost.length} agents marked as restart-lost ──`);

        // Phase 1: Quick summary fetch — only used to confirm cascade still exists.
        // The summary endpoint (GetAllCascadeTrajectories) does NOT include
        // waitingSteps, which is why earlier revisions of this code wrongly
        // marked WaitingForAction agents as Completed.
        let trajSummaries: Record<string, any> | null = null;
        try {
            trajSummaries = await this._sdk.ls.listCascades();
            this._out.appendLine(`[RECOVERY] listCascades returned ${trajSummaries ? Object.keys(trajSummaries).length : 0} entries`);
        } catch (err: any) {
            this._out.appendLine(`[RECOVERY] listCascades FAILED: ${err?.message} — cannot recover this cycle`);
            return { checked: lost.length, recovered: 0 };
        }

        let recovered = 0;

        for (const agent of lost) {
            const idShort = agent.id.substring(0, 8);
            const summary = trajSummaries && trajSummaries[agent.id];

            // Persisted-state dump for debugging (always emitted)
            this._out.appendLine(
                `[RECOVERY-DUMP] ${idShort}: persisted-state={ `
                + `status=${SubAgentStatus[agent.status as any] || agent.status}, `
                + `stepCount=${agent.stepCount}, `
                + `completedAt=${agent.completedAt ? new Date(agent.completedAt).toISOString() : 'none'}, `
                + `pendingAction=${agent.pendingAction ? JSON.stringify(agent.pendingAction) : 'none'}, `
                + `error=${agent.error || 'none'} }`,
            );

            if (!summary) {
                // Cascade is gone on the LS side — it likely completed or was cleaned up.
                // Leave it Failed but clarify the reason so it isn't endlessly re-checked.
                agent.error = 'Lost tracking after restart — cascade no longer present on LS';
                this._out.appendLine(`[RECOVERY] ${idShort}: NOT in LS — keeping Failed`);
                continue;
            }

            // Phase 2: Authoritative state fetch — GetConversation includes
            // waitingSteps and the full requestedInteraction payload required
            // to distinguish WaitingForAction from Completed.
            let conv: any = null;
            try {
                conv = await this._sdk.ls.getConversation(agent.id);
            } catch (err: any) {
                this._out.appendLine(`[RECOVERY] ${idShort}: getConversation FAILED: ${err?.message} — falling back to summary`);
            }

            // Merge summary + detailed view, preferring detailed where present.
            const trajStatus: string = (conv?.status || summary?.status || '') as string;
            const steps: number = conv?.lastStepIndex
                ?? conv?.numSteps
                ?? conv?.stepCount
                ?? summary?.lastStepIndex
                ?? summary?.numSteps
                ?? summary?.stepCount
                ?? agent.stepCount
                ?? 0;

            // waitingSteps can appear in several shapes depending on RPC version.
            // Probe all known locations to maximise the chance of detecting an
            // outstanding user-interaction request.
            const waitingFromConv = Array.isArray(conv?.waitingSteps) ? conv.waitingSteps
                : Array.isArray(conv?.pendingInteractions) ? conv.pendingInteractions
                : Array.isArray(conv?.requestedInteractions) ? conv.requestedInteractions
                : [];
            const waitingFromSummary = Array.isArray(summary?.waitingSteps) ? summary.waitingSteps : [];
            const waitingSteps: any[] = waitingFromConv.length ? waitingFromConv : waitingFromSummary;
            const hasWaitingSteps = waitingSteps.length > 0;

            // Diagnostic dump for failure cases — show enough to reverse-engineer.
            const convKeys = conv ? Object.keys(conv).join(',') : 'none';
            const convPreview: Record<string, any> = {};
            if (conv) {
                for (const k of Object.keys(conv).slice(0, 25)) {
                    const v = conv[k];
                    if (v === null || v === undefined) convPreview[k] = null;
                    else if (Array.isArray(v)) convPreview[k] = `[Array(len=${v.length})${v.length ? ' first=' + JSON.stringify(v[0]).substring(0, 200) : ''}]`;
                    else if (typeof v === 'object') convPreview[k] = `{${Object.keys(v).join(',')}}`;
                    else convPreview[k] = String(v).substring(0, 150);
                }
            }
            this._out.appendLine(`[RECOVERY-DUMP] ${idShort}: conv={ keys=[${convKeys}] } fields=${JSON.stringify(convPreview).substring(0, 1200)}`);

            this._out.appendLine(
                `[RECOVERY] ${idShort}: trajStatus=${trajStatus || 'none'}, `
                + `steps=${steps}, waitingSteps=${hasWaitingSteps} (count=${waitingSteps.length})`,
            );

            const prev = agent.status;

            // ─── Priority 0: Recover agents that were waiting for approval ───
            // The persisted state was last updated by the live monitor before the
            // extension was restarted — pendingAction being set means the agent
            // was WaitingForAction when the extension shut down.
            //
            // On restart, the Antigravity IDE itself auto-cancels any pending
            // interactions (verified by user test: same behaviour even with our
            // extension fully disabled). So when we see:
            //
            //   persisted.pendingAction != null
            //   fresh.waitingSteps == false   (interaction is gone)
            //   fresh.stepCount == persisted.stepCount   (nothing has happened)
            //   fresh.status == IDLE
            //
            // the only honest terminal state is Cancelled — NOT Completed (the
            // sub-agent never ran its post-approval steps and never got to call
            // send_message). We use the IDE_CANCELLED_ERROR sentinel so the
            // messaging layer can skip the spurious "Report sent to parent"
            // delivery, mirroring the PARENT_STOPPED pattern.
            //
            // If the user already approved while the extension was off, fresh
            // stepCount will have advanced — we then fall through to the IDLE+
            // steps Completed branch (silent recovery).
            const persistedPending = agent.pendingAction;
            const persistedSteps = agent.stepCount ?? 0;
            const observedAdvanced = steps > persistedSteps;
            if (persistedPending && !hasWaitingSteps && !observedAdvanced) {
                agent.status = SubAgentStatus.Cancelled;
                agent.completedAt = Date.now();
                agent.stepCount = steps;
                agent.error = IDE_CANCELLED_ERROR;
                agent.pendingAction = undefined;
                this._out.appendLine(
                    `[RECOVERY] ${idShort}: -> Cancelled `
                    + `(IDE auto-cancelled pending action on restart, `
                    + `persistedSteps=${persistedSteps}, observedSteps=${steps}, `
                    + `lastTarget="${persistedPending.target.substring(0, 40)}")`,
                );
                this._fire(agent, 'status_change', prev);
                recovered++;
                continue;
            }


            // ─── Priority 1: waitingSteps wins regardless of trajStatus ───
            // A cascade waiting for user input is reported by the LS as IDLE with
            // waitingSteps populated. We MUST check waitingSteps before IDLE,
            // otherwise WaitingForAction agents get wrongly marked Completed.
            if (hasWaitingSteps) {
                agent.status = SubAgentStatus.WaitingForAction;
                agent.stepCount = steps;
                agent.completedAt = undefined;
                agent.error = undefined;

                // Attempt to (re-)extract pending action details from the
                // freshly-fetched waiting step. Falls back to the persisted
                // pendingAction (kept across restarts) if extraction fails.
                try {
                    const first = waitingSteps[0];
                    const detail = this._extractRecoveryAction(first, conv?.trajectoryId || summary?.trajectoryId || agent.id);
                    if (detail) {
                        agent.pendingAction = detail;
                    }
                } catch (err: any) {
                    this._out.appendLine(`[RECOVERY] ${idShort}: extract action failed: ${err?.message} — keeping persisted pendingAction`);
                }

                this._out.appendLine(`[RECOVERY] ${idShort}: -> WaitingForAction (waitingSteps present)`);
                this._fire(agent, 'action_required', prev);
                recovered++;
                continue;
            }

            // ─── Priority 2: IDLE + real progress = Completed (SILENT) ───
            // Match monitor.ts's `newSteps > 0` guard.
            // IMPORTANT: fire 'status_change' NOT 'completed'. A 'completed' fire
            // would trigger checkBatchDelivery and emit a spurious "Report sent
            // to parent" message for an agent that already finished long ago,
            // possibly in a previous extension session. Silent recovery is the
            // contract for restart-lost agents.
            if (trajStatus === 'CASCADE_RUN_STATUS_IDLE' && steps > 0) {
                agent.status = SubAgentStatus.Completed;
                agent.completedAt = agent.completedAt || Date.now();
                agent.stepCount = steps;
                agent.error = undefined;
                agent.pendingAction = undefined;
                if (observedAdvanced) {
                    this._out.appendLine(`[RECOVERY] ${idShort}: IDLE+steps -> Completed (steps advanced past persisted pendingAction, silent)`);
                } else {
                    this._out.appendLine(`[RECOVERY] ${idShort}: IDLE+steps -> Completed (silent, no delivery)`);
                }
                this._fire(agent, 'status_change', prev);
                recovered++;
                continue;
            }

            // ─── Default: revive as Running, let the standing monitor disambiguate ───
            agent.status = SubAgentStatus.Running;
            agent.stepCount = steps;
            agent.completedAt = undefined;
            agent.error = undefined;
            this._out.appendLine(`[RECOVERY] ${idShort}: -> Running (monitor will refine)`);
            this._fire(agent, 'status_change', prev);
            recovered++;
        }

        this._persistState();

        // If any agents are alive again, kick the monitor back on.
        if (recovered > 0) {
            this._ensureMonitoring();
        }

        this._out.appendLine(`── Recovery done: ${recovered}/${lost.length} agents recovered ──\n`);
        return { checked: lost.length, recovered };
    }

    /**
     * Extract a pending-action descriptor from a single waitingStep object
     * returned by GetConversation. Mirrors monitor.ts's extractPendingAction
     * shape but is synchronous (no SDK calls needed here).
     */
    private _extractRecoveryAction(waitingStep: any, trajId: string): { trajectoryId: string; stepIndex: number; actionType: string; target: string } | null {
        if (!waitingStep || typeof waitingStep !== 'object') return null;

        const stepIdx = waitingStep.stepIndex
            ?? waitingStep.index
            ?? waitingStep.step_index
            ?? -1;

        const stepType = waitingStep.type || waitingStep.stepType || '';
        let actionType = 'unknown';
        let target = 'Needs approval';

        if (stepType.includes('RUN_COMMAND') || waitingStep.runCommand) {
            actionType = 'command';
            const cmd = waitingStep.runCommand || waitingStep.command || {};
            target = cmd.commandLine || cmd.proposedCommandLine || cmd.CommandLine || 'command';
        } else if (stepType.includes('CODE_ACTION') || waitingStep.codeAction) {
            actionType = 'edit';
            target = 'file edit';
        } else if (waitingStep.requestedInteraction?.permission) {
            const res = waitingStep.requestedInteraction.permission.resource;
            if (res) {
                actionType = res.action || 'unknown';
                target = res.target || 'Needs approval';
            }
        }

        if (target === 'Needs approval') {
            target = waitingStep.description
                || waitingStep.summary
                || waitingStep.title
                || waitingStep.label
                || 'Needs approval';
        }

        return {
            trajectoryId: trajId,
            stepIndex: typeof stepIdx === 'number' ? stepIdx : -1,
            actionType,
            target,
        };
    }

    // ─── Simulation API (Dev Only) ──────────────────────────────────────

    /**
     * Inject a fake sub-agent directly into the store.
     * Fires a 'created' event so all UI updates instantly.
     * These agents are NEVER persisted — purely ephemeral.
     * The agent can have any ID (including real cascade IDs for testing).
     */
    __injectSimulatedAgent(agent: ISubAgent): void {
        // Prevent collisions with real agents
        if (this._agents.has(agent.id) && !this._simulatedIds.has(agent.id)) {
            return; // Don't overwrite real agents
        }
        this._simulatedIds.add(agent.id);
        this._agents.set(agent.id, agent);
        this._fire(agent, 'created');
    }

    /**
     * Inject a fake batch into the store.
     */
    __injectSimulatedBatch(batch: ISubAgentBatch): void {
        this._simulatedIds.add(batch.id);
        this._batches.set(batch.id, batch);
    }

    /**
     * Update a simulated agent's state. Fires appropriate events.
     */
    __updateSimulatedAgent(id: string, updates: Partial<ISubAgent>): void {
        const agent = this._agents.get(id);
        if (!agent || !this._simulatedIds.has(id)) return;

        const prev = agent.status;
        Object.assign(agent, updates);

        if (updates.status && updates.status !== prev) {
            this._fire(agent, 'status_change', prev);
        } else if (updates.stepCount !== undefined) {
            this._fire(agent, 'progress');
        } else {
            this._fire(agent, 'progress');
        }
    }

    /**
     * Remove a single simulated agent from the store.
     */
    __removeSimulatedAgent(id: string): void {
        if (!this._simulatedIds.has(id)) return;
        this._simulatedIds.delete(id);
        this._agents.delete(id);
        const batch = Array.from(this._batches.values()).find(b => b.agentIds.includes(id));
        if (batch) {
            batch.agentIds = batch.agentIds.filter(aid => aid !== id);
            if (batch.agentIds.length === 0) {
                this._simulatedIds.delete(batch.id);
                this._batches.delete(batch.id);
            }
        }
        // Fire a dummy event to refresh UI
        this._onEvent.fire({ agent: { id } as any, type: 'status_change' });
    }

    /**
     * Remove ALL simulated agents and batches from the store.
     */
    __removeAllSimulated(): void {
        for (const id of this._simulatedIds) {
            this._agents.delete(id);
            this._batches.delete(id);
        }
        this._simulatedIds.clear();
        // Fire a dummy event to refresh UI
        this._onEvent.fire({ agent: { id: 'sim-clear' } as any, type: 'status_change' });
    }

    // ─── Conversation Queries ───────────────────────────────────────────

    /**
     * Get the title/summary of a conversation by cascade ID.
     * Used by CDP injector to show parent chat names in breadcrumbs.
     */
    async getConversationTitle(cascadeId: string): Promise<string | null> {
        try {
            const conv = await this._sdk.ls.getConversation(cascadeId);
            // getConversation returns raw RPC data — look for summary/title fields
            return conv?.summary || conv?.title || conv?.description || null;
        } catch {
            return null;
        }
    }

    // ─── Disposal ───────────────────────────────────────────────────────

    dispose(): void {
        this._stopMonitoring();
        this._persistState();
        for (const d of this._disposables) d.dispose();
    }
}
