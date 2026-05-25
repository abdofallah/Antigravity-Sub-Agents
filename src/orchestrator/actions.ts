/**
 * Orchestrator Actions
 *
 * Handles cancel, approve, respond, reject, and view chat actions.
 *
 * @module orchestrator/actions
 */

import * as vscode from 'vscode';
import { AntigravitySDK } from 'antigravity-sdk';
import {
    ISubAgent,
    ISubAgentEvent,
    SubAgentStatus,
    isActiveStatus,
    isTerminalStatus,
} from '../types';

/** Shared state context passed from the Orchestrator class */
export interface ActionContext {
    sdk: AntigravitySDK;
    agents: Map<string, ISubAgent>;
    out: vscode.OutputChannel;
    fire: (agent: ISubAgent, type: ISubAgentEvent['type'], previousStatus?: SubAgentStatus) => void;
    persistState: () => void;
    getAll: () => ISubAgent[];
    getActive: () => ISubAgent[];
    getByBatch: (batchId: string) => ISubAgent[];
    checkBatchDelivery: (batchId: string) => Promise<boolean>;
}

/**
 * Cancel a running sub-agent (user-initiated).
 * Silent — no report is sent to the parent agent.
 */
export async function cancel(ctx: ActionContext, id: string): Promise<void> {
    const agent = ctx.agents.get(id);
    if (!agent || isTerminalStatus(agent.status)) return;

    try {
        await ctx.sdk.ls.cancelCascade(id);
    } catch {
        // May already be done
    }

    const prev = agent.status;
    agent.status = SubAgentStatus.Cancelled;
    agent.completedAt = Date.now();
    agent.error = 'Stopped by user';
    ctx.fire(agent, 'status_change', prev);
    ctx.persistState();

    // Check if this completes a batch → trigger buffered delivery
    ctx.checkBatchDelivery(agent.batchId);
}

/**
 * Cancel a sub-agent silently (parent-initiated).
 * No USER_CANCELLED flag, no batch report will fire.
 */
async function cancelSilent(ctx: ActionContext, id: string): Promise<void> {
    const agent = ctx.agents.get(id);
    if (!agent || isTerminalStatus(agent.status)) return;

    try {
        await ctx.sdk.ls.cancelCascade(id);
    } catch {
        // May already be done
    }

    const prev = agent.status;
    agent.status = SubAgentStatus.Cancelled;
    agent.completedAt = Date.now();
    agent.error = 'PARENT_STOPPED: Parent agent execution was stopped by the user.';
    ctx.fire(agent, 'status_change', prev);
}

/**
 * Cancel all active sub-agents belonging to a specific parent cascade.
 * Called automatically when a parent cascade is cancelled.
 * Silent — no batch report, no user-cancel flag.
 */
export async function cancelByParent(ctx: ActionContext, parentId: string): Promise<void> {
    const children = ctx.getAll().filter(a => a.parentId === parentId && isActiveStatus(a.status));
    if (children.length === 0) return;

    ctx.out.appendLine(`[PARENT_STOP] Parent ${parentId.substring(0, 8)} stopped — cancelling ${children.length} sub-agents silently`);
    await Promise.allSettled(children.map(a => cancelSilent(ctx, a.id)));
    ctx.persistState();
}

/**
 * Cancel all active sub-agents.
 */
export async function cancelAll(ctx: ActionContext): Promise<void> {
    const active = ctx.getActive();
    await Promise.allSettled(active.map(a => cancel(ctx, a.id)));
}

/**
 * Cancel all active sub-agents in a specific batch.
 */
export async function cancelBatch(ctx: ActionContext, batchId: string): Promise<void> {
    const batchAgents = ctx.getByBatch(batchId).filter(a => isActiveStatus(a.status));
    await Promise.allSettled(batchAgents.map(a => cancel(ctx, a.id)));
}

/**
 * Focus the UI on a sub-agent's chat.
 * Uses LSBridge RPC first, falls back to VS Code command.
 */
export async function viewChat(ctx: ActionContext, id: string): Promise<void> {
    try {
        // Primary: LS RPC — SmartFocusConversation
        await ctx.sdk.ls.focusCascade(id);
    } catch {
        // Fallback: VS Code command to switch visible conversation
        try {
            await vscode.commands.executeCommand('antigravity.setVisibleConversation', id);
        } catch {
            // Last resort: open agent panel and try again
            await vscode.commands.executeCommand('antigravity.agentPanel.open');
            await new Promise(r => setTimeout(r, 500));
            await vscode.commands.executeCommand('antigravity.setVisibleConversation', id);
        }
    }
}

/**
 * Approve (Run) a pending action on a sub-agent.
 */
export async function approveAction(ctx: ActionContext, id: string): Promise<void> {
    const agent = ctx.agents.get(id);
    if (!agent || !agent.pendingAction) {
        ctx.out.appendLine(`[APPROVE] ${id.substring(0, 8)}: no pending action`);
        return;
    }
    const { trajectoryId, stepIndex, target } = agent.pendingAction;
    ctx.out.appendLine(`[APPROVE] ${id.substring(0, 8)}: traj=${trajectoryId.substring(0, 8)}, step=${stepIndex}, target=${target}`);

    try {
        await ctx.sdk.ls.rawRPC('HandleCascadeUserInteraction', {
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

        agent.pendingAction = undefined;
        const prev = agent.status;
        agent.status = SubAgentStatus.Running;
        ctx.out.appendLine(`[APPROVE] ${id.substring(0, 8)}: action approved, status -> Running`);
        ctx.fire(agent, 'status_change', prev);
        ctx.persistState();
    } catch (err: any) {
        ctx.out.appendLine(`[APPROVE] ${id.substring(0, 8)}: FAILED: ${err?.message}`);
    }
}

/**
 * Respond "No" with a custom message — rejects the single permission
 * but does NOT cancel the cascade, allowing the agent to adapt.
 */
export async function respondAction(ctx: ActionContext, id: string, message?: string): Promise<void> {
    const agent = ctx.agents.get(id);
    if (!agent || !agent.pendingAction) {
        ctx.out.appendLine(`[RESPOND] ${id.substring(0, 8)}: no pending action`);
        return;
    }
    const { trajectoryId, stepIndex, target } = agent.pendingAction;
    const msg = message || 'No, do not run this command.';
    ctx.out.appendLine(`[RESPOND] ${id.substring(0, 8)}: traj=${trajectoryId.substring(0, 8)}, step=${stepIndex}, msg="${msg}"`);

    try {
        await ctx.sdk.ls.rawRPC('HandleCascadeUserInteraction', {
            cascadeId: id,
            interaction: {
                trajectoryId,
                stepIndex,
                permission: {
                    scope: 'PERMISSION_SCOPE_ONCE',
                },
            },
        });

        await ctx.sdk.ls.rawRPC('SendUserCascadeMessage', {
            cascadeId: id,
            message: msg,
        });

        agent.pendingAction = undefined;
        const prev = agent.status;
        agent.status = SubAgentStatus.Running;
        ctx.out.appendLine(`[RESPOND] ${id.substring(0, 8)}: denied with message, status -> Running`);
        ctx.fire(agent, 'status_change', prev);
        ctx.persistState();
    } catch (err: any) {
        ctx.out.appendLine(`[RESPOND] ${id.substring(0, 8)}: FAILED: ${err?.message}`);
    }
}

/**
 * Reject (Cancel) — hard reject: denies the permission AND cancels the cascade entirely.
 */
export async function rejectAction(ctx: ActionContext, id: string): Promise<void> {
    const agent = ctx.agents.get(id);
    if (!agent || !agent.pendingAction) {
        ctx.out.appendLine(`[REJECT] ${id.substring(0, 8)}: no pending action`);
        return;
    }
    const { trajectoryId, stepIndex, target } = agent.pendingAction;
    ctx.out.appendLine(`[REJECT] ${id.substring(0, 8)}: traj=${trajectoryId.substring(0, 8)}, step=${stepIndex}, target=${target}`);

    try {
        await ctx.sdk.ls.rawRPC('HandleCascadeUserInteraction', {
            cascadeId: id,
            interaction: {
                trajectoryId,
                stepIndex,
                permission: {
                    scope: 'PERMISSION_SCOPE_ONCE',
                },
            },
        });

        await ctx.sdk.ls.rawRPC('CancelCascadeInvocation', {
            cascadeId: id,
        });

        agent.pendingAction = undefined;
        const prev = agent.status;
        agent.status = SubAgentStatus.Cancelled;
        agent.completedAt = Date.now();
        ctx.out.appendLine(`[REJECT] ${id.substring(0, 8)}: rejected & cancelled`);
        ctx.fire(agent, 'status_change', prev);
        ctx.persistState();
    } catch (err: any) {
        ctx.out.appendLine(`[REJECT] ${id.substring(0, 8)}: FAILED: ${err?.message}`);
    }
}

/**
 * Clear completed/failed/cancelled sub-agents from history.
 */
export function clearHistory(ctx: ActionContext): void {
    for (const [id, agent] of ctx.agents) {
        if (isTerminalStatus(agent.status)) {
            ctx.agents.delete(id);
        }
    }
    ctx.persistState();
}
