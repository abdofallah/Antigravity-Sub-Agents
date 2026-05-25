/**
 * MCP Bridge Request Handlers
 *
 * Individual HTTP endpoint handlers for the MCP bridge.
 * Each handler processes one type of request from the MCP server script.
 *
 * @module mcp/handlers
 */

import * as vscode from 'vscode';
import { Models } from 'antigravity-sdk';
import { Orchestrator } from '../orchestrator';
import { MODEL_NAMES, STATUS_ICONS, isActiveStatus, ISubAgent } from '../types';

// ─── Model Resolution ───────────────────────────────────────────────────

export function resolveModel(name: string): number {
    const map: Record<string, number> = {
        'flash': Models.GEMINI_FLASH,
        'pro-low': Models.GEMINI_PRO_LOW,
        'pro-high': Models.GEMINI_PRO_HIGH,
        'sonnet': Models.CLAUDE_SONNET,
        'opus': Models.CLAUDE_OPUS,
        'gpt': Models.GPT_OSS,
    };
    return map[name.toLowerCase()] || Models.GEMINI_FLASH;
}

// ─── Agent Formatting ───────────────────────────────────────────────────

export function formatAgent(a: ISubAgent): any {
    return {
        id: a.id,
        label: a.label,
        status: a.status,
        icon: STATUS_ICONS[a.status],
        model: MODEL_NAMES[a.model] || 'unknown',
        stepCount: a.stepCount,
        task: a.task.substring(0, 200),
        batchId: a.batchId,
        createdAt: new Date(a.createdAt).toISOString(),
        completedAt: a.completedAt ? new Date(a.completedAt).toISOString() : null,
        error: a.error || null,
        hasSentMessage: a.hasSentMessage || false,
    };
}

// ─── Endpoint Handlers ──────────────────────────────────────────────────

export async function handleLaunch(orchestrator: Orchestrator, body: any): Promise<any> {
    const tasks: string[] = body.tasks || [];
    if (tasks.length === 0) {
        return { error: 'No tasks provided' };
    }

    // Support per-agent models: string → single model for all, array → per-agent
    // Fall back to the configured default model from extension settings
    const defaultModelSetting = vscode.workspace.getConfiguration('subagents').get('defaultModel', 'flash');
    let model: number | number[];
    if (Array.isArray(body.model)) {
        model = body.model.map((m: string) => resolveModel(m || defaultModelSetting));
    } else {
        model = resolveModel(body.model || defaultModelSetting);
    }

    const result = await orchestrator.launch({
        tasks,
        labels: body.labels,
        model,
        description: body.description || `${tasks.length} sub-agents`,
        workspaceUri: body.workspaceUri,
    });

    return {
        success: true,
        batchId: result.batchId,
        launched: result.ids.length,
        ids: result.ids,
        message: `Launched ${result.ids.length} sub-agents`,
    };
}

export async function handleCancel(orchestrator: Orchestrator, body: any): Promise<any> {
    const id = body.id;
    if (!id) return { error: 'No id provided' };

    await orchestrator.cancel(id);
    return {
        success: true,
        cancelled: true,
        message: `Sub-agent ${id} has been stopped.`,
    };
}

export function handleStatus(orchestrator: Orchestrator): any {
    const agents = orchestrator.getAll();
    return {
        total: agents.length,
        active: agents.filter(a => isActiveStatus(a.status)).length,
        agents: agents.map(a => formatAgent(a)),
    };
}

export function handleGetAgent(orchestrator: Orchestrator, body: any): any {
    const id = body.id;
    if (!id) return { error: 'No id provided' };

    const agent = orchestrator.get(id);
    if (!agent) return { error: `Sub-agent ${id} not found` };

    return formatAgent(agent);
}

export function handleGetBatch(orchestrator: Orchestrator, body: any): any {
    const batchId = body.batchId;
    if (!batchId) return { error: 'No batchId provided' };

    const batch = orchestrator.getBatch(batchId);
    if (!batch) return { error: `Batch ${batchId} not found` };

    const agents = orchestrator.getByBatch(batchId);
    return {
        batchId: batch.id,
        parentId: batch.parentId,
        description: batch.description,
        createdAt: new Date(batch.createdAt).toISOString(),
        total: agents.length,
        active: agents.filter(a => isActiveStatus(a.status)).length,
        agents: agents.map(a => formatAgent(a)),
    };
}

export async function handleSendMessage(orchestrator: Orchestrator, body: any): Promise<any> {
    const { parentId, message } = body;
    if (!parentId) return { error: 'No parentId provided' };
    if (!message) return { error: 'No message provided' };

    // Detect senderId from the agents that match this parentId
    const agentId = body.agentId || detectSenderAgent(orchestrator, parentId);
    if (!agentId) {
        return {
            error: 'Could not determine which sub-agent is sending this message. '
                + 'Make sure the parentId is correct.',
        };
    }

    const result = await orchestrator.sendMessage(agentId, parentId, message);
    return {
        success: true,
        buffered: result.buffered,
        delivered: result.delivered,
        message: result.delivered
            ? 'Message delivered to parent agent (batch complete).'
            : 'Message buffered. Will be delivered when all agents in the batch finish.',
    };
}

export async function handleApproveAction(orchestrator: Orchestrator, body: any): Promise<any> {
    const id = body.id;
    if (!id) return { error: 'No id provided' };
    await orchestrator.approveAction(id);
    return { success: true, message: `Action approved for ${id}` };
}

export async function handleRespondAction(orchestrator: Orchestrator, body: any): Promise<any> {
    const id = body.id;
    if (!id) return { error: 'No id provided' };
    await orchestrator.respondAction(id, body.message);
    return { success: true, message: `Responded to ${id}` };
}

export async function handleRejectAction(orchestrator: Orchestrator, body: any): Promise<any> {
    const id = body.id;
    if (!id) return { error: 'No id provided' };
    await orchestrator.rejectAction(id);
    return { success: true, message: `Action rejected for ${id}` };
}

// ─── Sender Detection ───────────────────────────────────────────────────

/**
 * Try to detect which sub-agent is calling send_message.
 * Since the MCP server runs per-LS (not per-cascade), we use heuristics:
 * - Find running agents that belong to this parentId
 * - If only one is running, it must be the sender
 * - If multiple are running, pick the one without a message yet
 */
export function detectSenderAgent(orchestrator: Orchestrator, parentId: string): string | null {
    const agents = orchestrator.getAll()
        .filter(a => a.parentId === parentId);

    // Active agents (running/waiting) that haven't sent a message yet
    const candidates = agents.filter(a =>
        isActiveStatus(a.status) && !a.hasSentMessage
    );

    if (candidates.length === 1) return candidates[0].id;

    // If multiple candidates, prefer the one that's been running longest
    // (it's most likely to be done and sending results)
    if (candidates.length > 1) {
        candidates.sort((a, b) => a.createdAt - b.createdAt);
        return candidates[0].id;
    }

    // Fallback: any agent with this parent that hasn't sent a message
    const fallback = agents.find(a => !a.hasSentMessage);
    return fallback?.id || null;
}
