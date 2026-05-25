/**
 * Health Check & CDP Setup Commands
 *
 * @module commands/health-check
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AntigravitySDK } from 'antigravity-sdk';
import { CdpSidebarInjector } from '../cdp';
import { getConfig, getCdpPort } from '../config/settings';
import { queryMcpServerHealth } from '../config/mcp-config';

/** Quick probe to check if a port is open */
export function probeCdpPort(port: number): Promise<boolean> {
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

/** Show the CDP setup guide when port is unavailable */
export function showCdpSetupGuide(port: number): void {
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

/** Create a .bat script to launch Antigravity with CDP enabled */
export async function setupCdpLaunch(): Promise<void> {
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

/** Show full health check QuickPick */
export async function showHealthCheck(
    sdk: AntigravitySDK,
    cdpInjector: CdpSidebarInjector | null,
    mcpPort: number,
    log: (msg: string) => void,
): Promise<void> {
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
    const { status: mcpHealth, error: mcpErr } = await queryMcpServerHealth(sdk, log);
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
