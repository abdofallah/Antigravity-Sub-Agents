# Antigravity Sub-Agents

> Launch, monitor, and orchestrate parallel AI sub-agents inside [Antigravity IDE](https://antigravity.dev/).

[![Release](https://github.com/abdofallah/Antigravity-Sub-Agents/actions/workflows/release.yml/badge.svg)](https://github.com/abdofallah/Antigravity-Sub-Agents/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<!-- GitHub renders <video> on .md files; on other markdown viewers the link below acts as a fallback. -->
<video src="https://private-user-images.githubusercontent.com/38984510/598565132-92d56915-0090-4067-8044-310256ad8ba3.mp4" controls width="100%"></video>

> 🎬 [Watch the demo video](./.github/antigravity%20subagents%20extension.mp4) if it doesn't autoplay.

## Why?

Alot of us are disappointed in the approach google has taken for 2.0... it could just have been as simple as this than a standalone manager and disconnected IDE.

## What Is This?

Antigravity Sub-Agents is a VS Code extension that gives Antigravity IDE's AI agents the ability to **spawn child agents** that work in parallel. A parent agent can launch multiple sub-agents, each with their own conversation, and receive consolidated results when they finish.

**Example:** A parent agent tasked with "refactor this codebase" can launch three sub-agents — one to refactor the auth module, one for the database layer, and one to update tests — all running simultaneously.

## Features

- **🚀 Parallel Execution** — Launch up to 20 sub-agents at once, each in its own conversation.
- **🧠 Multi-Model** — Choose per-agent models: Gemini Flash, Pro, Claude Sonnet/Opus, GPT.
- **📊 Real-Time Status** — Live status panel injected into the Agent Manager sidebar via CDP.
- **🔒 Chat Locking** — Sub-agent chats are view-only; users interact through the parent.
- **🔄 Auto-Delivery** — Results are automatically delivered to the parent when all agents finish.
- **♻️ Restart Recovery** — Sub-agents that were running, waiting for approval, or completing during an extension/IDE restart are detected on next launch and restored to the correct state (Running / WaitingForAction / Completed / Cancelled) without any manual intervention.
- **⏹ Cancel Control** — Stop individual agents, all agents, or silently terminate without reporting.
- **🔌 MCP Integration** — Exposes tools via Model Context Protocol so agents can spawn sub-agents programmatically.
- **⚙️ Configurable** — Default model, CDP port, auto-connect, auto-install settings.

## Quick Start

### 1. Install

Download the latest `.vsix` from [Releases](https://github.com/abdofallah/Antigravity-Sub-Agents/releases) and install:

```
Antigravity IDE → Extensions → ⋯ → Install from VSIX...
```

### 2. Enable CDP (for sidebar injection)

Launch Antigravity with Chrome DevTools Protocol enabled:

```bash
# Windows
Antigravity.exe --remote-debugging-port=9347

# Or set permanently
[System.Environment]::SetEnvironmentVariable("ELECTRON_EXTRA_LAUNCH_ARGS", "--remote-debugging-port=9347", "User")
```

> **Tip:** Use the command palette: `Sub-Agents: Setup CDP` for guided setup.

### 3. MCP Config (auto-installed)

The extension automatically writes the MCP server config on first activation. If needed, verify in `Manage MCPs`:

```json
{
    "mcpServers": {
        "subagents": {
            "command": "node",
            "args": ["<extension-path>/mcp-server.js"],
            "env": { "SUBAGENTS_BRIDGE_PORT": "<port>" }
        }
    }
}
```

### 4. Use It

Once configured, any Antigravity agent can use the sub-agents tools:

```
Agent: "I'll launch 3 sub-agents to work on this in parallel..."
→ Calls: launch_subagents({ tasks: [...], model: "flash" })
→ 3 sub-agents start working
→ Results delivered automatically to the parent
```

## Architecture

```
Parent Agent ──► MCP Bridge ──► Orchestrator ──► Language Server
                                    │
                        ┌───────────┼───────────┐
                        ▼           ▼           ▼
                   Sub-Agent 1  Sub-Agent 2  Sub-Agent 3
                        │           │           │
                        └───────────┼───────────┘
                                    ▼
                           Batch Report → Parent
```

For detailed architecture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

For CDP injection details, see [docs/CDP.md](docs/CDP.md).

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `subagents.defaultModel` | `flash` | Default model for new sub-agents |
| `subagents.cdpPort` | `9347` | CDP debugging port |
| `subagents.autoConnectCDP` | `true` | Connect to CDP on startup |
| `subagents.autoInstallMCP` | `true` | Auto-install MCP config |

Access via: Command Palette → `Sub-Agents: Open Sub-Agents Settings`

## Commands

| Command | Description |
|---------|-------------|
| `Sub-Agents: Launch Sub-Agents...` | Full launch wizard |
| `Sub-Agents: Quick Launch` | Single agent quick launch |
| `Sub-Agents: Cancel All` | Stop all running agents |
| `Sub-Agents: Check Extension Health` | Diagnostic status check |
| `Sub-Agents: Setup CDP` | CDP configuration wizard |
| `Sub-Agents: Open Settings` | Open extension settings |
| `Sub-Agents: Open Manager DevTools` | Debug the Manager target |

## MCP Tools (for Agents)

When an AI agent has access to the `subagents` MCP server, these tools are available:

| Tool | Description |
|------|-------------|
| `launch_subagents` | Launch parallel sub-agents with tasks and model selection |
| `check_subagents` | Check running agent status (normally not needed) |
| `cancel_subagent` | Cancel a specific agent by ID |
| `get_subagent` | Get details of a specific agent |
| `get_batch` | Get all agents in a batch |
| `send_message` | Send results from sub-agent to parent |

## Development

```bash
git clone https://github.com/abdofallah/Antigravity-Sub-Agents.git
cd Antigravity-Sub-Agents
npm install
npm run build    # Build + tests (24 CDP smoke tests)
npm run dev      # Watch mode (rebuilds on changes)
npm run test     # Run tests only
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

## Requirements

- [Antigravity IDE](https://antigravity.dev/) v1.107+
- Node.js 16+ (for MCP server)
- CDP enabled (for sidebar injection)

## Dependencies

This extension uses the [Antigravity SDK](https://github.com/Kanezal/antigravity-sdk) (bundled automatically — no separate installation needed).

## License

[MIT](LICENSE)

## Acknowledgments

- [Kanezal](https://github.com/Kanezal) — Antigravity SDK
- [Antigravity](https://antigravity.dev/) — IDE platform
