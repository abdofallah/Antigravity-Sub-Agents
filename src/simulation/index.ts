/**
 * Simulation Panel — Dev-Only Module
 *
 * Registers the simulation WebviewPanel command and handles
 * communication between the panel UI and the Orchestrator.
 *
 * This entire module is gated by __DEV__ at the call site (extension.ts)
 * and will be tree-shaken out of release builds.
 *
 * @module simulation/index
 */

import * as vscode from 'vscode';
import { Orchestrator } from '../orchestrator';
import { ISubAgent, ISubAgentBatch, SubAgentStatus } from '../types';
import { getSimulationWebviewContent } from './webview';

/** Model string-to-number mapping (matches the SDK's Models enum values) */
const MODEL_MAP: Record<string, number> = {
    flash: 1,
    'pro-low': 2,
    'pro-high': 3,
    sonnet: 4,
    opus: 5,
    gpt: 6,
};

/**
 * Register the simulation panel command.
 * Only call this when devMode is enabled.
 */
export function registerSimulationPanel(
    context: vscode.ExtensionContext,
    orchestrator: Orchestrator,
): void {
    let panel: vscode.WebviewPanel | null = null;

    const cmd = vscode.commands.registerCommand('subagents.openSimulator', () => {
        if (panel) {
            panel.reveal();
            return;
        }

        panel = vscode.window.createWebviewPanel(
            'subagents.simulator',
            '🧪 Sub-Agent Simulator',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );

        panel.webview.html = getSimulationWebviewContent();

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            (msg) => handleSimulationMessage(msg, orchestrator),
            undefined,
            context.subscriptions,
        );

        panel.onDidDispose(() => {
            panel = null;
            // Clean up all simulated agents when panel closes
            orchestrator.__removeAllSimulated();
        });
    });

    context.subscriptions.push(cmd);
}

/**
 * Handle a message from the simulation webview panel.
 */
function handleSimulationMessage(
    msg: any,
    orchestrator: Orchestrator,
): void {
    switch (msg.type) {
        case 'spawn': {
            const raw = msg.agent;
            const agent: ISubAgent = {
                id: raw.id,
                parentId: raw.parentId,
                batchId: raw.batchId,
                label: raw.label,
                task: raw.task,
                model: raw.model || MODEL_MAP.flash,
                status: raw.status as SubAgentStatus || SubAgentStatus.Running,
                stepCount: raw.stepCount || 0,
                createdAt: raw.createdAt || Date.now(),
                completedAt: raw.completedAt || undefined,
                error: raw.error || undefined,
                pendingAction: raw.pendingAction || undefined,
            };

            // Ensure batch exists
            const existingBatch = orchestrator.getBatch(raw.batchId);
            if (!existingBatch) {
                const batch: ISubAgentBatch = {
                    id: raw.batchId,
                    parentId: raw.parentId,
                    agentIds: [raw.id],
                    createdAt: Date.now(),
                    description: `Simulated batch`,
                };
                orchestrator.__injectSimulatedBatch(batch);
            } else {
                // Add to existing batch
                if (!existingBatch.agentIds.includes(raw.id)) {
                    existingBatch.agentIds.push(raw.id);
                }
            }

            orchestrator.__injectSimulatedAgent(agent);
            break;
        }

        case 'update': {
            const updates: Partial<ISubAgent> = {};
            if (msg.updates.status !== undefined) updates.status = msg.updates.status as SubAgentStatus;
            if (msg.updates.stepCount !== undefined) updates.stepCount = msg.updates.stepCount;
            if (msg.updates.error !== undefined) updates.error = msg.updates.error;
            if (msg.updates.completedAt !== undefined) updates.completedAt = msg.updates.completedAt;
            if (msg.updates.pendingAction !== undefined) {
                updates.pendingAction = msg.updates.pendingAction || undefined;
            }
            orchestrator.__updateSimulatedAgent(msg.id, updates);
            break;
        }

        case 'remove': {
            orchestrator.__removeSimulatedAgent(msg.id);
            break;
        }

        case 'clearAll': {
            orchestrator.__removeAllSimulated();
            break;
        }

        case 'command': {
            // Execute VS Code commands from the webview (Restart Extension Host, etc.)
            if (msg.command) {
                vscode.commands.executeCommand(msg.command);
            }
            break;
        }
    }
}
