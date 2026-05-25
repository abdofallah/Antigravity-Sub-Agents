/**
 * Sub-Agents Extension — Entry Point
 *
 * Wires together ALL modules:
 * - Orchestrator (brain)
 * - TreeView (sidebar UI)
 * - StatusBar (bottom bar widget)
 * - Notifications (action alerts)
 * - MCP Bridge (agent-triggered launches)
 * - CDP Injector (sidebar DOM injection)
 * - Commands (VS Code command palette)
 *
 * Startup flow:
 * 1. Initialize SDK & LS Bridge
 * 2. Create Orchestrator & UI modules
 * 3. Start MCP Bridge → auto-install MCP config if needed
 * 4. Start CDP → report status & guide if unavailable
 * 5. Register commands
 * 6. Start status polling
 *
 * @module extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AntigravitySDK } from 'antigravity-sdk';
import { Orchestrator } from './orchestrator';
import { ActiveTreeProvider, HistoryTreeProvider, StatusTreeProvider, McpServerHealth } from './tree-provider';
import { StatusBarWidget } from './status-bar';
import { NotificationManager } from './notifications';
import { McpBridge } from './mcp';
import { CdpSidebarInjector } from './cdp';
import { getConfig, getCdpPort } from './config/settings';
import { autoInstallMcpConfig, autoFixMcpServer, queryMcpServerHealth } from './config/mcp-config';
import { writeInstructionsFile } from './config/instructions';
import { registerAllCommands } from './commands';
import { showCdpSetupGuide } from './commands/health-check';

let sdk: AntigravitySDK;
let orchestrator: Orchestrator;
let mcpBridge: McpBridge;
let cdpInjector: CdpSidebarInjector;
let _out: vscode.OutputChannel | null = null;

/** Log to the Sub-Agents output channel */
function log(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    _out?.appendLine(line);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // ─── Output Channel ──────────────────────────────────────────
    _out = vscode.window.createOutputChannel('Sub-Agents');
    context.subscriptions.push(_out);
    log('Activating Sub-Agents extension...');

    // ─── Initialize SDK ─────────────────────────────────────────────
    try {
        sdk = new AntigravitySDK(context);
        await sdk.initialize();
        log('SDK initialized');
    } catch (err: any) {
        log(`SDK init failed: ${err.message}`);
        vscode.window.showErrorMessage(
            `Sub-Agents: Failed to initialize Antigravity SDK — ${err.message}. `
            + 'Make sure you are running inside Antigravity IDE.',
        );
        return;
    }

    // ─── Initialize LS Bridge ─────────────────────────────────────
    if (!sdk.ls.isReady) {
        log('LS Bridge not ready — will retry. Sub-agent creation may not work immediately.');
        vscode.window.showWarningMessage(
            'Sub-Agents: Language Server bridge not available. '
            + 'Sub-agent creation will not work until the LS is discovered. '
            + 'Try restarting Antigravity.',
        );
    } else {
        log('LS Bridge ready');
    }

    // ─── Create Orchestrator ────────────────────────────────────────
    orchestrator = new Orchestrator(sdk, context);
    context.subscriptions.push(orchestrator);

    // ─── TreeView Sidebar ───────────────────────────────────────────
    const statusTree = new StatusTreeProvider();
    const activeTree = new ActiveTreeProvider(orchestrator);
    const historyTree = new HistoryTreeProvider(orchestrator);

    const statusView = vscode.window.createTreeView('subagents.status', {
        treeDataProvider: statusTree,
        showCollapseAll: false,
    });
    const activeView = vscode.window.createTreeView('subagents.active', {
        treeDataProvider: activeTree,
        showCollapseAll: true,
    });
    const historyView = vscode.window.createTreeView('subagents.history', {
        treeDataProvider: historyTree,
        showCollapseAll: false,
    });

    context.subscriptions.push(statusView, activeView, historyView, statusTree, activeTree, historyTree);

    // Update active view badge with running count — REALTIME
    orchestrator.onEvent(() => {
        const count = orchestrator.activeCount;
        activeView.badge = count > 0
            ? { value: count, tooltip: `${count} active sub-agents` }
            : undefined;
    });

    // ─── Status Bar ─────────────────────────────────────────────────
    const statusBar = new StatusBarWidget(orchestrator);
    context.subscriptions.push(statusBar);

    // ─── Notifications ──────────────────────────────────────────────
    const notifications = new NotificationManager(orchestrator);
    context.subscriptions.push(notifications);

    // ─── MCP Bridge ─────────────────────────────────────────────────
    mcpBridge = new McpBridge(orchestrator);
    context.subscriptions.push(mcpBridge);

    let mcpPort = 0;
    try {
        mcpPort = await mcpBridge.start();
        console.log(`[SubAgents] MCP Bridge on port ${mcpPort}`);

        // Write the MCP server script to extension storage
        const mcpScriptPath = path.join(context.extensionPath, 'mcp-server.js');
        fs.writeFileSync(mcpScriptPath, mcpBridge.generateMcpServerScript(), 'utf8');
        console.log(`[SubAgents] MCP server script written to ${mcpScriptPath}`);

        // Auto-install MCP config if enabled
        if (getConfig().get<boolean>('autoInstallMCP', true)) {
            await autoInstallMcpConfig(context, mcpPort, sdk, log);
        }

        // Write instructions.md for prompt injection
        writeInstructionsFile(log);
    } catch (err: any) {
        console.warn('[SubAgents] MCP Bridge failed to start:', err.message);
    }

    // ─── CDP Sidebar Injector ────────────────────────────────────────
    const cdpPort = getCdpPort();
    cdpInjector = new CdpSidebarInjector(orchestrator, cdpPort);
    context.subscriptions.push(cdpInjector);

    // Try CDP connection in background (non-blocking)
    if (getConfig().get<boolean>('autoConnectCDP', true)) {
        cdpInjector.connect().then(connected => {
            if (connected) {
                console.log(`[SubAgents] CDP sidebar injector connected on port ${cdpPort}`);
            } else {
                console.log('[SubAgents] CDP not available — sidebar injection disabled.');
                showCdpSetupGuide(cdpPort);
            }
        });
    }

    // ─── Status Panel Polling (3s) + Auto-Fix ─────────────────────
    statusTree.updateStatus({
        sdk: !!sdk,
        lsBridge: !!sdk?.ls?.isReady,
        mcpBridge: mcpPort > 0,
        mcpBridgePort: mcpPort,
        mcpServerStatus: 'initializing',
        mcpServerError: '',
        cdpConnected: false,
        cdpPort: cdpPort,
        cdpTarget: '',
        defaultModel: getConfig().get<string>('defaultModel', 'flash') || 'flash',
    });

    // Initial MCP health check via LS RPC
    let lastMcpStatus: McpServerHealth = 'initializing';
    queryMcpServerHealth(sdk, log).then(({ status, error }) => {
        lastMcpStatus = status;
        statusTree.patchStatus({ mcpServerStatus: status, mcpServerError: error });
        // Auto-fix on first check if broken
        if (status === 'error' || status === 'not_found') {
            log(`MCP server ${status} on startup — auto-fixing...`);
            autoFixMcpServer(context, mcpPort, statusTree, sdk, log);
        }
    });

    // Poll status every 3 seconds (MCP health is async)
    let lastAutoFixTime = 0;
    const AUTO_FIX_COOLDOWN = 30_000;

    const statusPollTimer = setInterval(async () => {
        const { status: mcpStatus, error: mcpError } = await queryMcpServerHealth(sdk, log);

        if (mcpStatus !== lastMcpStatus) {
            log(`MCP status: ${lastMcpStatus} → ${mcpStatus}${mcpError ? ` (${mcpError.substring(0, 60)})` : ''}`);
            lastMcpStatus = mcpStatus;
        }

        statusTree.updateStatus({
            sdk: !!sdk,
            lsBridge: !!sdk?.ls?.isReady,
            mcpBridge: mcpPort > 0,
            mcpBridgePort: mcpPort,
            mcpServerStatus: mcpStatus,
            mcpServerError: mcpError,
            cdpConnected: !!cdpInjector?.isConnected,
            cdpPort: cdpPort,
            cdpTarget: cdpInjector?.targetTitle || '',
            defaultModel: getConfig().get<string>('defaultModel', 'flash') || 'flash',
        });

        if (mcpStatus === 'error' || mcpStatus === 'not_found') {
            const now = Date.now();
            if (now - lastAutoFixTime > AUTO_FIX_COOLDOWN) {
                lastAutoFixTime = now;
                log(`MCP server ${mcpStatus} — auto-fixing...`);
                await autoFixMcpServer(context, mcpPort, statusTree, sdk, log);
            }
        }
    }, 3000);
    context.subscriptions.push({ dispose: () => clearInterval(statusPollTimer) });

    // ─── Commands ───────────────────────────────────────────────────
    registerAllCommands(
        context, orchestrator, cdpInjector,
        activeTree, historyTree, statusTree,
        sdk, mcpPort, log,
    );

    log('✅ Extension activated');
}

export function deactivate(): void {
    log('Deactivating Sub-Agents extension');
}
