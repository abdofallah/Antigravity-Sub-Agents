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
