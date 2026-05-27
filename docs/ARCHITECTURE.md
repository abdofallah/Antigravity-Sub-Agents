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

## Source Layout

```
src/
├── extension.ts                  Entry point — pure wire-up (~200 LOC)
├── types.ts                      Shared types, enums, constants
├── tree-provider.ts              VS Code TreeView providers
├── status-bar.ts                 Status bar widget
├── notifications.ts              Toast notification manager
│
├── config/                       ─── Configuration & Setup ───
│   ├── settings.ts               Settings reads, model maps
│   ├── mcp-config.ts             MCP config find/write/auto-fix/health
│   └── instructions.ts           Prompt injection file writer
│
├── commands/                     ─── VS Code Commands ───
│   ├── index.ts                  Command registration hub
│   ├── launch-flow.ts            Multi-agent QuickPick launch wizard
│   ├── quick-launch.ts           Single-agent quick launch
│   └── health-check.ts           CDP setup guide, port probe, diagnostics
│
├── cdp/                          ─── Chrome DevTools Protocol ───
│   ├── index.ts                  Re-exports CdpSidebarInjector
│   ├── cdp-injector.ts           Connection + injection orchestration
│   ├── target-manager.ts         HTTP /json, ws module, target selection
│   └── scripts/
│       ├── css.ts                Injection CSS builder
│       ├── build-router-sub.ts   TanStack Router subscription
│       ├── build-chatbox-ui.ts   Dropdown + notification badge
│       ├── build-lock-watcher.ts Sub-agent chat restrictions
│       └── build-panel-script.ts Main panel injection IIFE
│
├── mcp/                          ─── Model Context Protocol Bridge ───
│   ├── index.ts                  Re-exports McpBridge
│   ├── bridge.ts                 HTTP server lifecycle + routing
│   ├── handlers.ts               Individual endpoint handlers
│   └── server-script.ts          MCP stdio server script generator
│
├── orchestrator/                 ─── Core Brain ───
│   ├── index.ts                  Re-exports Orchestrator class
│   ├── orchestrator.ts           Slim coordinator (~340 LOC)
│   ├── launcher.ts               Workspace discovery + cascade creation
│   ├── monitor.ts                Polling + stale detection + action extraction
│   ├── messaging.ts              send_message buffering + batch delivery
│   └── actions.ts                Cancel, approve, respond, reject, viewChat
│
└── tests/                        ─── Validation ───
    └── cdp-scripts.test.ts       37 CDP script smoke tests
```

## Module Breakdown

### 1. Extension Entry Point (`extension.ts`)

A slim ~200-line wire-up file that coordinates all modules:

1. **Initializes the SDK** — connects to Antigravity's internal APIs.
2. **Creates the Orchestrator** — the central brain.
3. **Starts the MCP Bridge** — HTTP server exposing tools to agents.
4. **Connects CDP** — sidebar injection for real-time UI.
5. **Registers commands** — delegated to `commands/index.ts`.
6. **Auto-installs MCP config** — via `config/mcp-config.ts`.
7. **Status polling** — MCP health checks with auto-fix.

### 2. Orchestrator (`orchestrator/`)

The core state machine managing the full sub-agent lifecycle. The main class (`orchestrator.ts`) delegates heavy operations to focused sub-modules via context interfaces.

**Sub-modules:**

| Module | Responsibility |
|--------|---------------|
| `launcher.ts` | Workspace discovery, cascade creation, staggering, annotation |
| `monitor.ts` | 3s polling loop, step diffing, stale detection, action parsing |
| `messaging.ts` | Message buffering, batch delivery checks, trajectory results |
| `actions.ts` | Cancel, approve, respond, reject, viewChat, clearHistory |

**Context Interface Pattern:**

Each sub-module defines a `*Context` interface (e.g., `LaunchContext`, `MonitorContext`) that the main `Orchestrator` class satisfies via lightweight context builder methods. This avoids circular imports while giving helpers access to shared state.

**Lifecycle State Machine:**

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

**Polling Loop (`monitor.ts: pollProgress`):**

Every 3 seconds (configurable via `subagents.progressPollInterval`), the monitor:
1. Calls `listCascades()` to get all trajectory summaries.
2. Diffs step counts to detect progress.
3. Checks for `CASCADE_RUN_STATUS_IDLE` (completed turn).
4. Detects waiting steps that need user action.
5. Fires events for UI updates.
6. Triggers batch delivery when all agents in a batch complete.

**Restart Recovery (`orchestrator.ts: recoverLostAgents`):**

On activation, every agent whose persisted status is `Failed` with the `LOST_TRACKING_ERROR` sentinel is re-checked against the LS:

1. Phase 1 — `listCascades()` confirms the cascade still exists. Cascades missing on the LS side stay `Failed` with a clarified reason.
2. Phase 2 — `getConversation(cascadeId)` is the authoritative source for `waitingSteps`, `requestedInteractions`, and full `stepCount`. Earlier revisions used only the summary endpoint, which never includes `waitingSteps`, and wrongly demoted `WaitingForAction` agents to `Completed`.
3. Priority resolution:
   - **P0:** Persisted `pendingAction` + no live `waitingSteps` + no step progress → `Cancelled` with `IDE_CANCELLED_ERROR` (native IDE behaviour: pending interactions are auto-cancelled on restart).
   - **P1:** Any `waitingSteps` present → `WaitingForAction` and re-extract action details.
   - **P2:** `CASCADE_RUN_STATUS_IDLE` + steps > 0 → silent `Completed` (no parent delivery, since this agent likely finished in a previous extension session).
   - **Default:** Revive as `Running` and let the standing monitor disambiguate.
4. The `messaging.checkBatchDelivery` short-circuits when every agent in a batch is `IDE_CANCELLED_ERROR` so the parent never sees a spurious "Report sent" message for work that never ran.

### 3. MCP Bridge (`mcp/`)

An HTTP server that implements the MCP (Model Context Protocol) for agent-to-agent communication.

**Architecture:**

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

**Sub-modules:**

| Module | Role |
|--------|------|
| `bridge.ts` | HTTP server lifecycle, request routing, CORS |
| `handlers.ts` | Individual endpoint handlers, model resolution, agent formatting |
| `server-script.ts` | Generates the standalone Node.js MCP stdio server script |

**Exposed Tools:**

| Tool | Description |
|------|-------------|
| `launch_subagents` | Create a batch of parallel sub-agents |
| `check_subagents` | Poll status (normally not needed) |
| `cancel_subagent` | Cancel a specific agent by ID |
| `get_subagent` | Get details of one agent |
| `get_batch` | Get all agents in a batch |
| `send_message` | Send results from sub-agent to parent |

**Design Decision: Auto-Delivery**

The tool descriptions explicitly tell agents NOT to poll for status. When a batch completes, the orchestrator automatically sends consolidated results as a message to the parent conversation using `SendUserCascadeMessage`. This prevents LLMs from wasting tokens on status checks.

### 4. CDP Sidebar Injector (`cdp/`)

Injects real-time sub-agent status UI directly into the Antigravity Agent Manager sidebar. See [CDP.md](CDP.md) for the full deep-dive.

**Sub-modules:**

| Module | Role |
|--------|------|
| `cdp-injector.ts` | WebSocket connection, injection orchestration, event bindings |
| `target-manager.ts` | HTTP target discovery, ws module resolution, best-target selection |
| `scripts/css.ts` | Generates injection CSS (dot indicators, spinners, animations) |
| `scripts/build-router-sub.ts` | TanStack Router subscription for conversation detection |
| `scripts/build-chatbox-ui.ts` | Parent chat dropdown + notification badge |
| `scripts/build-lock-watcher.ts` | Sub-agent chat restrictions + archive banner overrides |
| `scripts/build-panel-script.ts` | Main panel injection IIFE composing all fragments |

**Key features:**
- WebSocket connection to Chrome DevTools Protocol
- Target management (Launchpad → Manager switching)
- DOM injection with Trusted Types CSP compliance
- TanStack Router subscription for conversation detection
- MutationObserver + setInterval watchers for persistent UI enforcement

### 5. Config (`config/`)

Centralized configuration management:

| Module | Role |
|--------|------|
| `settings.ts` | `getConfig()`, `getCdpPort()`, `getDefaultModel()`, poll intervals, `getDebugLogging()`, model maps |
| `mcp-config.ts` | Find/write/auto-fix MCP config, health queries, LS refresh |
| `instructions.ts` | Write `instructions.md` for MCP prompt injection |

### 6. Commands (`commands/`)

VS Code command handlers extracted from `extension.ts`:

| Module | Role |
|--------|------|
| `index.ts` | Registers all commands via `registerAllCommands()` |
| `launch-flow.ts` | Multi-agent QuickPick wizard |
| `quick-launch.ts` | Single-agent quick launch |
| `health-check.ts` | CDP setup guide, port probe, diagnostic panel |

### 7. TreeView Providers (`tree-provider.ts`)

Standard VS Code TreeDataProviders for the sidebar panels:

- **StatusTreeProvider** — Extension health dashboard (SDK, LS, MCP, CDP status).
- **ActiveTreeProvider** — Shows running/pending/waiting sub-agents with live updates.
- **HistoryTreeProvider** — Shows completed/failed/cancelled agents.

All auto-refresh on orchestrator events.

### 8. Status Bar (`status-bar.ts`)

A `vscode.StatusBarItem` that shows the running agent count with a spinner animation. Clicks open the active sub-agents panel.

### 9. Notifications (`notifications.ts`)

Listens to orchestrator events and fires VS Code toast notifications for:
- Agent completion (with "View Chat" action)
- Agent failure (with error details)
- Action required (waiting for user approval)

### 10. Types (`types.ts`)

Central type definitions shared by all modules:
- `ISubAgent`, `ISubAgentBatch`, `ILaunchConfig`, `IQuickLaunchConfig`
- `SubAgentStatus` enum with lifecycle states
- `ISubAgentEvent` for event-driven architecture
- `IMessageBuffer`, `IBufferedMessage`, `IPendingAction`
- Model constants (`AVAILABLE_MODELS`, `MODEL_NAMES`, `MODEL_LABELS`)
- Status utilities (`isActiveStatus`, `isTerminalStatus`, `formatElapsed`)
- **Sentinel constants:**
  - `LOST_TRACKING_ERROR` — marker for agents that need recovery on next activation.
  - `IDE_CANCELLED_ERROR` — marker for agents whose pending interaction was auto-cancelled by the IDE on its own restart; suppresses the spurious parent-delivery message.

## Data Flow

### Launch Flow

```
1. Parent agent calls MCP tool "launch_subagents"
2. MCP Bridge (handlers.ts) → Orchestrator.launch()
3. Orchestrator delegates to launcher.ts:
   a. Generate batch ID (UUID)
   b. For each task:
      - StartCascade RPC → Language Server creates conversation
      - SendUserCascadeMessage RPC → sends task prompt
      - UpdateConversationAnnotations → archive the chat
      - Track background conversation
   c. Start polling loop via ensureMonitoring()
4. Return batch ID + agent IDs to parent
```

### Cancel Flow

```
Cancel Mode 1: USER_CANCELLED (from above-chat panel)
  → actions.cancel() → CancelCascadeInvocation RPC
  → Sets error = "Stopped by user"
  → Batch report includes retry warning
  → Parent agent receives: "🛑 Do NOT retry this agent"

Cancel Mode 2: PARENT_STOPPED (from chatbox overlay)
  → CdpInjector → actions.cancelByParent()
  → cancelSilent() → CancelCascadeInvocation RPC
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

### Message Flow (send_message)

```
Sub-agent calls MCP tool "send_message"
    ↓
handlers.ts → detectSenderAgent() → orchestrator.sendMessage()
    ↓
messaging.ts:
  1. Buffer message under batchId
  2. Check if all agents in batch are terminal
     - No → { buffered: true, delivered: false }
     - Yes → Consolidate all messages + trajectories
              → SendUserCascadeMessage to parent
              → { buffered: true, delivered: true }
```

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `subagents.defaultModel` | enum | `flash` | Default model for sub-agents |
| `subagents.cdpPort` | number | `9347` | CDP debugging port |
| `subagents.autoConnectCDP` | boolean | `true` | Auto-connect on startup |
| `subagents.autoInstallMCP` | boolean | `true` | Auto-install MCP config |
| `subagents.uiPollInterval` | number | `300` | Browser-side DOM enforcement interval (ms) |
| `subagents.progressPollInterval` | number | `300` | Orchestrator progress poll interval (ms) |
| `subagents.statusPollInterval` | number | `300` | Extension status panel poll interval (ms) |
| `subagents.heartbeatInterval` | number | `300` | CDP connection heartbeat interval (ms) |
| `subagents.targetRescanInterval` | number | `300` | CDP target scan interval (ms) |
| `subagents.debugLogging` | boolean | `false` | Enable verbose trace logging (browser + output channel) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `antigravity-sdk` | Core SDK for LS Bridge, cascade management |
| `vscode` | VS Code extension API (peer dependency) |
| `ws` | WebSocket client for CDP (resolved from IDE's node_modules) |

The SDK is **bundled** into the extension (`noExternal` in tsup config) so users don't need to install it separately.

## Build System

| Script | Purpose |
|--------|---------|
| `npm run build` | tsup bundle + CDP smoke tests (37 tests) |
| `npm run build:only` | tsup bundle only (no tests) |
| `npm run dev` | Watch mode (rebuilds on changes) |
| `npm run test` | Run all tests |
| `npm run test:cdp` | Run CDP script smoke tests |
| `npm run package` | Build `.vsix` extension package |

The build compiles to a single CommonJS bundle at `dist/extension.js` targeting `es2020`.
