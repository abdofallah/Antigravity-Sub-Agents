/**
 * Orchestrator Launcher
 *
 * Handles workspace discovery, cascade creation, tagging, and archiving
 * for new sub-agent launches.
 *
 * @module orchestrator/launcher
 */

import * as vscode from 'vscode';
import { AntigravitySDK, Models, ModelId } from 'antigravity-sdk';
import {
    ISubAgent,
    ISubAgentBatch,
    ILaunchConfig,
    SubAgentStatus,
    MODEL_LABELS,
    generateBatchId,
} from '../types';

/** Shared state context passed from the Orchestrator class */
export interface LaunchContext {
    sdk: AntigravitySDK;
    context: vscode.ExtensionContext;
    agents: Map<string, ISubAgent>;
    batches: Map<string, ISubAgentBatch>;
    out: vscode.OutputChannel;
    fire: (agent: ISubAgent, type: 'created' | 'status_change', previousStatus?: SubAgentStatus) => void;
    persistState: () => void;
    ensureMonitoring: () => void;
}

/**
 * Launch a batch of sub-agents.
 * Creates N headless cascades via the SDK, tags them,
 * and starts monitoring their progress.
 */
export async function launchBatch(
    ctx: LaunchContext,
    config: ILaunchConfig,
): Promise<{ batchId: string; ids: string[] }> {
    const batchId = generateBatchId();
    const parentId = config.parentId || await detectParentId();
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
    ctx.batches.set(batchId, batch);

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
            let workspaceUris: string[] = [];

            // Path 0: Explicit from calling agent (most reliable)
            if (config.workspaceUri) {
                workspaceUris = [config.workspaceUri];
                ctx.out.appendLine(`[LAUNCH] workspace from explicit config: ${JSON.stringify(workspaceUris)}`);
            }

            // Path 1-3: Look up from parent trajectory if not already set
            if (workspaceUris.length === 0) try {
                const trajSummaries = await ctx.sdk.ls.listCascades();
                if (trajSummaries && trajSummaries[parentId]) {
                    const parentTraj = trajSummaries[parentId];
                    ctx.out.appendLine(`[LAUNCH] parent traj keys: ${Object.keys(parentTraj).join(', ')}`);

                    // Path 1: trajectoryMetadata.workspaceUris (array of URI strings)
                    const meta = parentTraj.trajectoryMetadata;
                    if (meta?.workspaceUris && Array.isArray(meta.workspaceUris) && meta.workspaceUris.length > 0) {
                        workspaceUris = meta.workspaceUris;
                        ctx.out.appendLine(`[LAUNCH] workspace from meta.workspaceUris: ${JSON.stringify(workspaceUris)}`);
                    }
                    // Path 2: top-level workspaces array with workspaceFolderAbsoluteUri
                    else if (Array.isArray(parentTraj.workspaces) && parentTraj.workspaces.length > 0) {
                        workspaceUris = parentTraj.workspaces
                            .map((w: any) => w.workspaceFolderAbsoluteUri || w.uri)
                            .filter(Boolean);
                        ctx.out.appendLine(`[LAUNCH] workspace from traj.workspaces: ${JSON.stringify(workspaceUris)}`);
                    }
                    // Path 3: trajectoryMetadata.workspaces array
                    else if (meta?.workspaces && Array.isArray(meta.workspaces) && meta.workspaces.length > 0) {
                        workspaceUris = meta.workspaces
                            .map((w: any) => w.workspaceFolderAbsoluteUri || w.uri)
                            .filter(Boolean);
                        ctx.out.appendLine(`[LAUNCH] workspace from meta.workspaces: ${JSON.stringify(workspaceUris)}`);
                    } else {
                        ctx.out.appendLine(`[LAUNCH] no workspace found in parent traj. meta type=${typeof meta}, meta keys=${meta ? Object.keys(meta).join(',') : 'null'}`);
                    }
                } else {
                    ctx.out.appendLine(`[LAUNCH] parent ${parentId.substring(0, 8)} NOT in trajSummaries`);
                }
            } catch (e: any) {
                ctx.out.appendLine(`[LAUNCH] workspace lookup error: ${e?.message}`);
            }

            // Fallback: try active text editor's workspace, then first folder
            if (workspaceUris.length === 0) {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const wsFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
                    if (wsFolder) {
                        workspaceUris = [wsFolder.uri.toString()];
                        ctx.out.appendLine(`[LAUNCH] workspace from active editor: ${JSON.stringify(workspaceUris)}`);
                    }
                }
            }
            if (workspaceUris.length === 0) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                workspaceUris = workspaceFolders
                    ? [workspaceFolders[0].uri.toString()]
                    : [];
                ctx.out.appendLine(`[LAUNCH] workspace fallback to first folder: ${JSON.stringify(workspaceUris)}`);
            }

            // Pre-generate cascadeId like the Manager does
            const preGenId = crypto.randomUUID();

            const startPayload = {
                source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT',
                cascadeId: preGenId,
                workspaceUris,
            };
            ctx.out.appendLine(`[LAUNCH] StartCascade payload: ${JSON.stringify(startPayload)}`);

            const startResp = await ctx.sdk.ls.rawRPC('StartCascade', startPayload);
            ctx.out.appendLine(`[LAUNCH] StartCascade response: ${JSON.stringify(startResp).substring(0, 500)}`);
            const cascadeId = startResp?.cascadeId || preGenId;

            if (!cascadeId) {
                console.error(`[SubAgents] StartCascade returned no cascadeId:`, startResp);
                placeholder.status = SubAgentStatus.Failed;
                placeholder.error = 'StartCascade returned no cascadeId';
                placeholder.id = `failed-${Date.now()}-${index}`;
                ctx.agents.set(placeholder.id, placeholder);
                ctx.fire(placeholder, 'status_change');
                return;
            }

            ctx.out.appendLine(`[LAUNCH] Cascade created: ${cascadeId}`);

            // ─── Step 2: Send message matching Manager's proto3 JSON format ───
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

            ctx.out.appendLine(`[LAUNCH] SendUserCascadeMessage payload: ${JSON.stringify(sendPayload).substring(0, 400)}`);

            const sendResp = await ctx.sdk.ls.rawRPC('SendUserCascadeMessage', sendPayload);
            ctx.out.appendLine(`[LAUNCH] SendUserCascadeMessage response: ${JSON.stringify(sendResp).substring(0, 200)}`);

            // Update with real cascade ID
            placeholder.id = cascadeId;
            placeholder.status = SubAgentStatus.Running;
            ctx.agents.set(cascadeId, placeholder);
            batch.agentIds.push(cascadeId);
            createdIds.push(cascadeId);

            // Tag the cascade for identification
            await tagSubAgent(ctx, cascadeId, label, batchId, index + 1, config.tasks.length);

            // Archive the sub-agent chat so it doesn't clutter sidebar/history
            try {
                await ctx.sdk.ls.rawRPC('UpdateConversationAnnotations', {
                    cascadeId,
                    annotations: { archived: true },
                    mergeAnnotations: true,
                });
            } catch { /* non-critical */ }

            // Register with the IDE's trajectory index so it appears in the Manager
            try {
                await vscode.commands.executeCommand(
                    'antigravity.trackBackgroundConversationCreated',
                    cascadeId,
                );
                ctx.out.appendLine(`[TRACK] ${cascadeId.substring(0, 8)}: trackBackgroundConversationCreated OK`);
            } catch (trackErr: any) {
                ctx.out.appendLine(`[TRACK] ${cascadeId.substring(0, 8)}: trackBackgroundConversationCreated FAILED: ${trackErr?.message}`);
            }

            // Fire creation event
            ctx.fire(placeholder, 'created');

            launched++;

        } catch (err: any) {
            console.error(`[SubAgents] Launch FAILED: ${err?.message}`);
            console.error(`[SubAgents] Stack: ${err?.stack}`);
            placeholder.status = SubAgentStatus.Failed;
            placeholder.error = err?.message || 'Launch failed';
            placeholder.id = `failed-${Date.now()}-${index}`;
            ctx.agents.set(placeholder.id, placeholder);
            ctx.fire(placeholder, 'status_change');
        }
    };

    // Staggered launch with concurrency control
    for (let i = 0; i < config.tasks.length; i += concurrency) {
        const chunk = [];
        for (let j = i; j < Math.min(i + concurrency, config.tasks.length); j++) {
            chunk.push(launchOne(j));
            if (staggerMs > 0 && j < config.tasks.length - 1) {
                await delay(staggerMs);
            }
        }
        await Promise.allSettled(chunk);
    }

    ctx.persistState();

    // Start realtime monitoring if not already running
    ctx.ensureMonitoring();

    return { batchId, ids: createdIds };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Tag a sub-agent cascade with metadata for identification. */
async function tagSubAgent(
    ctx: LaunchContext,
    cascadeId: string,
    label: string,
    batchId: string,
    index: number,
    total: number,
): Promise<void> {
    try {
        const modelLabel = MODEL_LABELS[ctx.agents.get(cascadeId)?.model || Models.GEMINI_FLASH] || '?';

        await ctx.sdk.ls.updateAnnotations(cascadeId, {
            title: `🔹 ${label} [${modelLabel}]`,
            tags: ['subagent', batchId, `${index}/${total}`],
        });
    } catch {
        // Annotation failures are non-critical
    }
}

/** Try to detect the currently active cascade ID to use as parent. */
async function detectParentId(): Promise<string> {
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

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
