/**
 * Sub-Agents System — Shared Types & Constants
 *
 * Central type definitions for the entire sub-agent orchestration system.
 * Every module imports from here to ensure consistency.
 *
 * @module types
 */

import { Models, ModelId } from 'antigravity-sdk';

// ─── Sub-Agent Lifecycle ────────────────────────────────────────────────

/**
 * Lifecycle states for a sub-agent.
 * Flows: Pending → Running → Completed | Failed | Cancelled
 *                          → WaitingForAction → Running (resumed)
 */
export enum SubAgentStatus {
    /** Created but cascade not yet started */
    Pending = 'pending',
    /** Cascade is actively running */
    Running = 'running',
    /** Cascade requires user approval (step, command, terminal) */
    WaitingForAction = 'waiting_for_action',
    /** Cascade completed successfully */
    Completed = 'completed',
    /** Cascade errored out */
    Failed = 'failed',
    /** User cancelled the cascade */
    Cancelled = 'cancelled',
}

// ─── Core Data Structures ───────────────────────────────────────────────

/**
 * A single sub-agent instance, tracked from creation to completion.
 */
export interface ISubAgent {
    /** Cascade ID returned by LSBridge.createCascade() */
    id: string;
    /** The parent conversation that spawned this sub-agent */
    parentId: string;
    /** Batch group ID — all sub-agents launched together share this */
    batchId: string;
    /** Human-readable label */
    label: string;
    /** The original task prompt sent to the cascade */
    task: string;
    /** Model used for this sub-agent */
    model: ModelId;
    /** Current lifecycle status */
    status: SubAgentStatus;
    /** Number of tool steps completed so far */
    stepCount: number;
    /** When this sub-agent was created */
    createdAt: number;
    /** When this sub-agent finished (completed/failed/cancelled) */
    completedAt?: number;
    /** Error message if status is Failed */
    error?: string;
    /** Result summary from the sub-agent's trajectory */
    result?: string;
}

/**
 * A batch of sub-agents launched together.
 */
export interface ISubAgentBatch {
    /** Unique batch identifier */
    id: string;
    /** The parent cascade that triggered this batch */
    parentId: string;
    /** Ordered list of sub-agent IDs in this batch */
    agentIds: string[];
    /** When the batch was launched */
    createdAt: number;
    /** High-level description of the batch task */
    description: string;
}

// ─── Launch Configuration ───────────────────────────────────────────────

/**
 * Configuration for launching a batch of sub-agents.
 */
export interface ILaunchConfig {
    /** Array of task prompts — one per sub-agent */
    tasks: string[];
    /** Optional custom labels — one per sub-agent (falls back to 'Sub-Agent N') */
    labels?: string[];
    /** Model ID for all agents, or per-agent array */
    model: ModelId | ModelId[];
    /** Maximum concurrent sub-agents (rest queued) */
    concurrency?: number;
    /** Delay between launches in ms (default: 500) */
    staggerMs?: number;
    /** Human-readable batch description */
    description?: string;
    /** Parent cascade ID (auto-detected if omitted) */
    parentId?: string;
    /** Explicit workspace URI (e.g. 'file:///c%3A/Users/me/project'). Highest priority for workspace binding. */
    workspaceUri?: string;
}

/**
 * Quick-launch config for a single sub-agent.
 */
export interface IQuickLaunchConfig {
    /** Task prompt */
    task: string;
    /** Model to use */
    model: ModelId;
    /** Parent cascade ID */
    parentId?: string;
}

// ─── Events ─────────────────────────────────────────────────────────────

/**
 * Fired whenever a sub-agent's state changes.
 */
export interface ISubAgentEvent {
    /** The updated sub-agent */
    agent: ISubAgent;
    /** What changed */
    type: 'created' | 'progress' | 'status_change' | 'completed' | 'action_required';
    /** Previous status (for status_change events) */
    previousStatus?: SubAgentStatus;
}

// ─── Model Utilities ────────────────────────────────────────────────────

/** Human-readable model names */
export const MODEL_NAMES: Record<number, string> = {
    [Models.GEMINI_FLASH]: 'Gemini Flash',
    [Models.GEMINI_PRO_LOW]: 'Gemini Pro (Low)',
    [Models.GEMINI_PRO_HIGH]: 'Gemini Pro (High)',
    [Models.CLAUDE_SONNET]: 'Claude Sonnet',
    [Models.CLAUDE_OPUS]: 'Claude Opus',
    [Models.GPT_OSS]: 'GPT OSS',
};

/** Short model labels for UI */
export const MODEL_LABELS: Record<number, string> = {
    [Models.GEMINI_FLASH]: '⚡ Flash',
    [Models.GEMINI_PRO_LOW]: '🧠 Pro-L',
    [Models.GEMINI_PRO_HIGH]: '🧠 Pro-H',
    [Models.CLAUDE_SONNET]: '🎵 Sonnet',
    [Models.CLAUDE_OPUS]: '🎭 Opus',
    [Models.GPT_OSS]: '🤖 GPT',
};

/** All available models for quick-pick */
export const AVAILABLE_MODELS = [
    { id: Models.GEMINI_FLASH, label: '⚡ Gemini Flash', description: 'Fast, lightweight' },
    { id: Models.GEMINI_PRO_LOW, label: '🧠 Gemini Pro (Low)', description: 'Balanced' },
    { id: Models.GEMINI_PRO_HIGH, label: '🧠 Gemini Pro (High)', description: 'High quality' },
    { id: Models.CLAUDE_SONNET, label: '🎵 Claude Sonnet', description: 'Anthropic balanced' },
    { id: Models.CLAUDE_OPUS, label: '🎭 Claude Opus', description: 'Anthropic premium' },
    { id: Models.GPT_OSS, label: '🤖 GPT OSS', description: 'OpenAI OSS' },
];

// ─── Status Utilities ───────────────────────────────────────────────────

/** Status display icons */
export const STATUS_ICONS: Record<SubAgentStatus, string> = {
    [SubAgentStatus.Pending]: '⏳',
    [SubAgentStatus.Running]: '🟢',
    [SubAgentStatus.WaitingForAction]: '🔔',
    [SubAgentStatus.Completed]: '✅',
    [SubAgentStatus.Failed]: '❌',
    [SubAgentStatus.Cancelled]: '🚫',
};

/** Whether a status is considered "active" (still running or needs attention) */
export function isActiveStatus(status: SubAgentStatus): boolean {
    return status === SubAgentStatus.Pending
        || status === SubAgentStatus.Running
        || status === SubAgentStatus.WaitingForAction;
}

/** Whether a status is considered "terminal" (done) */
export function isTerminalStatus(status: SubAgentStatus): boolean {
    return status === SubAgentStatus.Completed
        || status === SubAgentStatus.Failed
        || status === SubAgentStatus.Cancelled;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Generate a short unique ID for batches */
export function generateBatchId(): string {
    return `batch-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

/** Format elapsed time since a timestamp */
export function formatElapsed(since: number): string {
    const ms = Date.now() - since;
    if (ms < 1000) return 'just now';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}
