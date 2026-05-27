/**
 * Orchestrator Messaging
 *
 * Handles send_message buffering, batch delivery checks,
 * consolidated report generation, and trajectory result storage.
 *
 * @module orchestrator/messaging
 */

import { AntigravitySDK, Models } from 'antigravity-sdk';
import * as vscode from 'vscode';
import {
    ISubAgent,
    ISubAgentBatch,
    IBufferedMessage,
    IMessageBuffer,
    SubAgentStatus,
    isTerminalStatus,
    IDE_CANCELLED_ERROR,
} from '../types';

/** Shared state context passed from the Orchestrator class */
export interface MessagingContext {
    sdk: AntigravitySDK;
    agents: Map<string, ISubAgent>;
    batches: Map<string, ISubAgentBatch>;
    messageBuffers: Map<string, IMessageBuffer>;
    deliveredBatches: Set<string>;
    out: vscode.OutputChannel;
    persistState: () => void;
    getByBatch: (batchId: string) => ISubAgent[];
}

/**
 * Receive a send_message call from a sub-agent.
 * Buffers the message and checks if the batch is ready for delivery.
 */
export async function sendMessage(
    ctx: MessagingContext,
    agentId: string,
    parentId: string,
    message: string,
): Promise<{ buffered: boolean; delivered: boolean }> {
    const agent = ctx.agents.get(agentId);
    if (!agent) {
        ctx.out.appendLine(`[MSG] send_message from unknown agent ${agentId.substring(0, 8)}`);
        return { buffered: false, delivered: false };
    }

    // Mark agent as having sent a message
    agent.hasSentMessage = true;
    agent.result = message;
    ctx.persistState();

    const batchId = agent.batchId;
    ctx.out.appendLine(`[MSG] send_message from ${agent.label} (${agentId.substring(0, 8)}) batch=${batchId.substring(0, 12)}`);

    // Get or create message buffer for this batch
    let buffer = ctx.messageBuffers.get(batchId);
    if (!buffer) {
        buffer = {
            batchId,
            parentId,
            messages: [],
            delivered: false,
        };
        ctx.messageBuffers.set(batchId, buffer);
    }

    // Add the message to the buffer
    buffer.messages.push({
        agentId,
        parentId,
        message,
        timestamp: Date.now(),
    });

    ctx.out.appendLine(`[MSG] Buffered (${buffer.messages.length} messages in batch)`);

    // Check if we can deliver now
    const delivered = await checkBatchDelivery(ctx, batchId);
    return { buffered: true, delivered };
}

/**
 * Check if a batch is ready for consolidated delivery.
 * Triggers when ALL agents are terminal AND at least one completed with a message.
 */
export async function checkBatchDelivery(ctx: MessagingContext, batchId: string): Promise<boolean> {
    // Already delivered? Skip.
    if (ctx.deliveredBatches.has(batchId)) return false;

    const batchAgents = ctx.getByBatch(batchId);
    if (batchAgents.length === 0) return false;

    // All agents must be terminal
    const allTerminal = batchAgents.every(a => isTerminalStatus(a.status));
    if (!allTerminal) {
        const terminalCount = batchAgents.filter(a => isTerminalStatus(a.status)).length;
        ctx.out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: ${terminalCount}/${batchAgents.length} terminal — waiting`);
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
            ctx.out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: all parent-stopped, skipping delivery`);
            ctx.deliveredBatches.add(batchId);
            return false;
        }
        // All IDE-cancelled on restart (silent — sub-agents never ran the work)
        const allIdeCancelled = batchAgents.every(a =>
            a.status === SubAgentStatus.Cancelled && a.error === IDE_CANCELLED_ERROR
        );
        if (allIdeCancelled) {
            ctx.out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: all IDE-cancelled on restart, skipping delivery`);
            ctx.deliveredBatches.add(batchId);
            return false;
        }
        // All user-cancelled or failed — still deliver a status report
        ctx.out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: no completions, delivering status report`);
    }

    // Deliver!
    ctx.deliveredBatches.add(batchId);
    await deliverBatchReport(ctx, batchId, batchAgents);
    return true;
}

/**
 * Deliver consolidated batch report to the parent agent.
 * Combines buffered send_message results with status info for non-reporting agents.
 */
async function deliverBatchReport(ctx: MessagingContext, batchId: string, batchAgents: ISubAgent[]): Promise<void> {
    const parentId = batchAgents[0]?.parentId;
    if (!parentId || parentId === 'unknown') {
        ctx.out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)}: no valid parentId, skipping`);
        return;
    }

    const buffer = ctx.messageBuffers.get(batchId);
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
    ctx.out.appendLine(`[DELIVERY] Batch ${batchId.substring(0, 12)} → parent ${parentId.substring(0, 8)} (${batchAgents.length} agents)`);

    try {
        await ctx.sdk.ls.rawRPC('SendUserCascadeMessage', {
            cascadeId: parentId,
            items: [{ text: report }],
            cascadeConfig: {
                plannerConfig: {
                    google: {},
                    requestedModel: { model: Models.GEMINI_FLASH },
                },
            },
        });
        ctx.out.appendLine(`[DELIVERY] Report sent to parent successfully`);
    } catch (err: any) {
        ctx.out.appendLine(`[DELIVERY] Failed to send report: ${err?.message}`);
    }
}

/**
 * For agents that complete without calling send_message,
 * try to grab a result summary from their trajectory data.
 */
export async function storeTrajectoryResult(ctx: MessagingContext, agent: ISubAgent): Promise<void> {
    if (agent.result) return; // Already has a result

    try {
        const trajs = await ctx.sdk.ls.listCascades();
        if (trajs && trajs[agent.id]) {
            agent.result = trajs[agent.id].summary || `Completed with ${agent.stepCount} steps`;
        } else {
            agent.result = `Completed with ${agent.stepCount} steps`;
        }
        ctx.persistState();
    } catch {
        agent.result = `Completed with ${agent.stepCount} steps`;
    }
}
