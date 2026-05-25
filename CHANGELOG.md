# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] — 2026-05-26

### Added

- **Dev-Only Simulation Panel** — Spawn fake sub-agents and manually control their lifecycle states from a rich WebviewPanel (command: `Sub-Agents: Open Simulator (Dev)`). Exercises all UI surfaces in real-time without launching real cascades.
  - Spawn with custom label, task, model, parent ID, and optional real cascade Chat ID (for testing sub-agent view screen).
  - Transition agents between all states: Pending → Running → Waiting for Action → Completed / Failed / Cancelled.
  - Quick presets: "3 Running", "Mixed (5 agents)", "All States", etc.
  - Batch spawn mode for testing multi-agent batches.
  - Simulated pending actions with configurable action type and target.
  - Auto-cleanup on panel close — agents never persisted; vanish on IDE restart.
  - Built-in "Restart Extension Host" and "Reload Window" convenience buttons.
- **`subagents.devMode` Setting** — Boolean gate for simulation tools (default: false). Simulation panel only registers when enabled.
- **`build:release` Script** — Production build with `__DEV__=false` that dead-code eliminates all simulation code via esbuild.
- **`cross-env` Dev Dependency** — For cross-platform environment variable support in release builds.

### Redesigned

- **Chatbox Dropdown (CDP)** — Complete visual overhaul matching the native Antigravity design language:
  - Injected **inside** `#antigravity.agentSidePanelInputBox` as a connected top section (no longer floating above).
  - Collapsible header with chevron animation and summary text ("N subagents running" / "N subagents blocked").
  - Batch grouping with per-batch collapse toggle (chevron + "Batch (N agents: …)" label).
  - Animated spinner SVG for running agents; bell icon for waiting agents.
  - Inline **Approve** / **Deny** action buttons on waiting agent cards inside the dropdown.
  - Notification badges on parent chat sidebar items with running/waiting counts.
- **Sidebar Agent Panel (CDP)** — Redesigned agent rows in the right-side panel:
  - Per-agent cards with status-specific icons (spinner, checkmark, error, notification dot).
  - Subtitle row showing step count, elapsed time, or pending action description.
  - Inline **Approve** / **Deny** buttons for agents in `waiting_for_action` state.
  - Stop overlay on hover for active agents (gradient fade with stop-circle icon).
  - "No subagents." empty state message when section is expanded with zero agents.
  - Auto-reset "See All" expansion when agent count changes (prevents stale expanded state showing all rows).
- **Lock Watcher (CDP)** — Rewritten to properly handle all 4 sub-agent chat states:
  - Archived + pending action → Action bar with Run / No / Reject buttons.
  - Archived + no action → "Restore" button hidden, "🔒 Sub-agent chat — view only" label shown.
  - Unarchived + pending action → Input box replaced with action bar.
  - Unarchived + no action → Input box replaced with view-only lock banner.
  - Proper cleanup when navigating away from a sub-agent chat (restores original children).

### Fixed

- **Batch collapse toggle not working** — Click handler toggled state and rotated chevron but never hid/showed agent rows (DOM only updated on re-render). Fixed by wrapping rows in a container and toggling `display` directly in the click handler.
- **`display:none` overwritten by `cssText`** — Row hiding was immediately overwritten by the next `cssText` assignment. Fixed by combining into a single `cssText` string with conditional display property.
- **Stale "See All" after agent count change** — `expanded` state persisted across data updates, showing all agents when new ones arrived. Added `lastAgentCount` tracking to auto-reset.

### Changed

- **Orchestrator persistence** — Now uses a `_simulatedIds` Set to track ephemeral agents instead of prefix-matching. Simulated agents (any ID format) are excluded from `globalState` persistence.
- **`tsup.config.ts`** — Added `define: { '__DEV__': ... }` for build-time flag substitution.
- **`package.json`** — Added `openSimulator` command, `devMode` setting, and view menu entry (gated by `config.subagents.devMode`).

## [0.4.0] — 2026-05-25

### Refactored

- **Full Separation of Concerns** — Dismantled 3 monolithic files (3,543 lines total) into 26 focused modules across 5 concern-aligned directories:
  - `src/config/` — Settings reads, MCP config management, instructions file writer.
  - `src/commands/` — VS Code command registration and UI flows (launch wizard, quick launch, health check).
  - `src/cdp/` — CDP connection orchestration, target discovery, and 5 modular script builders under `scripts/`.
  - `src/mcp/` — HTTP bridge lifecycle, endpoint handlers, MCP stdio server script generator.
  - `src/orchestrator/` — Slim coordinator class delegating to launcher, monitor, messaging, and actions sub-modules.
- **Extension entry point slimmed** — `extension.ts` reduced from 945 to ~200 lines (pure wire-up).
- **Orchestrator modularized** — Core class reduced from 1,256 to ~340 lines via context interface pattern that avoids circular imports.
- **CDP scripts extracted** — 800+ lines of inline JavaScript strings moved to composable builder functions (`css.ts`, `build-router-sub.ts`, `build-chatbox-ui.ts`, `build-lock-watcher.ts`, `build-panel-script.ts`).
- **MCP bridge split** — Monolithic `mcp-bridge.ts` separated into `bridge.ts` (server lifecycle), `handlers.ts` (endpoint logic), and `server-script.ts` (script generation).

### Added

- **CDP Script Smoke Tests** — 24 tests validating all script builders produce syntactically valid JavaScript, including edge cases (empty data, special characters). Run automatically on every `npm run build`.
- **Test pipeline in build** — `npm run build` now runs `tsup && npm run test:cdp`. Separate `build:only`, `test`, and `test:cdp` scripts added.
- **`send_message` MCP tool** — Added to MCP tools table in README.

### Fixed

- **Latent type error in `rejectAction`** — The original monolithic orchestrator fired `'cancelled'` as an event type, which doesn't exist in the `ISubAgentEvent['type']` union (`'created' | 'progress' | 'status_change' | 'completed' | 'action_required'`). `tsup` (esbuild) silently ignored it; strict `tsc --noEmit` caught it during audit. Fixed to `'status_change'`.

### Changed

- **Documentation fully updated** — `ARCHITECTURE.md`, `CDP.md`, `CONTRIBUTING.md`, `README.md`, and `CHANGELOG.md` rewritten to reflect the new modular layout, context interface pattern, test pipeline, and build scripts.

## [0.3.0] — 2026-05-25

### Added

- **Remote Action Approval** — Approve, deny, or respond to sub-agent permission requests directly from the parent chat without unarchiving child conversations.
- **Dropdown Action Cards** — Waiting sub-agents in the above-chatbox dropdown render as AG 2.0-style cards with 🔔 bell icon, agent label, command/target description, and **Approve** / **Deny** buttons.
- **Archive Banner Action Buttons** — When viewing a sub-agent chat with a pending action, the archived banner is replaced with **Run** / **No** / **Reject** controls:
  - **Run** — Approves the proposed command (`HandleCascadeUserInteraction` with `allow: true`).
  - **No** — Denies the permission and prompts for a custom text message sent back to the agent so it can adapt.
  - **Reject** — Denies the permission AND cancels the cascade entirely (`CancelCascadeInvocation`).
- **`IPendingAction` Interface** — New type in `types.ts` tracking `trajectoryId`, `stepIndex`, `actionType`, and `target` for each waiting step.
- **Orchestrator Action Methods** — `approveAction()`, `respondAction()`, `rejectAction()` public methods making the corresponding LS RPC calls.
- **`_extractPendingAction()` Helper** — Parses trajectory summary `waitingSteps` to populate `pendingAction` on each agent during the poll loop.
- **`__saActionHandler` CDP Binding** — New runtime binding for page-to-extension communication of approve/respond/reject actions.
- **MCP Bridge Action Routes** — `POST /approve-action`, `/respond-action`, `/reject-action` HTTP endpoints for programmatic control.

### Fixed

- **`actionBtn is not defined` crash** — The `actionHandler()` and `actionBtn()` helper functions were missing from the injected JS, causing the entire dropdown to crash and sub-agents to disappear from the UI when any agent entered `waiting_for_action` state.
- **`getConversation: 404` loop** — `_extractPendingAction()` was calling `getConversation()` which returns 404 for cascade IDs. Rewrote to extract all data from the trajectory summary directly, eliminating the failing RPC call.
- **Corrupted stale-threshold code** — Restored the `STALE_THRESHOLD` completion logic and `_persistState()` call at the end of `_pollProgress` that were accidentally removed during editing.

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

[0.5.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.5.0
[0.4.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.4.0
[0.3.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.3.0
[0.2.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.2.0
[0.1.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.1.0
