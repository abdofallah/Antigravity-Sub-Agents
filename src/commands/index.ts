/**
 * Command Registration
 *
 * Registers all VS Code commands for the sub-agents extension.
 * Keeps extension.ts clean by collecting all command handlers here.
 *
 * @module commands/index
 */

import * as vscode from 'vscode';
import { AntigravitySDK } from 'antigravity-sdk';
import { Orchestrator } from '../orchestrator';
import { CdpSidebarInjector } from '../cdp';
import { ActiveTreeProvider, HistoryTreeProvider, StatusTreeProvider } from '../tree-provider';
import { launchFlow } from './launch-flow';
import { quickLaunchFlow } from './quick-launch';
import { showHealthCheck, setupCdpLaunch } from './health-check';
import { fixMcpServer } from '../config/mcp-config';

export function registerAllCommands(
    context: vscode.ExtensionContext,
    orchestrator: Orchestrator,
    cdpInjector: CdpSidebarInjector,
    activeTree: ActiveTreeProvider,
    historyTree: HistoryTreeProvider,
    statusTree: StatusTreeProvider,
    sdk: AntigravitySDK,
    mcpPort: number,
    log: (msg: string) => void,
): void {
    // Launch sub-agents (full QuickPick flow)
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.launch', async () => {
            await launchFlow(orchestrator);
        }),
    );

    // Quick launch (single sub-agent)
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.launchQuick', async () => {
            await quickLaunchFlow(orchestrator);
        }),
    );

    // Cancel a specific sub-agent
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.cancel', async (idOrItem?: string | any) => {
            const id = typeof idOrItem === 'string'
                ? idOrItem
                : idOrItem?.agent?.id;
            if (id) {
                await orchestrator.cancel(id);
                vscode.window.showInformationMessage(`Cancelled sub-agent ${id.substring(0, 8)}...`);
            }
        }),
    );

    // Cancel all
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.cancelAll', async () => {
            const active = orchestrator.activeCount;
            if (active === 0) {
                vscode.window.showInformationMessage('No active sub-agents to cancel.');
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                `Cancel all ${active} running sub-agents?`,
                { modal: true },
                'Cancel All',
            );
            if (confirm === 'Cancel All') {
                await orchestrator.cancelAll();
                vscode.window.showInformationMessage('All sub-agents cancelled.');
            }
        }),
    );

    // View sub-agent chat
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.viewChat', async (idOrItem?: string | any) => {
            const id = typeof idOrItem === 'string'
                ? idOrItem
                : idOrItem?.agent?.id;
            if (id) {
                await orchestrator.viewChat(id);
            }
        }),
    );

    // Refresh trees
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.refresh', () => {
            activeTree.refresh();
            historyTree.refresh();
        }),
    );

    // Setup CDP for sidebar injection
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.setupCDP', async () => {
            await setupCdpLaunch();
        }),
    );

    // Open DevTools for Manager target
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.openDevTools', async () => {
            if (cdpInjector) {
                await cdpInjector.openDevTools();
            } else {
                vscode.window.showWarningMessage('CDP injector not initialized');
            }
        }),
    );

    // Open extension settings
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:abdofallah.antigravity-subagents');
        }),
    );

    // Health check
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.checkHealth', async () => {
            await showHealthCheck(sdk, cdpInjector, mcpPort, log);
        }),
    );

    // Fix MCP Server (reinstall config + refresh LS)
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.fixMcpServer', async () => {
            await fixMcpServer(context, mcpPort, statusTree, sdk, log);
        }),
    );
}
