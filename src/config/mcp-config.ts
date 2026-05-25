/**
 * MCP Configuration Management
 *
 * Handles finding, reading, writing, and auto-fixing the MCP configuration
 * that registers the subagents MCP server with Antigravity's Language Server.
 *
 * @module config/mcp-config
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { AntigravitySDK } from 'antigravity-sdk';
import { StatusTreeProvider, McpServerHealth } from '../tree-provider';

// ─── Types ──────────────────────────────────────────────────────────────

export { McpServerHealth };

// ─── Path Discovery ─────────────────────────────────────────────────────

/** All known MCP config file locations, ordered by priority (primary first) */
export function getMcpConfigPaths(): string[] {
    return [
        // .gemini/antigravity is where the LS actually reads from
        path.join(process.env.USERPROFILE || '', '.gemini', 'antigravity', 'mcp_config.json'),
        path.join(process.env.APPDATA || '', 'Antigravity', 'User', 'mcp_config.json'),
        path.join(process.env.USERPROFILE || '', '.antigravity', 'mcp_config.json'),
        path.join(process.env.APPDATA || '', 'Antigravity', 'mcp_config.json'),
    ];
}

/** Build the subagents MCP entry with correct Antigravity protobuf format */
export function buildSubagentsEntry(scriptPath: string, bridgePort: number): Record<string, any> {
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
export function findMcpConfig(): { configPath: string; existingConfig: any } {
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
export function writeMcpSubagentsConfig(configPath: string, existingConfig: any, scriptPath: string, bridgePort: number): boolean {
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

// ─── LS RPC Helpers ─────────────────────────────────────────────────────

/**
 * Tell the Language Server to reload MCP server configurations.
 * This picks up changes to mcp_config.json without needing a restart.
 */
export async function refreshMcpServers(sdk: AntigravitySDK, log: (msg: string) => void): Promise<void> {
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
 * Query the Language Server's GetMcpServerStates RPC to get the live
 * status of our 'subagents' MCP server.
 *
 * Returns the health status and any error message.
 */
export async function queryMcpServerHealth(sdk: AntigravitySDK, log: (msg: string) => void): Promise<{ status: McpServerHealth; error: string }> {
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

// ─── Auto-Install & Auto-Fix ────────────────────────────────────────────

/**
 * Check if the MCP server is configured, and if not, install it.
 * Also fixes stale paths (e.g. after moving the project).
 */
export async function autoInstallMcpConfig(
    context: vscode.ExtensionContext,
    bridgePort: number,
    sdk: AntigravitySDK,
    log: (msg: string) => void,
): Promise<void> {
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
        await refreshMcpServers(sdk, log);
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

/**
 * Silent auto-fix: updates the MCP config with correct paths + refreshes LS.
 * Returns true on success. Used both by the manual fix command and the auto-fix poll.
 */
export async function autoFixMcpServer(
    context: vscode.ExtensionContext,
    mcpPort: number,
    statusTree: StatusTreeProvider,
    sdk: AntigravitySDK,
    log: (msg: string) => void,
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
        await refreshMcpServers(sdk, log);

        // Update status immediately
        statusTree.patchStatus({ mcpServerStatus: 'initializing', mcpServerError: '' });

        // Re-check after a delay
        setTimeout(async () => {
            const { status, error } = await queryMcpServerHealth(sdk, log);
            statusTree.patchStatus({ mcpServerStatus: status, mcpServerError: error });
        }, 3000);

        return true;
    }
    return false;
}

/**
 * Fix MCP server: reinstall config with correct paths + refresh LS.
 * Called from the status panel when the MCP server is in error state.
 */
export async function fixMcpServer(
    context: vscode.ExtensionContext,
    mcpPort: number,
    statusTree: StatusTreeProvider,
    sdk: AntigravitySDK,
    log: (msg: string) => void,
): Promise<void> {
    const ok = await autoFixMcpServer(context, mcpPort, statusTree, sdk, log);
    if (ok) {
        vscode.window.showInformationMessage(
            '✅ MCP config reinstalled and LS refreshed. Server should restart shortly.',
        );
    } else {
        vscode.window.showErrorMessage('Failed to fix MCP config. Check the output log for details.');
    }
}
