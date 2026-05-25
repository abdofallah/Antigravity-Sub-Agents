/**
 * Orchestrator Monitor
 *
 * Handles realtime polling of active sub-agents, step tracking,
 * stale detection, and pending action extraction.
 *
 * @module orchestrator/monitor
 */

import { AntigravitySDK, Models } from 'antigravity-sdk';
import * as vscode from 'vscode';
import {
    ISubAgent,
    ISubAgentEvent,
    SubAgentStatus,
    isActiveStatus,
} from '../types';

/** Shared state context passed from the Orchestrator class */
export interface MonitorContext {
    sdk: AntigravitySDK;
    agents: Map<string, ISubAgent>;
    out: vscode.OutputChannel;
    fire: (agent: ISubAgent, type: ISubAgentEvent['type'], previousStatus?: SubAgentStatus) => void;
    persistState: () => void;
    checkBatchDelivery: (batchId: string) => Promise<boolean>;
    storeTrajectoryResult: (agent: ISubAgent) => Promise<void>;
}

/** Stale detection threshold: if step count unchanged for this many cycles, mark as completed */
export const STALE_THRESHOLD = 10;

/** Internal tracking state for the monitor */
export interface MonitorState {
    /** Known step counts — used to detect deltas */
    lastStepCounts: Map<string, number>;
    /** Stale counter — tracks how many poll cycles steps haven't changed */
    staleCycles: Map<string, number>;
    /** Tracks which agents have been seen in trajectory summaries at least once */
    seenInTraj: Set<string>;
    /** Diagnostic poll cycle counter */
    pollDiagCount: number;
}

export function createMonitorState(): MonitorState {
    return {
        lastStepCounts: new Map(),
        staleCycles: new Map(),
        seenInTraj: new Set(),
        pollDiagCount: 0,
    };
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
export async function pollProgress(
    ctx: MonitorContext,
    state: MonitorState,
): Promise<boolean> {
    const active = Array.from(ctx.agents.values()).filter(a => isActiveStatus(a.status));
    if (active.length === 0) {
        return false; // Signal to stop monitoring
    }

    state.pollDiagCount = (state.pollDiagCount ?? 0) + 1;
    const cycle = state.pollDiagCount;

    // Always log to visible output channel
    ctx.out.appendLine(`\n── Poll cycle ${cycle} | ${active.length} active agents ──`);

    // Approach 1: Try to get trajectory summaries via listCascades
    let trajSummaries: Record<string, any> | null = null;
    try {
        trajSummaries = await ctx.sdk.ls.listCascades();
        ctx.out.appendLine(`[listCascades] ${trajSummaries ? Object.keys(trajSummaries).length : 0} entries`);

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
                ctx.out.appendLine(`[COMPARE${isAgent ? '-AGENT' : ''}] ${id.substring(0, 8)}: ${JSON.stringify(fieldDump)}`);
            }
        }
    } catch (err: any) {
        ctx.out.appendLine(`[listCascades] FAILED: ${err?.message}`);
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
                state.seenInTraj.add(agent.id);

                ctx.out.appendLine(`[traj] ${agent.id.substring(0, 8)}: status=${trajStatus}, steps=${newSteps}, waitingSteps=${hasWaitingSteps}`);
            } else if (state.seenInTraj.has(agent.id)) {
                // Agent was previously in trajectory list but is now gone → completed
                const prevSteps = state.lastStepCounts.get(agent.id) ?? 0;
                if (prevSteps > 0) {
                    const prev = agent.status;
                    agent.status = SubAgentStatus.Completed;
                    agent.completedAt = Date.now();
                    agent.stepCount = prevSteps;
                    state.staleCycles.delete(agent.id);
                    state.seenInTraj.delete(agent.id);
                    ctx.out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: VANISHED from traj -> Completed (was ${prev}, steps=${prevSteps})`);
                    ctx.fire(agent, 'completed', prev);
                    continue;
                }
                ctx.out.appendLine(`[traj] ${agent.id.substring(0, 8)}: vanished but no steps recorded`);
            } else {
                ctx.out.appendLine(`[traj] ${agent.id.substring(0, 8)}: NOT in trajSummaries (never seen)`);
            }

            // ─── State Detection (from trajectory summary) ───
            if (trajStatus) {
                if (hasWaitingSteps) {
                    // Agent is waiting for user approval
                    if (agent.status !== SubAgentStatus.WaitingForAction) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.WaitingForAction;
                        agent.stepCount = newSteps;
                        ctx.out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: waitingSteps -> WaitingForAction (was ${prev})`);
                        ctx.fire(agent, 'action_required', prev);
                    }

                    // Extract pending action details for remote approve/reject
                    if (!agent.pendingAction) {
                        try {
                            await extractPendingAction(ctx, agent, trajSummaries![agent.id]);
                        } catch (err: any) {
                            ctx.out.appendLine(`[ACTION] ${agent.id.substring(0, 8)}: failed to extract: ${err?.message}`);
                        }
                    }

                    state.staleCycles.set(agent.id, 0); // Reset stale — NOT stuck
                    state.lastStepCounts.set(agent.id, newSteps);
                    continue;
                } else if (agent.pendingAction) {
                    // No longer waiting — clear the pending action
                    agent.pendingAction = undefined;
                }

                if (trajStatus === 'CASCADE_RUN_STATUS_IDLE') {
                    if (agent.status !== SubAgentStatus.Completed && newSteps > 0) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.Completed;
                        agent.completedAt = Date.now();
                        agent.stepCount = newSteps;
                        state.staleCycles.delete(agent.id);
                        ctx.out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: IDLE -> Completed (was ${prev}, steps=${newSteps})`);
                        ctx.fire(agent, 'completed', prev);
                        continue;
                    }
                }

                if (trajStatus === 'CASCADE_RUN_STATUS_RUNNING' && !hasWaitingSteps) {
                    if (agent.status === SubAgentStatus.WaitingForAction) {
                        const prev = agent.status;
                        agent.status = SubAgentStatus.Running;
                        ctx.out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: RUNNING (was WaitingForAction) -> Running`);
                        ctx.fire(agent, 'status_change', prev);
                    }
                }
            }

            // ─── Step tracking + stale fallback ───
            const prevSteps = state.lastStepCounts.get(agent.id) ?? 0;
            if (newSteps > prevSteps) {
                agent.stepCount = newSteps;
                state.lastStepCounts.set(agent.id, newSteps);
                state.staleCycles.set(agent.id, 0);
                ctx.out.appendLine(`[PROGRESS] ${agent.id.substring(0, 8)}: steps ${prevSteps} -> ${newSteps}`);
                ctx.fire(agent, 'progress');
            } else if (newSteps > 0 && !hasWaitingSteps) {
                const stale = (state.staleCycles.get(agent.id) ?? 0) + 1;
                state.staleCycles.set(agent.id, stale);

                if (trajStatus === 'CASCADE_RUN_STATUS_RUNNING') {
                    ctx.out.appendLine(`[STALE] ${agent.id.substring(0, 8)}: stale=${stale} (ignored, LS says RUNNING)`);
                } else if (stale >= STALE_THRESHOLD) {
                    const prev = agent.status;
                    agent.status = SubAgentStatus.Completed;
                    agent.completedAt = Date.now();
                    state.staleCycles.delete(agent.id);
                    ctx.out.appendLine(`[DECISION] ${agent.id.substring(0, 8)}: STALE ${stale} cycles -> Completed (was ${prev})`);
                    ctx.fire(agent, 'completed', prev);
                } else {
                    ctx.out.appendLine(`[STALE] ${agent.id.substring(0, 8)}: stale=${stale}/${STALE_THRESHOLD}, steps=${newSteps}`);
                }
            }
        } catch {
            // Per-agent poll failure is non-fatal
        }
    }

    ctx.persistState();
    return true; // Keep monitoring
}

/**
 * Extract pending action details from the trajectory summary's waitingSteps.
 */
export async function extractPendingAction(
    ctx: MonitorContext,
    agent: ISubAgent,
    trajSummary: any,
): Promise<void> {
    const waitingSteps = trajSummary?.waitingSteps;
    if (!Array.isArray(waitingSteps) || waitingSteps.length === 0) return;

    ctx.out.appendLine(`[ACTION] ${agent.id.substring(0, 8)}: waitingSteps=${JSON.stringify(waitingSteps).substring(0, 500)}`);

    const firstWaiting = waitingSteps[0];

    // Extract trajectoryId
    const trajId = trajSummary?.trajectoryId
        || firstWaiting?.trajectoryId
        || agent.id;

    // Extract stepIndex
    const stepIdx = firstWaiting?.stepIndex
        ?? firstWaiting?.index
        ?? firstWaiting?.step_index
        ?? (typeof firstWaiting === 'number' ? firstWaiting : undefined);

    // Try to extract action details
    let actionType = 'unknown';
    let target = 'Needs approval';

    if (firstWaiting && typeof firstWaiting === 'object') {
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

    ctx.out.appendLine(`[ACTION] ${agent.id.substring(0, 8)}: pendingAction set: type=${actionType}, target="${target}", trajId=${trajId.substring(0, 8)}, step=${stepIdx ?? -1}`);
    ctx.fire(agent, 'action_required');
}
