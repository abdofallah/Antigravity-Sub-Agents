/**
 * Sub-Agents Extension — Entry Point
 *
 * Wires together ALL modules:
 * - Orchestrator (brain)
 * - TreeView (sidebar UI)
 * - StatusBar (bottom bar widget)
 * - Notifications (action alerts)
 * - MCP Bridge (agent-triggered launches)
 *
 * Also registers all VS Code commands and the launch QuickPick UI.
 *
 * Startup flow:
 * 1. Initialize SDK & LS Bridge
 * 2. Create Orchestrator & UI modules
 * 3. Start MCP Bridge → auto-install MCP config if needed
 * 4. Start CDP → report status & guide if unavailable
 * 5. Register commands
 *
 * @module extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AntigravitySDK, Models } from 'antigravity-sdk';
import { Orchestrator } from './orchestrator';
import { ActiveTreeProvider, HistoryTreeProvider } from './tree-provider';
import { StatusBarWidget } from './status-bar';
import { NotificationManager } from './notifications';
import { McpBridge } from './mcp-bridge';
import { CdpSidebarInjector } from './cdp-injector';
import { AVAILABLE_MODELS, MODEL_NAMES } from './types';

let sdk: AntigravitySDK;
let orchestrator: Orchestrator;
let mcpBridge: McpBridge;
let cdpInjector: CdpSidebarInjector;

// ─── Settings Helpers ──────────────────────────────────────────────────

/** Map short model name from settings to SDK model ID */
const MODEL_SETTING_MAP: Record<string, number> = {
    'flash': Models.GEMINI_FLASH,
    'pro-low': Models.GEMINI_PRO_LOW,
    'pro-high': Models.GEMINI_PRO_HIGH,
    'sonnet': Models.CLAUDE_SONNET,
    'opus': Models.CLAUDE_OPUS,
    'gpt': Models.GPT_OSS,
};

function getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('subagents');
}

function getDefaultModel(): number {
    const setting = getConfig().get<string>('defaultModel', 'flash');
    return MODEL_SETTING_MAP[setting] ?? Models.GEMINI_FLASH;
}

function getCdpPort(): number {
    return getConfig().get<number>('cdpPort', 9347);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('[SubAgents] Activating...');

    // ─── Initialize SDK ─────────────────────────────────────────────
    try {
        sdk = new AntigravitySDK(context);
        await sdk.initialize();
        console.log('[SubAgents] SDK initialized');
    } catch (err: any) {
        console.error('[SubAgents] SDK init failed:', err.message);
        vscode.window.showErrorMessage(
            `Sub-Agents: Failed to initialize Antigravity SDK — ${err.message}. `
            + 'Make sure you are running inside Antigravity IDE.',
        );
        return;
    }

    // ─── Initialize LS Bridge ───────────────────────────────────────
    if (!sdk.ls.isReady) {
        vscode.window.showWarningMessage(
            'Sub-Agents: Language Server bridge not available. '
            + 'Sub-agent creation will not work until the LS is discovered. '
            + 'Try restarting Antigravity.',
        );
    }

    // ─── Create Orchestrator ────────────────────────────────────────
    orchestrator = new Orchestrator(sdk, context);
    context.subscriptions.push(orchestrator);

    // ─── TreeView Sidebar ───────────────────────────────────────────
    const activeTree = new ActiveTreeProvider(orchestrator);
    const historyTree = new HistoryTreeProvider(orchestrator);

    const activeView = vscode.window.createTreeView('subagents.active', {
        treeDataProvider: activeTree,
        showCollapseAll: true,
    });
    const historyView = vscode.window.createTreeView('subagents.history', {
        treeDataProvider: historyTree,
        showCollapseAll: false,
    });

    context.subscriptions.push(activeView, historyView, activeTree, historyTree);

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
            await autoInstallMcpConfig(context, mcpPort);
        }
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

    // ─── Commands ───────────────────────────────────────────────────

    // Launch sub-agents (full QuickPick flow)
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.launch', async () => {
            await launchFlow();
        }),
    );

    // Quick launch (single sub-agent)
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.launchQuick', async () => {
            await quickLaunchFlow();
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
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:darks.antigravity-subagents');
        }),
    );

    // Health check
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.checkHealth', async () => {
            await showHealthCheck(context, mcpPort);
        }),
    );

    console.log('[SubAgents] ✅ Extension activated');
}

// ─── MCP Auto-Install ───────────────────────────────────────────────────

/**
 * Check if the MCP server is configured, and if not, install it.
 *
 * Strategy:
 * 1. Try to poll MCP server states via the SDK command
 * 2. Look for our 'subagents' server in the list
 * 3. If not found, write the config and prompt for restart
 *
 * The MCP config file for Antigravity is at:
 * - Windows: %APPDATA%\Antigravity\User\mcp_config.json (or .antigravity/mcp_config.json)
 * - Fallback: use vscode command to open it
 */
async function autoInstallMcpConfig(context: vscode.ExtensionContext, bridgePort: number): Promise<void> {
    const mcpScriptPath = path.join(context.extensionPath, 'mcp-server.js');

    // Strategy 1: Try to find mcp_config.json in known locations
    const possiblePaths = [
        path.join(process.env.APPDATA || '', 'Antigravity', 'User', 'mcp_config.json'),
        path.join(process.env.USERPROFILE || '', '.antigravity', 'mcp_config.json'),
        path.join(process.env.APPDATA || '', 'Antigravity', 'mcp_config.json'),
    ];

    let configPath: string | null = null;
    let existingConfig: any = null;

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                existingConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
                configPath = p;
                console.log(`[SubAgents] Found MCP config at: ${p}`);
                break;
            } catch {
                // Invalid JSON, we'll recreate it
                configPath = p;
                break;
            }
        }
    }

    // If no config file found, create one at the first path
    if (!configPath) {
        configPath = possiblePaths[0];
        console.log(`[SubAgents] No MCP config found. Will create at: ${configPath}`);
    }

    // Check if our server is already configured
    const mcpServers = existingConfig?.mcpServers || {};
    const existingEntry = mcpServers.subagents;

    if (existingEntry) {
        // Check if the script path matches and port is current
        const currentArgs = existingEntry.args || [];
        const currentPort = existingEntry.env?.SUBAGENTS_BRIDGE_PORT;
        if (currentArgs[0] === mcpScriptPath && String(currentPort) === String(bridgePort)) {
            console.log('[SubAgents] MCP config already up to date');
            return;
        }
        console.log('[SubAgents] MCP config exists but needs update');
    }

    // Install/update the config
    const newConfig = {
        ...existingConfig,
        mcpServers: {
            ...mcpServers,
            subagents: {
                command: 'node',
                args: [mcpScriptPath],
                env: {
                    SUBAGENTS_BRIDGE_PORT: String(bridgePort),
                },
            },
        },
    };

    try {
        // Ensure directory exists
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        console.log(`[SubAgents] MCP config ${existingEntry ? 'updated' : 'installed'} at: ${configPath}`);

        if (!existingEntry) {
            // First install — prompt for MCP page
            const choice = await vscode.window.showInformationMessage(
                '🔌 Sub-Agents MCP server installed! '
                + 'You may need to open the "Manage MCPs" page and verify the server is running.',
                'Open MCP Settings',
                'Dismiss',
            );
            if (choice === 'Open MCP Settings') {
                try {
                    await vscode.commands.executeCommand('antigravity.openMcpConfigFile');
                } catch {
                    // Open the file directly as fallback
                    const doc = await vscode.workspace.openTextDocument(configPath);
                    await vscode.window.showTextDocument(doc);
                }
            }
        }
    } catch (err: any) {
        console.warn(`[SubAgents] Failed to write MCP config: ${err.message}`);
        // Fallback: show manual instructions
        const choice = await vscode.window.showWarningMessage(
            '⚠️ Could not auto-install MCP config. Please add the subagents server manually.',
            'Open MCP Config',
            'Copy Config',
        );
        if (choice === 'Open MCP Config') {
            try {
                await vscode.commands.executeCommand('antigravity.openMcpConfigFile');
            } catch {
                vscode.window.showInformationMessage(
                    'Open Antigravity Settings → Manage MCPs → Add the subagents server.',
                );
            }
        } else if (choice === 'Copy Config') {
            const config = JSON.stringify({
                subagents: {
                    command: 'node',
                    args: [mcpScriptPath],
                    env: { SUBAGENTS_BRIDGE_PORT: String(bridgePort) },
                },
            }, null, 2);
            await vscode.env.clipboard.writeText(config);
            vscode.window.showInformationMessage('MCP config copied to clipboard. Paste into your mcp_config.json.');
        }
    }
}

// ─── CDP Status & Guide ─────────────────────────────────────────────────

function showCdpSetupGuide(port: number): void {
    vscode.window.showWarningMessage(
        `🔌 CDP not available on port ${port}. `
        + 'Sidebar injection is disabled. '
        + 'Launch Antigravity with --remote-debugging-port=' + port + ' to enable.',
        'Setup CDP',
        'Dismiss',
    ).then(choice => {
        if (choice === 'Setup CDP') {
            setupCdpLaunch();
        }
    });
}

// ─── Health Check ───────────────────────────────────────────────────────

async function showHealthCheck(context: vscode.ExtensionContext, mcpPort: number): Promise<void> {
    const cdpPort = getCdpPort();
    const items: string[] = [];

    // 1. SDK Status
    items.push(sdk ? '✅ SDK: initialized' : '❌ SDK: not initialized');

    // 2. LS Bridge
    items.push(sdk?.ls?.isReady ? '✅ LS Bridge: connected' : '❌ LS Bridge: not connected');

    // 3. MCP Bridge
    items.push(mcpPort > 0
        ? `✅ MCP Bridge: running on port ${mcpPort}`
        : '❌ MCP Bridge: not running',
    );

    // 4. MCP Config
    const mcpScriptPath = path.join(context.extensionPath, 'mcp-server.js');
    const mcpConfigPaths = [
        path.join(process.env.APPDATA || '', 'Antigravity', 'User', 'mcp_config.json'),
        path.join(process.env.USERPROFILE || '', '.antigravity', 'mcp_config.json'),
        path.join(process.env.APPDATA || '', 'Antigravity', 'mcp_config.json'),
    ];
    let mcpConfigFound = false;
    for (const p of mcpConfigPaths) {
        if (fs.existsSync(p)) {
            try {
                const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (cfg.mcpServers?.subagents) {
                    mcpConfigFound = true;
                    items.push(`✅ MCP Config: installed at ${path.basename(path.dirname(p))}/${path.basename(p)}`);
                }
            } catch { /* invalid JSON */ }
        }
    }
    if (!mcpConfigFound) {
        items.push('❌ MCP Config: not installed (agents cannot use sub-agents tool)');
    }

    // 5. CDP Status
    const cdpConnected = cdpInjector?.isConnected;
    if (cdpConnected) {
        items.push(`✅ CDP: connected on port ${cdpPort}`);
    } else {
        // Try a quick probe
        const portOpen = await probeCdpPort(cdpPort);
        if (portOpen) {
            items.push(`⚠️ CDP: port ${cdpPort} open but not connected`);
        } else {
            items.push(`❌ CDP: port ${cdpPort} not responding — sidebar injection disabled`);
        }
    }

    // 6. Default Model
    const defaultModelSetting = getConfig().get<string>('defaultModel', 'flash');
    items.push(`⚙️ Default Model: ${defaultModelSetting}`);

    // Show as QuickPick for nice display
    const pick = await vscode.window.showQuickPick(
        items.map(item => {
            const isError = item.startsWith('❌');
            const isWarning = item.startsWith('⚠️');
            return {
                label: item,
                description: isError ? 'Action needed' : isWarning ? 'Check required' : '',
            };
        }),
        {
            title: '🏥 Sub-Agents Health Check',
            placeHolder: 'Review extension status — click an item for details',
        },
    );

    if (pick) {
        if (pick.label.includes('CDP') && pick.label.includes('❌')) {
            setupCdpLaunch();
        } else if (pick.label.includes('MCP Config') && pick.label.includes('❌')) {
            if (mcpPort > 0) {
                await autoInstallMcpConfig(context, mcpPort);
            }
        } else if (pick.label.includes('Default Model')) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'subagents.defaultModel');
        }
    }
}

/** Quick probe to check if a port is open */
function probeCdpPort(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const http = require('http');
        const req = http.get(`http://127.0.0.1:${port}/json/version`, (res: any) => {
            resolve(res.statusCode === 200);
            res.resume();
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
}

// ─── Launch Flow (Full QuickPick UI) ────────────────────────────────────

async function launchFlow(): Promise<void> {
    // Step 1: How many sub-agents?
    const countStr = await vscode.window.showInputBox({
        title: 'Sub-Agents: How Many?',
        prompt: 'Number of sub-agents to launch',
        value: '3',
        validateInput: (v) => {
            const n = parseInt(v, 10);
            if (isNaN(n) || n < 1 || n > 20) return 'Enter a number between 1 and 20';
            return null;
        },
    });
    if (!countStr) return;
    const count = parseInt(countStr, 10);

    // Step 2: Pick model (default pre-selected)
    const defaultModel = getConfig().get<string>('defaultModel', 'flash');
    const modelPick = await vscode.window.showQuickPick(
        AVAILABLE_MODELS.map(m => ({
            label: m.label,
            description: m.description,
            id: m.id,
            picked: (MODEL_SETTING_MAP[defaultModel] ?? Models.GEMINI_FLASH) === m.id,
        })),
        {
            title: 'Sub-Agents: Choose Model',
            placeHolder: 'Select the model for all sub-agents',
        },
    );
    if (!modelPick) return;
    const model = (modelPick as any).id;

    // Step 3: Batch description
    const description = await vscode.window.showInputBox({
        title: 'Sub-Agents: Batch Description',
        prompt: 'Brief description of what these sub-agents will do',
        placeHolder: 'e.g., "Refactor auth module" or "Write unit tests"',
    });
    if (description === undefined) return; // cancelled

    // Step 4: Task prompts — one per sub-agent
    const tasks: string[] = [];
    for (let i = 0; i < count; i++) {
        const task = await vscode.window.showInputBox({
            title: `Sub-Agent ${i + 1}/${count}: Task`,
            prompt: `What should sub-agent ${i + 1} do?`,
            placeHolder: 'Enter the task prompt...',
        });
        if (task === undefined) return; // cancelled
        if (task.trim() === '') {
            vscode.window.showWarningMessage(`Skipped empty task for sub-agent ${i + 1}`);
            continue;
        }
        tasks.push(task);
    }

    if (tasks.length === 0) {
        vscode.window.showWarningMessage('No tasks provided — launch cancelled.');
        return;
    }

    // Step 5: Launch!
    const modelName = MODEL_NAMES[model] || 'Unknown';
    vscode.window.showInformationMessage(
        `🚀 Launching ${tasks.length} sub-agents with ${modelName}...`,
    );

    try {
        const ids = await orchestrator.launch({
            tasks,
            model,
            description: description || `${tasks.length} sub-agents`,
        });

        vscode.window.showInformationMessage(
            `✅ ${ids.length} sub-agents launched successfully!`,
            'Open Panel',
        ).then(choice => {
            if (choice === 'Open Panel') {
                vscode.commands.executeCommand('subagents.active.focus');
            }
        });
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to launch sub-agents: ${err.message}`);
    }
}

// ─── Quick Launch Flow ──────────────────────────────────────────────────

async function quickLaunchFlow(): Promise<void> {
    // Step 1: Task
    const task = await vscode.window.showInputBox({
        title: 'Quick Launch: Task',
        prompt: 'What should this sub-agent do?',
        placeHolder: 'Enter the task prompt...',
    });
    if (!task) return;

    // Step 2: Model (quick pick with default pre-selected)
    const defaultModel = getConfig().get<string>('defaultModel', 'flash');
    const modelPick = await vscode.window.showQuickPick(
        AVAILABLE_MODELS.map(m => ({
            label: m.label,
            description: m.description,
            id: m.id,
            picked: (MODEL_SETTING_MAP[defaultModel] ?? Models.GEMINI_FLASH) === m.id,
        })),
        {
            title: 'Quick Launch: Model',
            placeHolder: 'Select model',
        },
    );
    if (!modelPick) return;

    // Launch
    try {
        const id = await orchestrator.quickLaunch({
            task,
            model: (modelPick as any).id,
        });

        if (id) {
            vscode.window.showInformationMessage(
                `🚀 Sub-agent launched!`,
                'View Chat',
            ).then(choice => {
                if (choice === 'View Chat') {
                    orchestrator.viewChat(id);
                }
            });
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to launch: ${err.message}`);
    }
}

// ─── CDP Setup ──────────────────────────────────────────────────────────

async function setupCdpLaunch(): Promise<void> {
    const cdpPort = getCdpPort();

    const choice = await vscode.window.showInformationMessage(
        'Sub-Agents: To show sub-agent status directly inside the Agent Manager sidebar, '
        + `Antigravity needs to be launched with CDP enabled (port ${cdpPort}).\\n\\n`
        + 'Choose a setup method:',
        { modal: true },
        'Create Launch Script',
        'Set Environment Variable',
    );

    if (choice === 'Create Launch Script') {
        const desktopPath = path.join(
            process.env.USERPROFILE || '',
            'Desktop',
            'Antigravity-CDP.bat',
        );
        // Auto-detect exe path
        const exePath = process.execPath.replace(/\\/g, '\\\\');
        const scriptContent = `@echo off\nstart "" "${exePath}" --remote-debugging-port=${cdpPort}\n`;
        fs.writeFileSync(desktopPath, scriptContent, 'utf8');
        vscode.window.showInformationMessage(
            `✅ Created "${desktopPath}". Use this to launch Antigravity with CDP enabled.`,
        );
    } else if (choice === 'Set Environment Variable') {
        const terminal = vscode.window.createTerminal('Sub-Agents Setup');
        terminal.show();
        terminal.sendText(
            `[System.Environment]::SetEnvironmentVariable("ELECTRON_EXTRA_LAUNCH_ARGS", "--remote-debugging-port=${cdpPort}", "User")`,
        );
        terminal.sendText('Write-Output "✅ Environment variable set. Restart Antigravity for changes to take effect."');
        vscode.window.showInformationMessage(
            'After restarting Antigravity, CDP will be available automatically.',
        );
    }
}

export function deactivate(): void {
    console.log('[SubAgents] Deactivating...');
}
