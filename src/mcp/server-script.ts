/**
 * MCP Server Script Generator
 *
 * Generates the standalone Node.js MCP server script that communicates
 * with the sub-agents extension via the HTTP bridge.
 *
 * The generated script implements the MCP protocol over stdio transport
 * and forwards tool calls to our local HTTP bridge.
 *
 * @module mcp/server-script
 */

/**
 * Generate the MCP server script content.
 * @param bridgePort - The HTTP bridge port to forward tool calls to
 */
export function generateMcpServerScript(bridgePort: number): string {
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
 *       "env": { "SUBAGENTS_BRIDGE_PORT": "${bridgePort}" }
 *     }
 *   }
 * }
 */
const http = require('http');
const BRIDGE_PORT = process.env.SUBAGENTS_BRIDGE_PORT || ${bridgePort};

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
    {
        name: 'send_message',
        description: 'Send a message to the parent agent that launched you. Use this to report your results, findings, and conclusions when you have completed your task. IMPORTANT: Your text output is NOT automatically sent to the parent — you MUST call this tool to communicate. Include all important information (findings, summaries, file paths, conclusions) in your message.',
        inputSchema: {
            type: 'object',
            properties: {
                parentId: {
                    type: 'string',
                    description: 'The conversation ID of the parent agent (provided in your task context)',
                },
                message: {
                    type: 'string',
                    description: 'The message content to send. Include all findings, summaries, file paths, and conclusions.',
                },
            },
            required: ['parentId', 'message'],
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
                } else if (toolName === 'send_message') {
                    result = await bridgeRequest('POST', '/send-message', args);
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
