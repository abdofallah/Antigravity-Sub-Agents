/**
 * Instructions File Generator
 *
 * Writes instructions.md for prompt injection via Antigravity's MCP system.
 * The LS reads this file and injects its content into the agent's context
 * when the subagents MCP server is active.
 *
 * Path: ~/.gemini/antigravity/mcp/subagents/instructions.md
 *
 * @module config/instructions
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Write instructions.md to the MCP server's directory.
 * Antigravity reads this file and injects its content into the agent's context
 * when the subagents MCP server is active. This is our primary mechanism for
 * prompt injection since we can't modify system prompts.
 */
export function writeInstructionsFile(log: (msg: string) => void): void {
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
