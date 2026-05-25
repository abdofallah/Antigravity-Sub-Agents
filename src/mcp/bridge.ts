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
 * @module mcp/bridge
 */

import * as http from 'http';
import * as vscode from 'vscode';
import { Orchestrator } from '../orchestrator';
import { generateMcpServerScript } from './server-script';
import {
    handleLaunch,
    handleCancel,
    handleStatus,
    handleGetAgent,
    handleGetBatch,
    handleSendMessage,
    handleApproveAction,
    handleRespondAction,
    handleRejectAction,
} from './handlers';

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
     * Generate the standalone MCP server script that forwards to our bridge.
     */
    generateMcpServerScript(): string {
        return generateMcpServerScript(this._port);
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
                result = await handleLaunch(this._orchestrator, body);
            } else if (req.method === 'POST' && req.url === '/cancel') {
                result = await handleCancel(this._orchestrator, body);
            } else if (req.method === 'GET' && req.url === '/status') {
                result = handleStatus(this._orchestrator);
            } else if (req.method === 'POST' && req.url === '/get-agent') {
                result = handleGetAgent(this._orchestrator, body);
            } else if (req.method === 'POST' && req.url === '/get-batch') {
                result = handleGetBatch(this._orchestrator, body);
            } else if (req.method === 'POST' && req.url === '/send-message') {
                result = await handleSendMessage(this._orchestrator, body);
            } else if (req.method === 'POST' && req.url === '/approve-action') {
                result = await handleApproveAction(this._orchestrator, body);
            } else if (req.method === 'POST' && req.url === '/respond-action') {
                result = await handleRespondAction(this._orchestrator, body);
            } else if (req.method === 'POST' && req.url === '/reject-action') {
                result = await handleRejectAction(this._orchestrator, body);
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

    dispose(): void {
        if (this._server) {
            this._server.close();
            this._server = null;
        }
        for (const d of this._disposables) d.dispose();
    }
}
