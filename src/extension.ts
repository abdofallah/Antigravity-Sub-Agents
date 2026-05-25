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
import { ActiveTreeProvider, HistoryTreeProvider, StatusTreeProvider, McpServerHealth } from './tree-provider';
import { StatusBarWidget } from './status-bar';
import { NotificationManager } from './notifications';
import { McpBridge } from './mcp-bridge';
import { CdpSidebarInjector } from './cdp-injector';
import { AVAILABLE_MODELS, MODEL_NAMES } from './types';

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
            await autoInstallMcpConfig(context, mcpPort);
        }

        // Write instructions.md for prompt injection
        writeInstructionsFile();
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
    // Initial status (MCP server health will be updated async)
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
    queryMcpServerHealth().then(({ status, error }) => {
        lastMcpStatus = status;
        statusTree.patchStatus({ mcpServerStatus: status, mcpServerError: error });
        // Auto-fix on first check if broken
        if (status === 'error' || status === 'not_found') {
            log(`MCP server ${status} on startup — auto-fixing...`);
            autoFixMcpServer(context, mcpPort, statusTree);
        }
    });

    // Poll status every 3 seconds (MCP health is async)
    // Auto-fix is debounced: only one auto-fix attempt per 30s
    let lastAutoFixTime = 0;
    const AUTO_FIX_COOLDOWN = 30_000; // 30s between auto-fix attempts

    const statusPollTimer = setInterval(async () => {
        const { status: mcpStatus, error: mcpError } = await queryMcpServerHealth();

        // Log only on MCP status transitions
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

        // Auto-fix if MCP server is broken (debounced)
        if (mcpStatus === 'error' || mcpStatus === 'not_found') {
            const now = Date.now();
            if (now - lastAutoFixTime > AUTO_FIX_COOLDOWN) {
                lastAutoFixTime = now;
                log(`MCP server ${mcpStatus} — auto-fixing...`);
                await autoFixMcpServer(context, mcpPort, statusTree);
            }
        }
    }, 3000);
    context.subscriptions.push({ dispose: () => clearInterval(statusPollTimer) });

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
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:abdofallah.antigravity-subagents');
        }),
    );

    // Health check
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.checkHealth', async () => {
            await showHealthCheck(context, mcpPort);
        }),
    );

    // Fix MCP Server (reinstall config + refresh LS)
    context.subscriptions.push(
        vscode.commands.registerCommand('subagents.fixMcpServer', async () => {
            await fixMcpServer(context, mcpPort, statusTree);
        }),
    );

    log('✅ Extension activated');
}

// ─── MCP Config Helpers ──────────────────────────────────────────────────

/** All known MCP config file locations, ordered by priority (primary first) */
function getMcpConfigPaths(): string[] {
    return [
        // .gemini/antigravity is where the LS actually reads from
        path.join(process.env.USERPROFILE || '', '.gemini', 'antigravity', 'mcp_config.json'),
        path.join(process.env.APPDATA || '', 'Antigravity', 'User', 'mcp_config.json'),
        path.join(process.env.USERPROFILE || '', '.antigravity', 'mcp_config.json'),
        path.join(process.env.APPDATA || '', 'Antigravity', 'mcp_config.json'),
    ];
}

/** Build the subagents MCP entry with correct Antigravity protobuf format */
function buildSubagentsEntry(scriptPath: string, bridgePort: number): Record<string, any> {
    return {
        $typeName: 'exa.cascade_plugins_pb.CascadePluginCommandTemplate',
        command: 'node',
        args: [scriptPath],
        env: {
            SUBAGENTS_BRIDGE_PORT: String(bridgePort),
        },
    };
}

/**
 * Find the first existing MCP config file. Returns path + parsed content.
 * If none found, returns the primary path with null content.
 */
function findMcpConfig(): { configPath: string; existingConfig: any } {
    for (const p of getMcpConfigPaths()) {
        if (fs.existsSync(p)) {
            try {
                const content = JSON.parse(fs.readFileSync(p, 'utf8'));
                console.log(`[SubAgents] Found MCP config at: ${p}`);
                return { configPath: p, existingConfig: content };
            } catch {
                return { configPath: p, existingConfig: null };
            }
        }
    }
    const primary = getMcpConfigPaths()[0];
    console.log(`[SubAgents] No MCP config found. Will create at: ${primary}`);
    return { configPath: primary, existingConfig: null };
}

/**
 * Write the subagents entry into the MCP config file.
 * Preserves all other servers. Returns true on success.
 */
function writeMcpSubagentsConfig(configPath: string, existingConfig: any, scriptPath: string, bridgePort: number): boolean {
    const mcpServers = existingConfig?.mcpServers || {};
    const newConfig = {
        ...existingConfig,
        mcpServers: {
            ...mcpServers,
            subagents: buildSubagentsEntry(scriptPath, bridgePort),
        },
    };

    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        console.log(`[SubAgents] MCP config written to: ${configPath}`);
        console.log(`[SubAgents] Script path: ${scriptPath}`);
        return true;
    } catch (err: any) {
        console.warn(`[SubAgents] Failed to write MCP config: ${err.message}`);
        return false;
    }
}

// ─── MCP Auto-Install ──────────────────────────────────────────────────

/**
 * Check if the MCP server is configured, and if not, install it.
 * Also fixes stale paths (e.g. after moving the project).
 */
async function autoInstallMcpConfig(context: vscode.ExtensionContext, bridgePort: number): Promise<void> {
    const mcpScriptPath = path.join(context.extensionPath, 'mcp-server.js');
    const { configPath, existingConfig } = findMcpConfig();

    // Check if our server is already configured with the correct path
    const existingEntry = existingConfig?.mcpServers?.subagents;
    if (existingEntry) {
        const currentArgs = existingEntry.args || [];
        const currentPort = existingEntry.env?.SUBAGENTS_BRIDGE_PORT;
        if (currentArgs[0] === mcpScriptPath && String(currentPort) === String(bridgePort)) {
            console.log('[SubAgents] MCP config already up to date');
            return;
        }
        console.log(`[SubAgents] MCP config exists but needs update (path: ${currentArgs[0]} → ${mcpScriptPath})`);
    }

    if (writeMcpSubagentsConfig(configPath, existingConfig, mcpScriptPath, bridgePort)) {
        await refreshMcpServers();
        if (!existingEntry) {
            vscode.window.showInformationMessage('🔌 Sub-Agents MCP server installed and refreshed!');
        }
    } else {
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
                subagents: buildSubagentsEntry(mcpScriptPath, bridgePort),
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

    // 4. MCP Server (live LS status)
    const { status: mcpHealth, error: mcpErr } = await queryMcpServerHealth();
    switch (mcpHealth) {
        case 'running':
        case 'initializing':
        case 'unknown':
            items.push('✅ MCP Server: installed');
            break;
        case 'error':
            items.push(`❌ MCP Server: error — ${mcpErr.substring(0, 60)}`);
            break;
        case 'not_found':
            items.push('❌ MCP Server: not configured');
            break;
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
        } else if (pick.label.includes('MCP Server') && (pick.label.includes('❌') || pick.label.includes('⚠️'))) {
            vscode.commands.executeCommand('subagents.fixMcpServer');
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
        + `Antigravity needs to be launched with CDP enabled (port ${cdpPort}).\n\n`
        + 'This will create a .bat file on your Desktop that launches Antigravity with '
        + 'the --remote-debugging-port flag.',
        { modal: true },
        'Create Launch Script',
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
            `✅ Created "${desktopPath}". Close Antigravity and use this script to relaunch with CDP enabled.`,
        );
    }
}

// ─── MCP Server Health (LS RPC) ─────────────────────────────────────────

/**
 * Query the Language Server's GetMcpServerStates RPC to get the live
 * status of our 'subagents' MCP server.
 *
 * Returns the health status and any error message.
 */
async function queryMcpServerHealth(): Promise<{ status: McpServerHealth; error: string }> {
    try {
        if (!sdk?.ls?.isReady) {
            return { status: 'unknown', error: '' };
        }

        const response = await sdk.ls.rawRPC('GetMcpServerStates', {});
        const states = response?.states || [];
        const subagentsState = states.find((s: any) => s.spec?.serverName === 'subagents');

        if (!subagentsState) {
            return { status: 'not_found', error: '' };
        }

        // Protobuf JSON: zero-value enum fields (OK = 0) are OMITTED.
        // So absent/undefined/null/'' status all mean healthy.
        const rawStatus = subagentsState.status;
        const lsError = subagentsState.error || '';

        // Healthy states: absent (proto zero), READY, OK, RUNNING
        if (rawStatus === undefined || rawStatus === null || rawStatus === '' ||
            rawStatus === 'MCP_SERVER_STATUS_OK' ||
            rawStatus === 'MCP_SERVER_STATUS_READY' ||
            rawStatus === 'MCP_SERVER_STATUS_RUNNING') {
            return { status: 'running', error: '' };
        }
        if (rawStatus === 'MCP_SERVER_STATUS_ERROR') {
            return { status: 'error', error: lsError };
        }
        if (rawStatus === 'MCP_SERVER_STATUS_LOADING' || rawStatus === 'MCP_SERVER_STATUS_STARTING') {
            return { status: 'initializing', error: '' };
        }

        // Unknown status string — log once for future mapping, treat as healthy
        log(`MCP health: unrecognized status '${rawStatus}', treating as running`);
        return { status: 'running', error: '' };
    } catch (err: any) {
        log(`MCP health query failed: ${err.message}`);
        return { status: 'unknown', error: '' };
    }
}

/**
 * Tell the Language Server to reload MCP server configurations.
 * This picks up changes to mcp_config.json without needing a restart.
 */
async function refreshMcpServers(): Promise<void> {
    try {
        if (!sdk?.ls?.isReady) {
            log('Cannot refresh MCP servers: LS not ready');
            return;
        }
        await sdk.ls.rawRPC('RefreshMcpServers', {});
        log('RefreshMcpServers RPC sent');
    } catch (err: any) {
        // 'loading already in progress' is expected when LS is still initializing
        if (err.message?.includes('loading already in progress')) {
            log('RefreshMcpServers: LS still loading — will pick up config on its own');
        } else {
            log(`RefreshMcpServers failed: ${err.message}`);
        }
    }
}

/**
 * Fix MCP server: reinstall config with correct paths + refresh LS.
 * Called from the status panel when the MCP server is in error state.
 */
async function fixMcpServer(
    context: vscode.ExtensionContext,
    mcpPort: number,
    statusTree: StatusTreeProvider,
): Promise<void> {
    const ok = await autoFixMcpServer(context, mcpPort, statusTree);
    if (ok) {
        vscode.window.showInformationMessage(
            '✅ MCP config reinstalled and LS refreshed. Server should restart shortly.',
        );
    } else {
        vscode.window.showErrorMessage('Failed to fix MCP config. Check the output log for details.');
    }
}

/**
 * Silent auto-fix: updates the MCP config with correct paths + refreshes LS.
 * Returns true on success. Used both by the manual fix command and the auto-fix poll.
 */
async function autoFixMcpServer(
    context: vscode.ExtensionContext,
    mcpPort: number,
    statusTree: StatusTreeProvider,
): Promise<boolean> {
    const mcpScriptPath = path.join(context.extensionPath, 'mcp-server.js');
    const { configPath, existingConfig } = findMcpConfig();

    log(`Auto-fixing MCP config at: ${configPath}`);
    log(`Correct script path: ${mcpScriptPath}`);
    const currentPath = existingConfig?.mcpServers?.subagents?.args?.[0];
    if (currentPath && currentPath !== mcpScriptPath) {
        log(`Path mismatch: config has '${currentPath}', should be '${mcpScriptPath}'`);
    }

    if (writeMcpSubagentsConfig(configPath, existingConfig, mcpScriptPath, mcpPort)) {
        // Tell LS to reload
        await refreshMcpServers();

        // Update status immediately
        statusTree.patchStatus({ mcpServerStatus: 'initializing', mcpServerError: '' });

        // Re-check after a delay
        setTimeout(async () => {
            const { status, error } = await queryMcpServerHealth();
            statusTree.patchStatus({ mcpServerStatus: status, mcpServerError: error });
        }, 3000);

        return true;
    }
    return false;
}

// ─── Instructions.md (Prompt Injection) ─────────────────────────────────

/**
 * Write instructions.md to the MCP server's directory.
 * Antigravity reads this file and injects its content into the agent's context
 * when the subagents MCP server is active. This is our primary mechanism for
 * prompt injection since we can't modify system prompts.
 *
 * Path: ~/.gemini/antigravity/mcp/subagents/instructions.md
 */
function writeInstructionsFile(): void {
    const instructionsDir = path.join(
        process.env.USERPROFILE || '',
        '.gemini', 'antigravity', 'mcp', 'subagents',
    );
    const instructionsPath = path.join(instructionsDir, 'instructions.md');

    const content = `# Sub-Agents System

You have access to a sub-agents system that lets you launch parallel workers to handle tasks concurrently. Each sub-agent gets its own conversation with full tool access.

## Launching Sub-Agents

Use \`launch_subagents\` to create one or more sub-agents. Each gets a task description and runs independently.

## Messaging & Results

After launching sub-agents, you do NOT need to poll or check status in a loop. The system automatically delivers results when all agents in a batch have finished. Simply proceed with other work or stop calling tools, and you will be notified when there are results to process.

Sub-agents report their results using the \`send_message\` tool. Results from all agents in a batch are collected and delivered together as a single consolidated report once every agent has finished.

## Cancellation

If the user stops your execution, all your sub-agents are automatically cancelled. Cancelled agents do not report results. Do not relaunch cancelled agents unless the user explicitly asks.
`;

    try {
        if (!fs.existsSync(instructionsDir)) {
            fs.mkdirSync(instructionsDir, { recursive: true });
        }
        fs.writeFileSync(instructionsPath, content, 'utf8');
        log(`Instructions written to ${instructionsPath}`);
    } catch (err: any) {
        log(`Failed to write instructions.md: ${err.message}`);
    }
}

export function deactivate(): void {
    log('Deactivating Sub-Agents extension');
}
