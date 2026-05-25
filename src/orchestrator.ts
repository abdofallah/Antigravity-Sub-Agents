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
 * @module orchestrator
 */

import * as vscode from 'vscode';
import { AntigravitySDK, Models, ModelId } from 'antigravity-sdk';
import {
    ISubAgent,
    ISubAgentBatch,
    ILaunchConfig,
    IQuickLaunchConfig,
    ISubAgentEvent,
    IBufferedMessage,
    IMessageBuffer,
    IPendingAction,
    SubAgentStatus,
    MODEL_LABELS,
    isActiveStatus,
    isTerminalStatus,
    generateBatchId,
} from './types';

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
    /** Known step counts — used to detect deltas */
    private _lastStepCounts = new Map<string, number>();
    /** Stale counter — tracks how many poll cycles a sub-agent's steps haven't changed */
    private _staleCycles = new Map<string, number>();
    /** Tracks which agents have been seen in trajectory summaries at least once */
    private _seenInTraj = new Set<string>();
    /** Diagnostic: poll cycle counter for logging */
    private _pollDiagCount = 0;
    /** Threshold: if step count unchanged for this many cycles, mark as completed */
    private static readonly STALE_THRESHOLD = 10;
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

    /** Get sub-agents belonging to a batch */
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
     *
     * Creates N headless cascades via the SDK, tags them,
     * and starts monitoring their progress.
     */
    async launch(config: ILaunchConfig): Promise<{ batchId: string; ids: string[] }> {
        const batchId = generateBatchId();
        const parentId = config.parentId || await this._detectParentId();
        const concurrency = config.concurrency || config.tasks.length;
        const staggerMs = config.staggerMs ?? 500;
        const createdIds: string[] = [];

        // Create batch record
        const batch: ISubAgentBatch = {
            id: batchId,
            parentId,
            agentIds: [],
            createdAt: Date.now(),
            description: config.description || `${config.tasks.length} sub-agents`,
        };
        this._batches.set(batchId, batch);

        // Launch in controlled concurrency
        const queue = [...config.tasks];
        let launched = 0;

        const launchOne = async (index: number): Promise<void> => {
            const task = queue[index];
            const model = Array.isArray(config.model) ? config.model[index] : config.model;
            const label = config.labels?.[index] || `Sub-Agent ${index + 1}`;

            // Create the sub-agent record (Pending)
            const placeholder: ISubAgent = {
                id: '', // Will be set after createCascade
                parentId,
                batchId,
                label,
                task,
                model,
                status: SubAgentStatus.Pending,
                stepCount: 0,
                createdAt: Date.now(),
            };

            try {
                console.log(`[SubAgents] ═══════════════════════════════════════`);
                console.log(`[SubAgents] Launching ${label} | model=${model} | batch=${batchId}`);

                // ─── Step 1: Create cascade container via rawRPC ───
                // Reverse-engineered from Antigravity Manager's network calls:
                // The Manager pre-generates a cascadeId (UUID), sends workspaceUris,
                // and uses the string enum source 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT'.
                // Without workspaceUris, the LS can't associate the cascade with any workspace.
                
                // Workspace discovery priority:
                // 0. Explicit workspaceUri from launch config (agent tells us)
                // 1. Parent trajectory metadata.workspaceUris
                // 2. Parent trajectory workspaces[].workspaceFolderAbsoluteUri
                // 3. Active text editor's workspace
                // 4. First workspace folder
                let workspaceUris: string[] = [];
                
                // Path 0: Explicit from calling agent (most reliable)
                if (config.workspaceUri) {
                    workspaceUris = [config.workspaceUri];
                    this._out.appendLine(`[LAUNCH] workspace from explicit config: ${JSON.stringify(workspaceUris)}`);
                }
                
                // Path 1-3: Look up from parent trajectory if not already set
                if (workspaceUris.length === 0) try {
                    const trajSummaries = await this._sdk.ls.listCascades();
                    if (trajSummaries && trajSummaries[parentId]) {
                        const parentTraj = trajSummaries[parentId];
                        this._out.appendLine(`[LAUNCH] parent traj keys: ${Object.keys(parentTraj).join(', ')}`);
                        
                        // Path 1: trajectoryMetadata.workspaceUris (array of URI strings)
                        const meta = parentTraj.trajectoryMetadata;
                        if (meta?.workspaceUris && Array.isArray(meta.workspaceUris) && meta.workspaceUris.length > 0) {
                            workspaceUris = meta.workspaceUris;
                            this._out.appendLine(`[LAUNCH] workspace from meta.workspaceUris: ${JSON.stringify(workspaceUris)}`);
                        }
                        // Path 2: top-level workspaces array with workspaceFolderAbsoluteUri
                        else if (Array.isArray(parentTraj.workspaces) && parentTraj.workspaces.length > 0) {
                            workspaceUris = parentTraj.workspaces
                                .map((w: any) => w.workspaceFolderAbsoluteUri || w.uri)
                                .filter(Boolean);
                            this._out.appendLine(`[LAUNCH] workspace from traj.workspaces: ${JSON.stringify(workspaceUris)}`);
                        }
                        // Path 3: trajectoryMetadata.workspaces array
                        else if (meta?.workspaces && Array.isArray(meta.workspaces) && meta.workspaces.length > 0) {
                            workspaceUris = meta.workspaces
                                .map((w: any) => w.workspaceFolderAbsoluteUri || w.uri)
                                .filter(Boolean);
                            this._out.appendLine(`[LAUNCH] workspace from meta.workspaces: ${JSON.stringify(workspaceUris)}`);
                        } else {
                            this._out.appendLine(`[LAUNCH] no workspace found in parent traj. meta type=${typeof meta}, meta keys=${meta ? Object.keys(meta).join(',') : 'null'}`);
                        }
                    } else {
                        this._out.appendLine(`[LAUNCH] parent ${parentId.substring(0, 8)} NOT in trajSummaries`);
                    }
                } catch (e: any) {
                    this._out.appendLine(`[LAUNCH] workspace lookup error: ${e?.message}`);
                }
                
                // Fallback: try active text editor's workspace, then first folder
                if (workspaceUris.length === 0) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const wsFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
                        if (wsFolder) {
                            workspaceUris = [wsFolder.uri.toString()];
                            this._out.appendLine(`[LAUNCH] workspace from active editor: ${JSON.stringify(workspaceUris)}`);
                        }
                    }
                }
                if (workspaceUris.length === 0) {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    workspaceUris = workspaceFolders
                        ? [workspaceFolders[0].uri.toString()]
                        : [];
                    this._out.appendLine(`[LAUNCH] workspace fallback to first folder: ${JSON.stringify(workspaceUris)}`);
                }
                
                // Pre-generate cascadeId like the Manager does
                const preGenId = crypto.randomUUID();
                
                const startPayload = {
                    source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT',
                    cascadeId: preGenId,
                    workspaceUris,
                };
                this._out.appendLine(`[LAUNCH] StartCascade payload: ${JSON.stringify(startPayload)}`);

                const startResp = await this._sdk.ls.rawRPC('StartCascade', startPayload);
                this._out.appendLine(`[LAUNCH] StartCascade response: ${JSON.stringify(startResp).substring(0, 500)}`);
                const cascadeId = startResp?.cascadeId || preGenId;

                if (!cascadeId) {
                    console.error(`[SubAgents] StartCascade returned no cascadeId:`, startResp);
                    placeholder.status = SubAgentStatus.Failed;
                    placeholder.error = 'StartCascade returned no cascadeId';
                    placeholder.id = `failed-${Date.now()}-${index}`;
                    this._agents.set(placeholder.id, placeholder);
                    this._fire(placeholder, 'status_change');
                    return;
                }

                this._out.appendLine(`[LAUNCH] Cascade created: ${cascadeId}`);

                // ─── Step 2: Send message matching Manager's proto3 JSON format ───
                // Reverse-engineered from Manager's SendUserCascadeMessage network call.
                // Key differences from our old format:
                //   - 'google' planner → full agentic mode with all tools/MCPs
                //   - requestedModel uses model enum value
                //
                // Inject parentId + send_message instruction into the task prompt
                // so the sub-agent knows HOW and WHERE to report results.
                const augmentedTask = [
                    `[Sub-Agent Context]`,
                    `You are a sub-agent launched by a parent agent. Your parent's conversation ID is: ${parentId}`,
                    `When you have completed your task, you MUST call the send_message tool to report your results back to the parent:`,
                    `  send_message(parentId="${parentId}", message="<your findings and results>")`,
                    `Your text output is NOT automatically sent to the parent — you MUST use send_message. Put ALL important information (findings, summaries, file paths, conclusions) into your send_message call.`,
                    ``,
                    `[Task]`,
                    task,
                ].join('\n');

                const sendPayload: any = {
                    cascadeId,
                    items: [{ text: augmentedTask }],
                    cascadeConfig: {
                        plannerConfig: {
                            // Proto3 oneof: 'google' = full agentic with tools
                            google: {},
                            // Proto3: requestedModel with model enum value
                            requestedModel: {
                                model: model || Models.GEMINI_FLASH,
                            },
                        },
                    },
                };

                this._out.appendLine(`[LAUNCH] SendUserCascadeMessage payload: ${JSON.stringify(sendPayload).substring(0, 400)}`);

                const sendResp = await this._sdk.ls.rawRPC('SendUserCascadeMessage', sendPayload);
                this._out.appendLine(`[LAUNCH] SendUserCascadeMessage response: ${JSON.stringify(sendResp).substring(0, 200)}`);

                // Update with real cascade ID
                placeholder.id = cascadeId;
                placeholder.status = SubAgentStatus.Running;
                this._agents.set(cascadeId, placeholder);
                batch.agentIds.push(cascadeId);
                createdIds.push(cascadeId);

                // Tag the cascade for identification
                await this._tagSubAgent(cascadeId, label, batchId, index + 1, config.tasks.length);

                // Archive the sub-agent chat so it doesn't clutter sidebar/history
                try {
                    await this._sdk.ls.rawRPC('UpdateConversationAnnotations', {
                        cascadeId,
                        annotations: { archived: true },
                        mergeAnnotations: true,
                    });
                } catch { /* non-critical */ }

                // Register with the IDE's trajectory index so it appears in the Manager
                // Without this, the .pb file exists but the Manager can't find it
                try {
                    await vscode.commands.executeCommand(
                        'antigravity.trackBackgroundConversationCreated',
                        cascadeId,
                    );
                    this._out.appendLine(`[TRACK] ${cascadeId.substring(0, 8)}: trackBackgroundConversationCreated OK`);
                } catch (trackErr: any) {
                    // Non-fatal — conversation works, just won't appear in sidebar
                    this._out.appendLine(`[TRACK] ${cascadeId.substring(0, 8)}: trackBackgroundConversationCreated FAILED: ${trackErr?.message}`);
                }

                // Fire creation event
                this._fire(placeholder, 'created');

                launched++;

            } catch (err: any) {
                console.error(`[SubAgents] Launch FAILED: ${err?.message}`);
                console.error(`[SubAgents] Stack: ${err?.stack}`);
                placeholder.status = SubAgentStatus.Failed;
                placeholder.error = err?.message || 'Launch failed';
                placeholder.id = `failed-${Date.now()}-${index}`;
                this._agents.set(placeholder.id, placeholder);
                this._fire(placeholder, 'status_change');
            }
        };

        // Staggered launch with concurrency control
        for (let i = 0; i < config.tasks.length; i += concurrency) {
            const chunk = [];
            for (let j = i; j < Math.min(i + concurrency, config.tasks.length); j++) {
                chunk.push(launchOne(j));
                if (staggerMs > 0 && j < config.tasks.length - 1) {
                    await this._delay(staggerMs);
                }
            }
            await Promise.allSettled(chunk);
        }

        this._persistState();

        // Start realtime monitoring if not already running
        this._ensureMonitoring();

        return { batchId, ids: createdIds };
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

    /**
     * Cancel a running sub-agent (user-initiated).
     * Silent — no report is sent to the parent agent.
     * If the parent wants to know, it can call check_subagents.
     */
    async cancel(id: string): Promise<void> {
        const agent = this._agents.get(id);
        if (!agent || isTerminalStatus(agent.status)) return;

        try {
            await this._sdk.ls.cancelCascade(id);
        } catch {
            // May already be done
        }

        const prev = agent.status;
        agent.status = SubAgentStatus.Cancelled;
        agent.completedAt = Date.now();
        // No USER_CANCELLED prefix — silent cancellation matching AG 2.0 behavior
        agent.error = 'Stopped by user';
        this._fire(agent, 'status_change', prev);
        this._persistState();

        // Check if this completes a batch → trigger buffered delivery
        this._checkBatchDelivery(agent.batchId);
    }

    /**
     * Cancel a sub-agent silently (parent-initiated).
     * No USER_CANCELLED flag, no batch report will fire.
     */
    private async _cancelSilent(id: string): Promise<void> {
        const agent = this._agents.get(id);
        if (!agent || isTerminalStatus(agent.status)) return;

        try {
            await this._sdk.ls.cancelCascade(id);
        } catch {
            // May already be done
        }

        const prev = agent.status;
        agent.status = SubAgentStatus.Cancelled;
        agent.completedAt = Date.now();
        agent.error = 'PARENT_STOPPED: Parent agent execution was stopped by the user.';
        this._fire(agent, 'status_change', prev);
    }

    /**
     * Cancel all active sub-agents belonging to a specific parent cascade.
     * Called automatically when a parent cascade is cancelled.
     * Silent — no batch report, no user-cancel flag.
     */
    async cancelByParent(parentId: string): Promise<void> {
        const children = this.getAll().filter(a => a.parentId === parentId && isActiveStatus(a.status));
        if (children.length === 0) return;

        this._out.appendLine(`[PARENT_STOP] Parent ${parentId.substring(0, 8)} stopped — cancelling ${children.length} sub-agents silently`);
        await Promise.allSettled(children.map(a => this._cancelSilent(a.id)));
        this._persistState();
    }

    /**
     * Cancel all active sub-agents.
     */
    async cancelAll(): Promise<void> {
        const active = this.getActive();
        await Promise.allSettled(active.map(a => this.cancel(a.id)));
    }

    /**
     * Cancel all active sub-agents in a specific batch.
     */
    async cancelBatch(batchId: string): Promise<void> {
        const batchAgents = this.getByBatch(batchId).filter(a => isActiveStatus(a.status));
        await Promise.allSettled(batchAgents.map(a => this.cancel(a.id)));
    }

    /**
     * Focus the UI on a sub-agent's chat.
     * Uses LSBridge RPC first, falls back to VS Code command.
     */
    async viewChat(id: string): Promise<void> {
        try {
            // Primary: LS RPC — SmartFocusConversation
            await this._sdk.ls.focusCascade(id);
        } catch {
            // Fallback: VS Code command to switch visible conversation
            try {
                await vscode.commands.executeCommand('antigravity.setVisibleConversation', id);
            } catch {
                // Last resort: open agent panel and try again
                await vscode.commands.executeCommand('antigravity.agentPanel.open');
                await this._delay(500);
                await vscode.commands.executeCommand('antigravity.setVisibleConversation', id);
            }
        }
    }

    // ─── Remote Action Handling ─────────────────────────────────────────

    /**
     * Approve (Run) a pending action on a sub-agent.
     * Sends HandleCascadeUserInteraction with allow=true.
     */
    async approveAction(id: string): Promise<void> {
        const agent = this._agents.get(id);
        if (!agent || !agent.pendingAction) {
            this._out.appendLine(`[APPROVE] ${id.substring(0, 8)}: no pending action`);
            return;
        }
        const { trajectoryId, stepIndex, target } = agent.pendingAction;
        this._out.appendLine(`[APPROVE] ${id.substring(0, 8)}: traj=${trajectoryId.substring(0, 8)}, step=${stepIndex}, target=${target}`);

        try {
            await this._sdk.ls.rawRPC('HandleCascadeUserInteraction', {
                cascadeId: id,
                interaction: {
                    trajectoryId,
                    stepIndex,
                    permission: {
                        allow: true,
                        scope: 'PERMISSION_SCOPE_ONCE',
                    },
                },
            });

            // Clear pending action and revert to running
            agent.pendingAction = undefined;
            const prev = agent.status;
            agent.status = SubAgentStatus.Running;
            this._out.appendLine(`[APPROVE] ${id.substring(0, 8)}: action approved, status -> Running`);
            this._fire(agent, 'status_change', prev);
            this._persistState();
        } catch (err: any) {
            this._out.appendLine(`[APPROVE] ${id.substring(0, 8)}: FAILED: ${err?.message}`);
        }
    }

    /**
     * Respond "No" with a custom message — rejects the single permission
     * but does NOT cancel the cascade, allowing the agent to adapt.
     * Sends HandleCascadeUserInteraction with allow=false (deny scope),
     * then sends a user message with the provided text.
     */
    async respondAction(id: string, message?: string): Promise<void> {
        const agent = this._agents.get(id);
        if (!agent || !agent.pendingAction) {
            this._out.appendLine(`[RESPOND] ${id.substring(0, 8)}: no pending action`);
            return;
        }
        const { trajectoryId, stepIndex, target } = agent.pendingAction;
        const msg = message || 'No, do not run this command.';
        this._out.appendLine(`[RESPOND] ${id.substring(0, 8)}: traj=${trajectoryId.substring(0, 8)}, step=${stepIndex}, msg="${msg}"`);

        try {
            // 1. Deny the permission (no "allow" field = reject)
            await this._sdk.ls.rawRPC('HandleCascadeUserInteraction', {
                cascadeId: id,
                interaction: {
                    trajectoryId,
                    stepIndex,
                    permission: {
                        scope: 'PERMISSION_SCOPE_ONCE',
                    },
                },
            });

            // 2. Send user message so the agent knows what to do instead
            await this._sdk.ls.rawRPC('SendUserCascadeMessage', {
                cascadeId: id,
                message: msg,
            });

            // Clear pending action and revert to running (agent continues)
            agent.pendingAction = undefined;
            const prev = agent.status;
            agent.status = SubAgentStatus.Running;
            this._out.appendLine(`[RESPOND] ${id.substring(0, 8)}: denied with message, status -> Running`);
            this._fire(agent, 'status_change', prev);
            this._persistState();
        } catch (err: any) {
            this._out.appendLine(`[RESPOND] ${id.substring(0, 8)}: FAILED: ${err?.message}`);
        }
    }

    /**
     * Reject (Cancel) — hard reject: denies the permission AND cancels the cascade entirely.
     * Used from the sidebar quick-deny flow.
     */
    async rejectAction(id: string): Promise<void> {
        const agent = this._agents.get(id);
        if (!agent || !agent.pendingAction) {
            this._out.appendLine(`[REJECT] ${id.substring(0, 8)}: no pending action`);
            return;
        }
        const { trajectoryId, stepIndex, target } = agent.pendingAction;
        this._out.appendLine(`[REJECT] ${id.substring(0, 8)}: traj=${trajectoryId.substring(0, 8)}, step=${stepIndex}, target=${target}`);

        try {
            // 1. Deny the permission
            await this._sdk.ls.rawRPC('HandleCascadeUserInteraction', {
                cascadeId: id,
                interaction: {
                    trajectoryId,
                    stepIndex,
                    permission: {
                        scope: 'PERMISSION_SCOPE_ONCE',
                    },
                },
            });

            // 2. Cancel the cascade entirely
            await this._sdk.ls.rawRPC('CancelCascadeInvocation', {
                cascadeId: id,
            });

            // Mark as cancelled
            agent.pendingAction = undefined;
            const prev = agent.status;
            agent.status = SubAgentStatus.Cancelled;
            agent.completedAt = Date.now();
            this._out.appendLine(`[REJECT] ${id.substring(0, 8)}: rejected & cancelled`);
            this._fire(agent, 'cancelled', prev);
            this._persistState();
        } catch (err: any) {
            this._out.appendLine(`[REJECT] ${id.substring(0, 8)}: FAILED: ${err?.message}`);
        }
    }

    /**
     * Clear completed/failed/cancelled sub-agents from history.
     */
    clearHistory(): void {
        for (const [id, agent] of this._agents) {
            if (isTerminalStatus(agent.status)) {
                this._agents.delete(id);
            }
        }
        this._persistState();
    }

    // ─── Realtime Monitoring ────────────────────────────────────────────

    /**
     * Start the realtime monitoring loop.
     * Polls diagnostics every 3 seconds to detect step changes.
     */
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

    /**
     * Poll for progress on all active sub-agents.
     *
     * Strategy: Use SDK's LS RPC calls directly (not getDiagnostics)
     * because cascadeId (from StartCascade) != googleAgentId (from diagnostics).
     *
     * Two-pronged approach:
     * 1. listCascades() — gets all trajectory summaries keyed by cascadeId
     * 2. getConversation(cascadeId) — gets per-cascade status and turn data
     */
    private async _pollProgress(): Promise<void> {
        const active = this.getActive();
        if (active.length === 0) {
            this._stopMonitoring();
            return;
        }

        this._pollDiagCount = (this._pollDiagCount ?? 0) + 1;
        const cycle = this._pollDiagCount;

        // Always log to visible output channel
        this._out.appendLine(`\n── Poll cycle ${cycle} | ${active.length} active agents ──`);

        // Approach 1: Try to get trajectory summaries via listCascades
        let trajSummaries: Record<string, any> | null = null;
        try {
            trajSummaries = await this._sdk.ls.listCascades();
            this._out.appendLine(`[listCascades] ${trajSummaries ? Object.keys(trajSummaries).length : 0} entries`);

            // One-time dump: compare fields between normal convos and sub-agents
            if (trajSummaries && cycle === 1) {
                const ids = Object.keys(trajSummaries);
                const agentIds = new Set(active.map(a => a.id));
                // Dump one normal convo and one sub-agent for field comparison
                for (const id of ids.slice(0, 3)) {
                    const t = trajSummaries[id];
                    const isAgent = agentIds.has(id);
                    const keys = Object.keys(t);
                    const fieldDump: Record<string, any> = {};
                    for (const k of keys) {
                        const v = t[k];
                        if (v === null || v === undefined) fieldDump[k] = null;
                        else if (Array.isArray(v)) fieldDump[k] = `[Array(${v.length})]`;
                        else if (typeof v === 'object') fieldDump[k] = `{${Object.keys(v).join(',')}}`;
                        else fieldDump[k] = v;
                    }
                    this._out.appendLine(`[COMPARE${isAgent ? '-AGENT' : ''}] ${id.substring(0, 8)}: ${JSON.stringify(fieldDump)}`);
                }
            }
        } catch (err: any) {
            this._out.appendLine(`[listCascades] FAILED: ${err?.message}`);
        }

        for (const agent of active) {
            try {
                let newSteps = 0;
                let trajStatus = '';
                let hasWaitingSteps = false;

                if (trajSummaries && trajSummaries[agent.id]) {
                    const traj = trajSummaries[agent.id];
                    newSteps = traj.lastStepIndex ?? traj.numSteps ?? traj.stepCount ?? 0;
                    trajStatus = traj.status || '';
                    hasWaitingSteps = Array.isArray(traj.waitingSteps) && traj.waitingSteps.length > 0;
                    this._seenInTraj.add(agent.id);

                    this._out.appendLine(`[traj] ${agent.id.substring(0, 8)}: status=${trajStatus}, steps=${newSteps}, waitingSteps=${hasWaitingSteps}`);
                } else if (this._seenInTraj.has(agent.id)) {
                    // Agent was previously in trajectory list but is now gone → completed
                    const prevSteps = this._lastStepCounts.get(agent.id) ?? 0;
                    if (prevSteps > 0) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.Completed;
                        agent.completedAt = Date.now();
                        agent.stepCount = prevSteps;
                        this._staleCycles.delete(agent.id);
                        this._seenInTraj.delete(agent.id);
                        this._out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: VANISHED from traj -> Completed (was ${prev}, steps=${prevSteps})`);
                        this._fire(agent, 'completed', prev);
                        continue;
                    }
                    this._out.appendLine(`[traj] ${agent.id.substring(0, 8)}: vanished but no steps recorded`);
                } else {
                    this._out.appendLine(`[traj] ${agent.id.substring(0, 8)}: NOT in trajSummaries (never seen)`);
                }

                // ─── State Detection (from trajectory summary) ───
                // CASCADE_RUN_STATUS_RUNNING + waitingSteps → WaitingForAction
                // CASCADE_RUN_STATUS_RUNNING + no waitingSteps → Running (reset stale)
                // CASCADE_RUN_STATUS_IDLE → Completed
                // No traj data → fall through to stale detection

                if (trajStatus) {
                    if (hasWaitingSteps) {
                        // Agent is waiting for user approval (command, file edit, etc.)
                        if (agent.status !== SubAgentStatus.WaitingForAction) {
                            const prev = agent.status;
                            agent.status = SubAgentStatus.WaitingForAction;
                            agent.stepCount = newSteps;
                            this._out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: waitingSteps -> WaitingForAction (was ${prev})`);
                            this._fire(agent, 'action_required', prev);
                        }

                        // Extract pending action details for remote approve/reject
                        if (!agent.pendingAction) {
                            try {
                                await this._extractPendingAction(agent, trajSummaries![agent.id]);
                            } catch (err: any) {
                                this._out.appendLine(`[ACTION] ${agent.id.substring(0, 8)}: failed to extract: ${err?.message}`);
                            }
                        }

                        this._staleCycles.set(agent.id, 0); // Reset stale — NOT stuck
                        this._lastStepCounts.set(agent.id, newSteps);
                        continue;
                    } else if (agent.pendingAction) {
                        // No longer waiting — clear the pending action
                        agent.pendingAction = undefined;
                    }

                    if (trajStatus === 'CASCADE_RUN_STATUS_IDLE') {
                        // Agent is truly idle — completed
                        if (agent.status !== SubAgentStatus.Completed && newSteps > 0) {
                            const prev = agent.status;
                            agent.status = SubAgentStatus.Completed;
                            agent.completedAt = Date.now();
                            agent.stepCount = newSteps;
                            this._staleCycles.delete(agent.id);
                            this._out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: IDLE -> Completed (was ${prev}, steps=${newSteps})`);
                            this._fire(agent, 'completed', prev);
                            continue;
                        }
                    }

                    if (trajStatus === 'CASCADE_RUN_STATUS_RUNNING' && !hasWaitingSteps) {
                        // Actively running — if was WaitingForAction, switch back to Running
                        if (agent.status === SubAgentStatus.WaitingForAction) {
                            const prev = agent.status;
                            agent.status = SubAgentStatus.Running;
                            this._out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: RUNNING (was WaitingForAction) -> Running`);
                            this._fire(agent, 'status_change', prev);
                        }
                    }
                }

                // ─── Step tracking + stale fallback ───
                const prevSteps = this._lastStepCounts.get(agent.id) ?? 0;
                if (newSteps > prevSteps) {
                    agent.stepCount = newSteps;
                    this._lastStepCounts.set(agent.id, newSteps);
                    this._staleCycles.set(agent.id, 0);
                    this._out.appendLine(`[PROGRESS] ${agent.id.substring(0, 8)}: steps ${prevSteps} -> ${newSteps}`);
                    this._fire(agent, 'progress');
                } else if (newSteps > 0 && !hasWaitingSteps) {
                    // Steps unchanged and NOT waiting for user — increment stale
                    const stale = (this._staleCycles.get(agent.id) ?? 0) + 1;
                    this._staleCycles.set(agent.id, stale);

                    // NEVER stale-complete if LS explicitly says RUNNING — trust the LS
                    if (trajStatus === 'CASCADE_RUN_STATUS_RUNNING') {
                        this._out.appendLine(`[STALE] ${agent.id.substring(0, 8)}: stale=${stale} (ignored, LS says RUNNING)`);
                    } else if (stale >= Orchestrator.STALE_THRESHOLD) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.Completed;
                        agent.completedAt = Date.now();
                        this._staleCycles.delete(agent.id);
                        this._out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: STALE ${stale} cycles -> Completed (was ${prev})`);
                        this._fire(agent, 'completed', prev);
                    } else {
                        this._out.appendLine(`[STALE] ${agent.id.substring(0, 8)}: stale=${stale}/${Orchestrator.STALE_THRESHOLD}, steps=${newSteps}`);
                    }
                }
            } catch {
                // Per-agent poll failure is non-fatal
            }
        }

        this._persistState();
    }

    /**
     * Extract pending action details from the trajectory summary's waitingSteps.
     * We do NOT call getConversation (it 404s for these cascade IDs).
     * Instead we extract everything from the trajectory summary directly.
     */
    private async _extractPendingAction(agent: ISubAgent, trajSummary: any): Promise<void> {
        const waitingSteps = trajSummary?.waitingSteps;
        if (!Array.isArray(waitingSteps) || waitingSteps.length === 0) return;

        // Log full structure for debugging
        this._out.appendLine(`[ACTION] ${agent.id.substring(0, 8)}: waitingSteps=${JSON.stringify(waitingSteps).substring(0, 500)}`);

        const firstWaiting = waitingSteps[0];

        // Extract trajectoryId — try multiple possible locations
        const trajId = trajSummary?.trajectoryId
            || firstWaiting?.trajectoryId
            || agent.id; // ultimate fallback

        // Extract stepIndex from the waiting step data
        const stepIdx = firstWaiting?.stepIndex
            ?? firstWaiting?.index
            ?? firstWaiting?.step_index
            ?? (typeof firstWaiting === 'number' ? firstWaiting : undefined);

        // Try to extract action details from the waiting step object
        let actionType = 'unknown';
        let target = 'Needs approval';

        if (firstWaiting && typeof firstWaiting === 'object') {
            // Check for step type/content in the waiting step itself
            const stepType = firstWaiting.type || firstWaiting.stepType || '';

            if (stepType.includes('RUN_COMMAND') || firstWaiting.runCommand) {
                actionType = 'command';
                const cmd = firstWaiting.runCommand || firstWaiting.command || {};
                target = cmd.commandLine || cmd.proposedCommandLine || cmd.CommandLine || 'command';
            } else if (stepType.includes('CODE_ACTION') || firstWaiting.codeAction) {
                actionType = 'edit';
                target = 'file edit';
            } else if (firstWaiting.requestedInteraction?.permission) {
                const res = firstWaiting.requestedInteraction.permission.resource;
                if (res) {
                    actionType = res.action || 'unknown';
                    target = res.target || 'Needs approval';
                }
            }

            // Check for description/summary/title
            if (target === 'Needs approval') {
                target = firstWaiting.description
                    || firstWaiting.summary
                    || firstWaiting.title
                    || firstWaiting.label
                    || 'Needs approval';
            }
        }

        agent.pendingAction = {
            trajectoryId: trajId,
            stepIndex: stepIdx !== undefined ? stepIdx : -1,
            actionType,
            target,
        };

        this._out.appendLine(`[ACTION] ${agent.id.substring(0, 8)}: pendingAction set: type=${actionType}, target="${target}", trajId=${trajId.substring(0, 8)}, step=${stepIdx ?? -1}`);
        this._fire(agent, 'action_required');
    }

    /**
     * Check actual conversation status via LS RPC for accurate state detection.
     * This catches cases where step count doesn't change but the cascade is done.
     */
    private async _checkConversationStatuses(agents: ISubAgent[]): Promise<void> {
        for (const agent of agents) {
            try {
                const conv = await this._sdk.ls.getConversation(agent.id);
                if (!conv) continue;

                // Check for terminal state in the conversation data
                const status = conv.status || conv.state;
                if (status === 'completed' || status === 'done') {
                    if (agent.status !== SubAgentStatus.Completed) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.Completed;
                        agent.completedAt = Date.now();
                        this._fire(agent, 'completed', prev);
                    }
                } else if (status === 'failed' || status === 'error') {
                    if (agent.status !== SubAgentStatus.Failed) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.Failed;
                        agent.completedAt = Date.now();
                        agent.error = conv.error || 'Cascade failed';
                        this._fire(agent, 'status_change', prev);
                    }
                } else if (status === 'waiting_for_user' || status === 'paused') {
                    if (agent.status !== SubAgentStatus.WaitingForAction) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.WaitingForAction;
                        this._fire(agent, 'action_required', prev);
                    }
                }
            } catch {
                // getConversation may fail for very new cascades
            }
        }
        this._persistState();
    }

    // ─── Tagging & Annotations ──────────────────────────────────────────

    /**
     * Tag a sub-agent cascade with metadata for identification.
     */
    private async _tagSubAgent(
        cascadeId: string,
        label: string,
        batchId: string,
        index: number,
        total: number,
    ): Promise<void> {
        try {
            const modelLabel = MODEL_LABELS[this._agents.get(cascadeId)?.model || Models.GEMINI_FLASH] || '?';

            await this._sdk.ls.updateAnnotations(cascadeId, {
                title: `🔹 ${label} [${modelLabel}]`,
                tags: ['subagent', batchId, `${index}/${total}`],
            });
        } catch {
            // Annotation failures are non-critical
        }
    }

    // ─── Parent Detection ───────────────────────────────────────────────

    /**
     * Try to detect the currently active cascade ID to use as parent.
     */
    private async _detectParentId(): Promise<string> {
        try {
            const raw = await vscode.commands.executeCommand<string>('antigravity.getDiagnostics');
            if (raw && typeof raw === 'string') {
                const diag = JSON.parse(raw);
                if (Array.isArray(diag.recentTrajectories) && diag.recentTrajectories.length > 0) {
                    return diag.recentTrajectories[0].googleAgentId || 'unknown';
                }
            }
        } catch { /* noop */ }
        return 'unknown';
    }

    // ─── Event Firing ───────────────────────────────────────────────────

    private _fire(agent: ISubAgent, type: ISubAgentEvent['type'], previousStatus?: SubAgentStatus): void {
        this._onEvent.fire({ agent, type, previousStatus });

        // On completion (by monitoring), check if batch delivery should trigger.
        // This handles agents that complete WITHOUT calling send_message.
        if (type === 'completed') {
            // Store a fallback result from trajectory if agent didn't send_message
            if (!agent.hasSentMessage) {
                this._storeTrajectoryResult(agent).catch(e =>
                    this._out.appendLine(`[REPORT] Error storing trajectory result: ${e?.message}`));
            }
            this._checkBatchDelivery(agent.batchId);
        }
    }

    // ─── Messaging System ───────────────────────────────────────────────

    /**
     * Receive a send_message call from a sub-agent.
     * Buffers the message and checks if the batch is ready for delivery.
     *
     * Flow:
     * 1. Sub-agent calls send_message MCP tool
     * 2. MCP server → bridge → this method
     * 3. Message is buffered per-batch
     * 4. When ALL agents in the batch are terminal (completed/failed/cancelled)
     *    AND at least one completed (sent a message), deliver consolidated report
     */
    async sendMessage(agentId: string, parentId: string, message: string): Promise<{ buffered: boolean; delivered: boolean }> {
        // Find the agent by cascade ID
        const agent = this._agents.get(agentId);
        if (!agent) {
            this._out.appendLine(`[MSG] send_message from unknown agent ${agentId.substring(0, 8)}`);
            // Try to find by iterating — agent might have sent from a slightly different context
            return { buffered: false, delivered: false };
        }

        // Mark agent as having sent a message
        agent.hasSentMessage = true;
        agent.result = message;
        this._persistState();

        const batchId = agent.batchId;
        this._out.appendLine(`[MSG] send_message from ${agent.label} (${agentId.substring(0, 8)}) batch=${batchId.substring(0, 12)}`);

        // Get or create message buffer for this batch
        let buffer = this._messageBuffers.get(batchId);
        if (!buffer) {
            buffer = {
                batchId,
                parentId,
                messages: [],
                delivered: false,
            };
            this._messageBuffers.set(batchId, buffer);
        }

        // Add the message to the buffer
        buffer.messages.push({
            agentId,
            parentId,
            message,
            timestamp: Date.now(),
        });

        this._out.appendLine(`[MSG] Buffered (${buffer.messages.length} messages in batch)`);

        // Check if we can deliver now
        const delivered = await this._checkBatchDelivery(batchId);
        return { buffered: true, delivered };
    }

    /**
     * Check if a batch is ready for consolidated delivery.
     * Triggers when ALL agents are terminal AND at least one completed with a message.
     */
    private async _checkBatchDelivery(batchId: string): Promise<boolean> {
        // Already delivered? Skip.
        if (this._deliveredBatches.has(batchId)) return false;

        const batchAgents = this.getByBatch(batchId);
        if (batchAgents.length === 0) return false;

        // All agents must be terminal
        const allTerminal = batchAgents.every(a => isTerminalStatus(a.status));
        if (!allTerminal) {
            const terminalCount = batchAgents.filter(a => isTerminalStatus(a.status)).length;
            this._out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: ${terminalCount}/${batchAgents.length} terminal — waiting`);
            return false;
        }

        // At least one must have completed (not all cancelled/failed)
        const hasCompleted = batchAgents.some(a => a.status === SubAgentStatus.Completed);
        if (!hasCompleted) {
            // All cancelled or failed — check if all parent-stopped (silent)
            const allParentStopped = batchAgents.every(a =>
                a.status === SubAgentStatus.Cancelled && a.error?.includes('PARENT_STOPPED')
            );
            if (allParentStopped) {
                this._out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: all parent-stopped, skipping delivery`);
                this._deliveredBatches.add(batchId);
                return false;
            }
            // All user-cancelled or failed — still deliver a status report
            this._out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: no completions, delivering status report`);
        }

        // Deliver!
        this._deliveredBatches.add(batchId);
        await this._deliverBatchReport(batchId, batchAgents);
        return true;
    }

    /**
     * Deliver consolidated batch report to the parent agent.
     * Combines buffered send_message results with status info for non-reporting agents.
     */
    private async _deliverBatchReport(batchId: string, batchAgents: ISubAgent[]): Promise<void> {
        const parentId = batchAgents[0]?.parentId;
        if (!parentId || parentId === 'unknown') {
            this._out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: no valid parentId, skipping`);
            return;
        }

        const buffer = this._messageBuffers.get(batchId);
        const lines: string[] = [];

        lines.push(`## Sub-Agent Batch Complete\n`);

        const hasCancelled = batchAgents.some(a => a.status === SubAgentStatus.Cancelled);
        if (hasCancelled) {
            lines.push(`> **Note**: Some agents were stopped. Do not relaunch cancelled agents unless asked.\n`);
        }

        for (const a of batchAgents) {
            const icon = a.status === SubAgentStatus.Completed ? '✅'
                : a.status === SubAgentStatus.Cancelled ? '🚫'
                : '❌';

            lines.push(`### ${icon} ${a.label}`);
            lines.push(`- **Status**: ${a.status} | **Steps**: ${a.stepCount}`);

            // Use buffered message if available, else trajectory result, else fallback
            const bufferedMsg = buffer?.messages.find(m => m.agentId === a.id);
            if (bufferedMsg) {
                lines.push(`- **Result**: ${bufferedMsg.message}`);
            } else if (a.result) {
                lines.push(`- **Result**: ${a.result}`);
            } else if (a.status === SubAgentStatus.Cancelled) {
                lines.push(`- **Result**: Stopped`);
            } else if (a.status === SubAgentStatus.Failed) {
                lines.push(`- **Result**: Failed — ${a.error || 'Unknown error'}`);
            } else {
                lines.push(`- **Result**: Completed (no details reported)`);
            }
            lines.push('');
        }

        const report = lines.join('\n');
        this._out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)} → parent ${parentId.substring(0, 8)} (${batchAgents.length} agents)`);

        try {
            await this._sdk.ls.rawRPC('SendUserCascadeMessage', {
                cascadeId: parentId,
                items: [{ text: report }],
                cascadeConfig: {
                    plannerConfig: {
                        google: {},
                        requestedModel: { model: Models.GEMINI_FLASH },
                    },
                },
            });
            this._out.appendLine(`[DELIVERY] Report sent to parent successfully`);
        } catch (err: any) {
            this._out.appendLine(`[DELIVERY] Failed to send report: ${err?.message}`);
        }
    }

    /**
     * For agents that complete without calling send_message,
     * try to grab a result summary from their trajectory data.
     */
    private async _storeTrajectoryResult(agent: ISubAgent): Promise<void> {
        if (agent.result) return; // Already has a result

        try {
            const trajs = await this._sdk.ls.listCascades();
            if (trajs && trajs[agent.id]) {
                agent.result = trajs[agent.id].summary || `Completed with ${agent.stepCount} steps`;
            } else {
                agent.result = `Completed with ${agent.stepCount} steps`;
            }
            this._persistState();
        } catch {
            agent.result = `Completed with ${agent.stepCount} steps`;
        }
    }

    /**
     * Check if a given cascade ID belongs to a sub-agent we manage.
     */
    isSubAgent(cascadeId: string): boolean {
        return this._agents.has(cascadeId);
    }

    /**
     * Check if a given cascade ID is a parent that has active sub-agents.
     */
    hasActiveSubAgents(parentId: string): boolean {
        return this.getAll().some(a => a.parentId === parentId && isActiveStatus(a.status));
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
            // (we lost tracking of them)
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

    // ─── Utilities ──────────────────────────────────────────────────────

    private _delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    dispose(): void {
        this._stopMonitoring();
        this._persistState();
        for (const d of this._disposables) d.dispose();
    }
}
