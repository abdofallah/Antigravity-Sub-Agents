/**
 * MCP Bridge — Local HTTP server for agent-triggered sub-agent launches
 *
 * Architecture:
 * 1. Extension starts a local HTTP server on 127.0.0.1:{port}
 * 2. A companion MCP server (configured in AG's MCP settings) forwards
 *    agent tool calls to this HTTP server
 * 3. Extension processes the request using Orchestrator + SDK
 * 4. Results flow back to the agent via MCP tool response
 *
 * Endpoints:
 *   POST /launch     — Launch sub-agents
 *   POST /cancel     — Cancel a sub-agent
 *   GET  /status     — Get all sub-agent statuses
 *   GET  /results    — Get completed sub-agent results
 *
 * @module mcp-bridge
 */

import * as http from 'http';
import * as vscode from 'vscode';
import { Models } from 'antigravity-sdk';
import { Orchestrator } from './orchestrator';
import { MODEL_NAMES, STATUS_ICONS, isActiveStatus } from './types';

/** Default port for the bridge server */
const DEFAULT_PORT = 39847;

export class McpBridge implements vscode.Disposable {
    private _server: http.Server | null = null;
    private _port: number = DEFAULT_PORT;
    private readonly _disposables: vscode.Disposable[] = [];

    constructor(private readonly _orchestrator: Orchestrator) { }

    /** The port the bridge is listening on */
    get port(): number {
        return this._port;
    }

    /**
     * Start the HTTP bridge server.
     */
    async start(port?: number): Promise<number> {
        this._port = port || DEFAULT_PORT;

        return new Promise((resolve, reject) => {
            this._server = http.createServer((req, res) => {
                this._handleRequest(req, res);
            });

            this._server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    // Try next port
                    this._port++;
                    this._server?.close();
                    this.start(this._port).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });

            this._server.listen(this._port, '127.0.0.1', () => {
                console.log(`[SubAgents] MCP Bridge listening on 127.0.0.1:${this._port}`);
                resolve(this._port);
            });
        });
    }

    /**
     * Generate the MCP server configuration for AG's mcp_config.json.
     */
    getMcpConfig(): object {
        return {
            mcpServers: {
                subagents: {
                    command: 'node',
                    args: [this._getMcpServerScriptPath()],
                    env: {
                        SUBAGENTS_BRIDGE_PORT: String(this._port),
                    },
                },
            },
        };
    }

    /**
     * Generate the standalone MCP server script that forwards to our bridge.
     */
    generateMcpServerScript(): string {
        return `#!/usr/bin/env node
/**
 * Sub-Agents MCP Server
 *
 * Forwards agent tool calls to the Sub-Agents extension bridge.
 * Implements MCP protocol over stdio transport.
 *
 * Configure in Antigravity's mcp_config.json:
 * {
 *   "mcpServers": {
 *     "subagents": {
 *       "command": "node",
 *       "args": ["path/to/this/script.js"],
 *       "env": { "SUBAGENTS_BRIDGE_PORT": "${this._port}" }
 *     }
 *   }
 * }
 */
const http = require('http');
const BRIDGE_PORT = process.env.SUBAGENTS_BRIDGE_PORT || ${this._port};

// MCP stdio transport
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

function send(msg) {
    process.stdout.write(JSON.stringify(msg) + '\\n');
}

function bridgeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const req = http.request({
            hostname: '127.0.0.1',
            port: BRIDGE_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        }, (res) => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                try { resolve(JSON.parse(chunks)); }
                catch { resolve({ raw: chunks }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Tool definitions
const TOOLS = [
    {
        name: 'launch_subagents',
        description: 'Launch one or more sub-agents to work on tasks in parallel. Each sub-agent gets its own conversation and can use all available tools and MCPs. You can specify different models for different tasks. IMPORTANT: After launching, do NOT poll or check status — results will be delivered to you automatically when all agents in the batch complete. If the user stops your execution, all sub-agents are automatically cancelled.',
        inputSchema: {
            type: 'object',
            properties: {
                tasks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of task descriptions — one per sub-agent',
                },
                labels: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional custom names for each sub-agent (e.g. ["File analyzer", "Test runner"]). Falls back to Sub-Agent 1, 2, etc.',
                },
                model: {
                    description: 'Model to use for ALL sub-agents (string) OR per-agent (array). Options: flash (Gemini Flash), pro-low, pro-high, sonnet (Claude), opus (Claude), gpt',
                    default: 'flash',
                    oneOf: [
                        { type: 'string', enum: ['flash', 'pro-low', 'pro-high', 'sonnet', 'opus', 'gpt'] },
                        { type: 'array', items: { type: 'string', enum: ['flash', 'pro-low', 'pro-high', 'sonnet', 'opus', 'gpt'] } }
                    ],
                },
                description: {
                    type: 'string',
                    description: 'Short description of what this batch is for',
                },
                workspaceUri: {
                    type: 'string',
                    description: 'Optional workspace URI to bind sub-agents to (e.g. file:///c%3A/Users/me/project). If not provided, inherits from parent conversation.',
                },
            },
            required: ['tasks'],
        },
    },
    {
        name: 'check_subagents',
        description: 'Check the status of all running sub-agents. Returns their current state, step counts, and whether any need user action. NOTE: You normally do NOT need to call this — results are delivered to you automatically when batches complete. Only use this if explicitly asked by the user.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'cancel_subagent',
        description: 'Cancel a specific running sub-agent by its ID.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'The cascade ID of the sub-agent to cancel',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'get_subagent',
        description: 'Get details of a specific sub-agent by its cascade ID. NOTE: You normally do NOT need to call this — results are delivered automatically. Only use if the user explicitly asks for details about a specific agent.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'The cascade ID of the sub-agent',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'get_batch',
        description: 'Get all sub-agents belonging to a specific batch. Returns the batch info and all agent statuses. NOTE: You normally do NOT need to call this — batch results are delivered automatically when complete.',
        inputSchema: {
            type: 'object',
            properties: {
                batchId: {
                    type: 'string',
                    description: 'The batch ID returned from launch_subagents',
                },
            },
            required: ['batchId'],
        },
    },
];

// Handle MCP messages
rl.on('line', async (line) => {
    try {
        const msg = JSON.parse(line);

        if (msg.method === 'initialize') {
            send({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    protocolVersion: '2024-11-05',
                    serverInfo: { name: 'subagents', version: '0.1.0' },
                    capabilities: { tools: {} },
                },
            });
        } else if (msg.method === 'tools/list') {
            send({
                jsonrpc: '2.0',
                id: msg.id,
                result: { tools: TOOLS },
            });
        } else if (msg.method === 'tools/call') {
            const toolName = msg.params.name;
            const args = msg.params.arguments || {};
            let result;

            try {
                if (toolName === 'launch_subagents') {
                    result = await bridgeRequest('POST', '/launch', args);
                } else if (toolName === 'check_subagents') {
                    result = await bridgeRequest('GET', '/status');
                } else if (toolName === 'cancel_subagent') {
                    result = await bridgeRequest('POST', '/cancel', args);
                } else if (toolName === 'get_subagent') {
                    result = await bridgeRequest('POST', '/get-agent', args);
                } else if (toolName === 'get_batch') {
                    result = await bridgeRequest('POST', '/get-batch', args);
                } else {
                    result = { error: 'Unknown tool: ' + toolName };
                }
            } catch (err) {
                result = { error: 'Bridge error: ' + err.message };
            }

            send({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
                },
            });
        } else if (msg.method === 'notifications/initialized') {
            // Client acknowledged — no response needed
        } else {
            send({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32601, message: 'Method not found: ' + msg.method },
            });
        }
    } catch (err) {
        // Ignore parse errors
    }
});
`;
    }

    // ─── Request Handling ───────────────────────────────────────────────

    private async _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // CORS headers for local
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const body = await this._readBody(req);

        try {
            let result: any;

            if (req.method === 'POST' && req.url === '/launch') {
                result = await this._handleLaunch(body);
            } else if (req.method === 'POST' && req.url === '/cancel') {
                result = await this._handleCancel(body);
            } else if (req.method === 'GET' && req.url === '/status') {
                result = this._handleStatus();
            } else if (req.method === 'POST' && req.url === '/get-agent') {
                result = this._handleGetAgent(body);
            } else if (req.method === 'POST' && req.url === '/get-batch') {
                result = this._handleGetBatch(body);
            } else if (req.method === 'GET' && req.url === '/health') {
                result = { status: 'ok', activeCount: this._orchestrator.activeCount };
            } else {
                res.statusCode = 404;
                result = { error: 'Not found' };
            }

            res.end(JSON.stringify(result));
        } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message || 'Internal error' }));
        }
    }

    private async _handleLaunch(body: any): Promise<any> {
        const tasks: string[] = body.tasks || [];
        if (tasks.length === 0) {
            return { error: 'No tasks provided' };
        }

        // Support per-agent models: string → single model for all, array → per-agent
        // Fall back to the configured default model from extension settings
        const vscode = require('vscode');
        const defaultModelSetting = vscode.workspace.getConfiguration('subagents').get('defaultModel', 'flash');
        let model: number | number[];
        if (Array.isArray(body.model)) {
            model = body.model.map((m: string) => this._resolveModel(m || defaultModelSetting));
        } else {
            model = this._resolveModel(body.model || defaultModelSetting);
        }

        const result = await this._orchestrator.launch({
            tasks,
            labels: body.labels,
            model,
            description: body.description || `${tasks.length} sub-agents`,
            workspaceUri: body.workspaceUri,
        });

        return {
            success: true,
            batchId: result.batchId,
            launched: result.ids.length,
            ids: result.ids,
            message: `Launched ${result.ids.length} sub-agents`,
        };
    }

    private async _handleCancel(body: any): Promise<any> {
        const id = body.id;
        if (!id) return { error: 'No id provided' };

        await this._orchestrator.cancel(id);
        return {
            success: true,
            cancelled: true,
            cancelledByUser: true,
            message: `Sub-agent ${id} was stopped by the user. This cancellation is intentional — do NOT relaunch or retry this agent.`,
        };
    }

    private _handleStatus(): any {
        const agents = this._orchestrator.getAll();
        return {
            total: agents.length,
            active: agents.filter(a => isActiveStatus(a.status)).length,
            agents: agents.map(a => this._formatAgent(a)),
        };
    }

    private _handleGetAgent(body: any): any {
        const id = body.id;
        if (!id) return { error: 'No id provided' };

        const agent = this._orchestrator.get(id);
        if (!agent) return { error: `Sub-agent ${id} not found` };

        return this._formatAgent(agent);
    }

    private _handleGetBatch(body: any): any {
        const batchId = body.batchId;
        if (!batchId) return { error: 'No batchId provided' };

        const batch = this._orchestrator.getBatch(batchId);
        if (!batch) return { error: `Batch ${batchId} not found` };

        const agents = this._orchestrator.getByBatch(batchId);
        return {
            batchId: batch.id,
            parentId: batch.parentId,
            description: batch.description,
            createdAt: new Date(batch.createdAt).toISOString(),
            total: agents.length,
            active: agents.filter(a => isActiveStatus(a.status)).length,
            agents: agents.map(a => this._formatAgent(a)),
        };
    }

    private _formatAgent(a: any): any {
        const isCancelledByUser = a.status === 'cancelled' && a.error?.startsWith('USER_CANCELLED');
        return {
            id: a.id,
            label: a.label,
            status: a.status,
            icon: STATUS_ICONS[a.status],
            model: MODEL_NAMES[a.model] || 'unknown',
            stepCount: a.stepCount,
            task: a.task.substring(0, 200),
            batchId: a.batchId,
            createdAt: new Date(a.createdAt).toISOString(),
            completedAt: a.completedAt ? new Date(a.completedAt).toISOString() : null,
            error: a.error || null,
            cancelledByUser: isCancelledByUser,
            ...(isCancelledByUser ? { userCancelled: 'This agent was explicitly stopped by the user. Do NOT relaunch, retry, or re-attempt this task.' } : {}),
        };
    }

    private _resolveModel(name: string): number {
        const map: Record<string, number> = {
            'flash': Models.GEMINI_FLASH,
            'pro-low': Models.GEMINI_PRO_LOW,
            'pro-high': Models.GEMINI_PRO_HIGH,
            'sonnet': Models.CLAUDE_SONNET,
            'opus': Models.CLAUDE_OPUS,
            'gpt': Models.GPT_OSS,
        };
        return map[name.toLowerCase()] || Models.GEMINI_FLASH;
    }

    private _readBody(req: http.IncomingMessage): Promise<any> {
        return new Promise((resolve) => {
            if (req.method === 'GET') {
                resolve({});
                return;
            }
            let data = '';
            req.on('data', (chunk: string) => data += chunk);
            req.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({}); }
            });
        });
    }

    private _getMcpServerScriptPath(): string {
        // Will be written to extension's storage directory
        return '';
    }

    dispose(): void {
        if (this._server) {
            this._server.close();
            this._server = null;
        }
        for (const d of this._disposables) d.dispose();
    }
}
