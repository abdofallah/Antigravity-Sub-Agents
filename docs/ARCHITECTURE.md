# Architecture Overview

This document describes the system architecture of Antigravity Sub-Agents — a VS Code extension that enables parallel agent orchestration inside [Antigravity IDE](https://antigravity.dev/).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Antigravity IDE                              │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  Agent Chat   │    │  Agent Mgr   │    │  Language Server     │  │
│  │  (Parent)     │◄──►│  Sidebar     │    │  (gRPC-Web)         │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│         │                   │ CDP                    │ RPC          │
│         │                   │                        │              │
│  ┌──────┴───────────────────┴────────────────────────┴───────────┐  │
│  │                   Sub-Agents Extension                        │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Orchestrator │  │MCP Bridge│  │CDP Inject│  │ TreeView │  │  │
│  │  │   (Brain)    │  │ (Tools)  │  │(Sidebar) │  │(VS Code) │  │  │
│  │  └──────┬───────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  │
│  │         │               │              │             │        │  │
│  │  ┌──────┴───────┐  ┌───┴────┐  ┌──────┴──────┐     │        │  │
│  │  │ StatusBar    │  │Notific.│  │ Types/Const  │     │        │  │
│  │  └──────────────┘  └────────┘  └─────────────┘     │        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. Extension Entry Point (`extension.ts`)

The activation function that wires everything together:

1. **Initializes the SDK** — connects to Antigravity's internal APIs.
2. **Creates the Orchestrator** — the central brain.
3. **Starts the MCP Bridge** — HTTP server exposing tools to agents.
4. **Connects CDP** — sidebar injection for real-time UI.
5. **Registers commands** — launch, cancel, health check, settings.
6. **Auto-installs MCP config** — writes `mcp_config.json` if missing.
7. **Checks CDP status** — warns and guides if not available.

### 2. Orchestrator (`orchestrator.ts`)

The core state machine managing the full sub-agent lifecycle.

**Responsibilities:**
- Agent creation via `launch()` and `quickLaunch()`
- Cascade creation through the Language Server gRPC-Web bridge
- State persistence to `ExtensionContext.globalState`
- Background polling loop (3-second interval) for progress tracking
- Status transition: `Pending → Running → Completed | Failed | Cancelled`
- Batch result reporting to parent conversations
- Cancel propagation (user-initiated vs parent-initiated)

**Key Internals:**

```
                 launch()
                    │
                    ▼
              ┌──────────┐
              │  Pending  │
              └─────┬─────┘
                    │  StartCascade + SendUserCascadeMessage
                    ▼
              ┌──────────┐
              │  Running  │◄─────────────────────────────┐
              └─────┬─────┘                              │
                    │                                    │
           ┌───────┼───────────┐                        │
           │       │           │                        │
           ▼       ▼           ▼                        │
    ┌───────┐ ┌────────┐ ┌──────────┐          ┌───────────────┐
    │Complet│ │ Failed │ │Cancelled │          │WaitingForAction│
    └───────┘ └────────┘ └──────────┘          └───────────────┘
```

**Polling Loop (`_pollProgress`):**

Every 3 seconds, the orchestrator:
1. Calls `listCascades()` to get all trajectory summaries.
2. Diffs step counts to detect progress.
3. Checks for `CASCADE_RUN_STATUS_IDLE` (completed turn).
4. Detects waiting steps that need user action.
5. Fires events for UI updates.
6. Reports completed batch results to parent.

### 3. MCP Bridge (`mcp-bridge.ts`)

An HTTP server that implements the MCP (Model Context Protocol) for agent-to-agent communication.

**How it works:**

```
  Parent Agent (LLM)
       │
       │  MCP tool call: launch_subagents
       ▼
  MCP Server Script (stdio)  ←→  HTTP Bridge (localhost:PORT)  ←→  Orchestrator
       │
       │  Response: { batchId, ids, ... }
       ▼
  Parent Agent continues...
       │
       │  (waits — results delivered automatically)
       ▼
  Batch report arrives via SendUserCascadeMessage
```

**Exposed Tools:**

| Tool | Description |
|------|-------------|
| `launch_subagents` | Create a batch of parallel sub-agents |
| `check_subagents` | Poll status (normally not needed) |
| `cancel_subagent` | Cancel a specific agent by ID |
| `get_subagent` | Get details of one agent |
| `get_batch` | Get all agents in a batch |

**Design Decision: Auto-Delivery**

The tool descriptions explicitly tell agents NOT to poll for status. When a batch completes, the orchestrator automatically sends the consolidated results as a message to the parent conversation using `SendUserCascadeMessage`. This prevents LLMs from wasting tokens on status checks.

### 4. CDP Sidebar Injector (`cdp-injector.ts`)

Injects real-time sub-agent status UI directly into the Antigravity Agent Manager sidebar. See [CDP.md](CDP.md) for the full deep-dive.

**Key features:**
- WebSocket connection to Chrome DevTools Protocol
- Target management (Launchpad → Manager switching)
- DOM injection with Trusted Types CSP compliance
- TanStack Router subscription for conversation detection
- MutationObserver + setInterval watchers for persistent UI enforcement

### 5. TreeView Providers (`tree-provider.ts`)

Standard VS Code TreeDataProviders for the sidebar panels:

- **ActiveTreeProvider** — shows running/pending/waiting sub-agents with live updates.
- **HistoryTreeProvider** — shows completed/failed/cancelled agents.

Both auto-refresh on orchestrator events.

### 6. Status Bar (`status-bar.ts`)

A `vscode.StatusBarItem` that shows the running agent count with a spinner animation. Clicks open the active sub-agents panel.

### 7. Notifications (`notifications.ts`)

Listens to orchestrator events and fires VS Code toast notifications for:
- Agent completion (with "View Chat" action)
- Agent failure (with error details)
- Action required (waiting for user approval)

### 8. Types (`types.ts`)

Central type definitions shared by all modules:
- `ISubAgent`, `ISubAgentBatch`, `ILaunchConfig`
- `SubAgentStatus` enum with lifecycle states
- Model constants (`AVAILABLE_MODELS`, `MODEL_NAMES`, `MODEL_LABELS`)
- Status utilities (`isActiveStatus`, `isTerminalStatus`)

## Data Flow

### Launch Flow

```
1. Parent agent calls MCP tool "launch_subagents"
2. MCP Bridge → Orchestrator.launch()
3. For each task:
   a. Generate cascade ID (UUID)
   b. StartCascade RPC → Language Server creates conversation
   c. SendUserCascadeMessage RPC → sends task prompt
   d. UpdateConversationAnnotations → archive the chat
   e. Track background conversation
4. Start polling loop
5. Return batch ID + agent IDs to parent
```

### Cancel Flow

```
Cancel Mode 1: USER_CANCELLED (from above-chat panel)
  → Orchestrator.cancel() → StopCascade RPC
  → Sets error = "USER_CANCELLED: ..."
  → Batch report includes retry warning
  → Parent agent receives: "🛑 Do NOT retry this agent"

Cancel Mode 2: PARENT_STOPPED (from chatbox overlay)
  → CdpInjector → cancelByParent()
  → Orchestrator._cancelSilent() → StopCascade RPC
  → Sets error = "PARENT_STOPPED: ..."
  → No batch report sent (parent is done)
```

### Event Flow

```
Orchestrator state change
    ↓ EventEmitter
    ├→ TreeView.refresh()        (sidebar)
    ├→ StatusBar.update()        (bottom bar)
    ├→ Notifications.fire()      (toasts)
    └→ CdpInjector.inject()      (Manager sidebar DOM)
```

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `subagents.defaultModel` | enum | `flash` | Default model for sub-agents |
| `subagents.cdpPort` | number | `9347` | CDP debugging port |
| `subagents.autoConnectCDP` | boolean | `true` | Auto-connect on startup |
| `subagents.autoInstallMCP` | boolean | `true` | Auto-install MCP config |

## Dependencies

| Package | Purpose |
|---------|---------|
| `antigravity-sdk` | Core SDK for LS Bridge, cascade management |
| `vscode` | VS Code extension API (peer dependency) |
| `ws` | WebSocket client for CDP (resolved from IDE) |

The SDK is **bundled** into the extension (`noExternal` in tsup config) so users don't need to install it separately.
