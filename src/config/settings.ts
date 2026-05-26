/**
 * Extension Settings Helpers
 *
 * Centralizes access to VS Code configuration for the sub-agents extension.
 * All setting reads go through these helpers to keep config access consistent.
 *
 * @module config/settings
 */

import * as vscode from 'vscode';
import { Models } from 'antigravity-sdk';

/** Map short model name from settings to SDK model ID */
export const MODEL_SETTING_MAP: Record<string, number> = {
    'flash': Models.GEMINI_FLASH,
    'pro-low': Models.GEMINI_PRO_LOW,
    'pro-high': Models.GEMINI_PRO_HIGH,
    'sonnet': Models.CLAUDE_SONNET,
    'opus': Models.CLAUDE_OPUS,
    'gpt': Models.GPT_OSS,
};

/** Get the sub-agents configuration section */
export function getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('subagents');
}

/** Get the default model ID from settings */
export function getDefaultModel(): number {
    const setting = getConfig().get<string>('defaultModel', 'flash');
    return MODEL_SETTING_MAP[setting] ?? Models.GEMINI_FLASH;
}

/** Get the configured CDP debugging port */
export function getCdpPort(): number {
    return getConfig().get<number>('cdpPort', 9347);
}

// ─── Configurable Polling Intervals ────────────────────────────────────

/** Browser-side DOM enforcement interval (badges, locks, breadcrumbs) in ms */
export function getUiPollInterval(): number {
    return getConfig().get<number>('uiPollInterval', 300);
}

/** Orchestrator progress poll interval in ms */
export function getProgressPollInterval(): number {
    return getConfig().get<number>('progressPollInterval', 300);
}

/** Extension status panel poll interval in ms */
export function getStatusPollInterval(): number {
    return getConfig().get<number>('statusPollInterval', 300);
}

/** CDP heartbeat interval in ms */
export function getHeartbeatInterval(): number {
    return getConfig().get<number>('heartbeatInterval', 300);
}

/** CDP target rescan interval in ms */
export function getTargetRescanInterval(): number {
    return getConfig().get<number>('targetRescanInterval', 300);
}

// ─── Debug / Logging ───────────────────────────────────────────────────

/** Whether detailed trace logging is enabled */
export function getDebugLogging(): boolean {
    return getConfig().get<boolean>('debugLogging', false);
}
