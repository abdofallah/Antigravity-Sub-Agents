# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-24

### Added

- **Extension Status Panel** — New "Extension Status" tree view at top of the Sub-Agents sidebar showing live health of SDK, LS Bridge, MCP Bridge, MCP Server, CDP, and default model.
- **Live MCP Server Health** — Queries `GetMcpServerStates` LS RPC every 3 seconds to show actual server status (not just config file presence). Correctly handles protobuf zero-value omission and `MCP_SERVER_STATUS_READY` enum.
- **Auto-Fix MCP Config** — Automatically detects and repairs broken MCP configs (e.g. stale paths after moving the project directory). Rewrites `mcp_config.json` with correct paths and calls `RefreshMcpServers` RPC — no manual intervention required. Debounced at 30s intervals.
- **Fix MCP Server Command** — `Sub-Agents: Fix MCP Server (Reinstall & Refresh)` command for manual repair. Also accessible by clicking the MCP Server status item when in error state.
- **Output Channel** — "Sub-Agents" output channel for diagnostics. Logs status transitions, auto-fix operations, and RPC errors. Only logs on state *changes*, not every poll.

### Fixed

- **Wrong MCP config path** — Was writing to `%APPDATA%\Antigravity\User\mcp_config.json` but the LS reads from `%USERPROFILE%\.gemini\antigravity\mcp_config.json`. Now discovers and writes to the correct file.
- **Missing `$typeName` field** — Antigravity's protobuf-based MCP config requires `"$typeName": "exa.cascade_plugins_pb.CascadePluginCommandTemplate"`. Now included in all written entries.
- **MCP status stuck on "Checking..."** — The `MCP_SERVER_STATUS_READY` enum was unrecognized, falling through to "unknown". Now correctly mapped to healthy/green.
- **`RefreshMcpServers` error spam** — `"loading already in progress"` error during startup is now handled gracefully (expected during LS init).

### Removed

- **"Set Environment Variable" CDP setup option** — Removed non-functional `ELECTRON_EXTRA_LAUNCH_ARGS` approach. Only the reliable "Create Launch Script" batch file method is kept.

### Changed

- **Simplified MCP status display** — Only 2 user-visible states: ✅ Installed (green) or ❌ Error (red). No intermediate "Checking..." / "Loading..." states that cause confusion.
- **DRY MCP config helpers** — Extracted `getMcpConfigPaths()`, `findMcpConfig()`, `writeMcpSubagentsConfig()`, and `buildSubagentsEntry()` shared helpers.

## [0.1.0] — 2026-05-24

### Added

- **Core Orchestrator** — Full sub-agent lifecycle management (create → run → complete/fail/cancel) with persistent state across IDE restarts.
- **MCP Bridge** — Model Context Protocol server that exposes `launch_subagents`, `check_subagents`, `cancel_subagent`, `get_subagent`, and `get_batch` tools to parent agents.
- **CDP Sidebar Injector** — Real-time sub-agent status panel injected into the Antigravity Agent Manager sidebar via Chrome DevTools Protocol.
- **TreeView Sidebar** — Native VS Code tree view with Active Sub-Agents and History panels.
- **Status Bar Widget** — Live running count in the VS Code status bar.
- **Notification System** — Toast notifications for completions, failures, and actions required.
- **Batch Launching** — Launch multiple sub-agents in parallel with per-agent model selection.
- **Model Support** — Gemini Flash, Gemini Pro (Low/High), Claude Sonnet, Claude Opus, GPT OSS.
- **Chat Locking** — Sub-agent chats are locked (view-only) with input overlay and revert button removal.
- **Archive on Create** — Sub-agent conversations are auto-archived to hide from sidebar/history.
- **Archive Banner Override** — Archived sub-agent chats show "🔒 Sub-agent chat — view only" instead of "Restore" banner.
- **Cancel Propagation** — Two cancel modes:
  - `USER_CANCELLED` — Reports to parent agent with retry warning.
  - `PARENT_STOPPED` — Silent cancel when parent terminates (no report).
- **Parent Chat Overlay** — Shows spinner + "Stop All & Don't Report" on parent chat during sub-agent execution.
- **Extension Settings** — Configurable default model, CDP port, auto-connect CDP, auto-install MCP.
- **MCP Auto-Install** — Automatically writes `mcp_config.json` on first activation.
- **CDP Status Check** — Reports CDP connection status on startup with setup guide.
- **Health Check Command** — Full diagnostic showing SDK, LS Bridge, MCP, CDP, and config status.
- **CI/CD Pipeline** — GitHub Actions for building and publishing `.vsix` extension packages.

### Architecture

- Event-driven design using Orchestrator → EventEmitter pattern.
- Trusted Types CSP-compliant DOM manipulation (no `innerHTML`).
- TanStack Router subscription for real-time conversation detection.
- MutationObserver + setInterval watchers for persistent UI enforcement.
- Background poll loop with trajectory summary diffing for progress tracking.

[0.2.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.2.0
[0.1.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.1.0
