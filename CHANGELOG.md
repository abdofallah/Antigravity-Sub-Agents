# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] — 2026-05-27

### Added

- **Restart Recovery** — On extension activation, every sub-agent that was previously marked `Failed ("Extension restarted — lost tracking")` is now re-checked against the Language Server's live trajectory state. Healthy cascades are restored to the right live status (`Running` / `WaitingForAction` / `Completed` / `Cancelled`) and monitoring resumes automatically — no manual relaunch required.
  - Phase 1: `listCascades` summary fetch confirms the cascade still exists on the LS side.
  - Phase 2: `getConversation` full fetch supplies `waitingSteps` / `requestedInteractions` so `WaitingForAction` can be distinguished from `Completed`.
  - Diagnostic `[RECOVERY-DUMP]` lines emit persisted-state and live-state snapshots side-by-side for every checked agent.
- **`IDE_CANCELLED_ERROR` Sentinel** — Detects when the Antigravity IDE itself auto-cancelled a pending user-interaction during its own restart (verified with the extension fully disabled: same behaviour). Affected sub-agents are now correctly terminated as `Cancelled` rather than `Completed`, and the batch-delivery layer suppresses the spurious "Report sent to parent" message since the sub-agent never ran its post-approval steps. Mirrors the `PARENT_STOPPED` silent-cancel pattern.
- **`LOST_TRACKING_ERROR` Sentinel** — Centralised the "Extension restarted — lost tracking" magic string into a single exported constant so recovery, persistence, and UI layers can never drift out of sync.
- **Strictly-Monotonic Injection Sequence** — Every CDP panel injection now carries an `_injectSeq` payload that the browser-side script uses to reject out-of-order evaluations. Eliminates the class of bug where a fast route switch let a late-completing injection from the previous conversation overwrite the fresh one.
- **Route Generation Guards** — Every route change increments `_routeGeneration`. All inflight timers, debounced injections, and graduated-retry chains stamp the generation at scheduling time and self-discard when it no longer matches — stale results from the previous conversation can no longer pollute the current view.
- **High-Water Mark Anti-Wipe Guard** — The injector now records `_lastInjectedActiveCount` and `_lastInjectedAt` for the current route. A subsequent injection that would shrink the visible active-agent set within a short coalescing window is dropped on the browser side, preventing the flash-empty bug seen when navigating away and back to a conversation with running sub-agents.
- **Pending-Injection Queue** — Route or agent events arriving while a CDP call is inflight no longer drop silently; they queue a single follow-up run that fires with fresh data immediately after the inflight call returns.
- **TreeView Diagnostic Trace Channel** — New "Sub-Agents TreeView" output channel (gated by `subagents.debugLogging`) logs every event subscription, refresh, and `getChildren` call from `ActiveTreeProvider` and `HistoryTreeProvider`, including batch-by-batch agent-state dumps when the filter empties out. Created during the v0.7.0 diagnosis cycle and kept available for future support cases.
- **Activation Provider Logs** — `extension.ts` now logs each tree provider's construction and view registration. Makes it trivial to verify which orchestrator instance the providers received in support reports.
- **`.github/antigravity subagents extension.mp4`** — Demo video embedded at the top of the README so users can see the extension in action before installing.

### Fixed

- **"Lost-tracking" agents wrongly marked Completed on restart** — Earlier revisions queried `GetAllCascadeTrajectories` which never returns `waitingSteps`, so any agent that had been `WaitingForAction` was demoted to `Completed`. Recovery now uses `GetConversation` as the authoritative source.
- **Non-conversation routes (`/`, `/history`) entered a futile retry loop** — These pages have no sidebar or chatbox to inject into. The injector now exits cleanly when no `cascadeId` is present in the router and just resets the per-route state without scheduling retries.
- **Active-agent panel flashed empty after switching conversations and back** — The root cause was a stale `Shell created = true` triggering a redundant re-injection that ran the chatbox / sidebar code path with an empty agent set. Fixed via the high-water mark, route generation guard, and injection-sequence number working together.
- **Per-route state leaked between conversations** — `_shellRetryCount`, `_eventDebounceTimer`, `_refreshTimers`, `_lastInjectedActiveCount`, and `_lastInjectedAt` are now all reset on every route change.
- **CHANGELOG.md** — Corrected outdated CDP smoke-test counts to keep the number in lockstep with `src/tests/cdp-scripts.test.ts`.

### Changed

- **`recoverLostAgents` priority order** is now explicit and documented in code: Priority 0 = IDE auto-cancelled pending action, Priority 1 = `waitingSteps` present → `WaitingForAction`, Priority 2 = IDE + step progress → silent `Completed`, Default = revive as `Running` and let the standing monitor disambiguate.
- **Tree-provider event listeners** were rewritten to log subscription, refresh, and `getChildren` call counts behind `subagents.debugLogging`. Behaviour is unchanged when the flag is off.
- **Orchestrator delivery layer** (`checkBatchDelivery`) now short-circuits when every agent in a batch is IDE-cancelled (alongside the existing PARENT_STOPPED short-circuit).

## [0.6.0] — 2026-05-26

### Added

- **Self-Retrying DOM Injection Sections** — Each injection concern (chatbox, sidebar, lock watcher) now reports its own status independently. If any section fails (e.g. sidebar not rendered yet), only that section is retried — completed sections skip via data-attribute state guards, eliminating flicker.
  - Browser-side `sections` status object: `{ chatbox: 'done', watcher: 'updated', sidebar: 'no-scroll-area' }`.
  - Possible states per section: `pending`, `done`, `skip`, `cleared`, `missing-inputbox`, `no-scroll-area`, `no-convo`, `installed`, `updated`, `created`, `reused`.
  - Server-side retry scheduler checks `sections.sidebar` and `sections.chatbox` to determine retry need.
- **`subagents.debugLogging` Setting** — Boolean toggle (default: `false`) that gates all verbose trace logging. When enabled, outputs detailed `[SA:panel]` and `[SA:watcher]` logs in browser DevTools and `↳` trace dumps in the VS Code output channel. When disabled, only critical logs (connections, state changes, errors) are shown.
  - Server-side: new `logDebug()` function gates trace dumps and retry scheduling logs behind the setting.
  - Browser-side: `_saDebug` flag injected into every script execution; `_saLog()` always populates the trace array (for debug results), but suppresses `console.log()` output in production.
- **Configurable Poll Intervals** — All polling intervals are now extension settings with 300ms defaults:
  - `subagents.uiPollInterval` — Browser-side DOM enforcement (badges, locks, breadcrumbs).
  - `subagents.progressPollInterval` — Orchestrator progress polling.
  - `subagents.statusPollInterval` — Extension status panel polling.
  - `subagents.heartbeatInterval` — CDP connection heartbeat.
  - `subagents.targetRescanInterval` — CDP target scanning.
- **State-Guard Data Attributes** — All DOM mutations are now protected by `data-sa-*` attributes that prevent redundant re-processing:
  - `data-sa-drop-hash` on the chatbox dropdown (skips rebuild if agent set unchanged).
  - `data-sa-lock-state` on lock targets (skips lock UI mutations if state unchanged).
  - `data-sa-badge-state` on the document body (skips notification badge updates if unchanged).
  - `data-sa-breadcrumb` on breadcrumb segments (prevents re-rewriting).
- **4 new CDP smoke test assertions** — Validate `sections.chatbox`, `sections.watcher`, `sections.sidebar` tracking and `sections: sections` in return values. Total tests: **37**.

### Fixed

- **Sidebar blank after conversation switch** — The injection script used to return early when the sidebar scroll area wasn't found (`no-scroll-area`), causing the chatbox dropdown to also be skipped. Now the sidebar sets its section status and continues, so the chatbox is always processed.
- **Retry counter never reset** — `_shellRetryCount` was a lifetime counter that never reset on route changes or agent events. After enough conversation switches, the extension permanently stopped retrying. Now resets to 0 on every route change and agent event.
- **2-second retry interval too slow** — Previous retry used 2000ms delays. Now uses 300ms, aligned with the configurable `uiPollInterval`.
- **Retry limit exhaustion** — Removed the fixed 20-retry cap. Retries now continue indefinitely until the section succeeds, with log throttling (first 5, then every 10th) to prevent output spam.

### Changed

- **Retry interval** — Changed from 2000ms to 300ms for faster DOM convergence after conversation switches.
- **Log architecture** — Split `log()` into `log()` (always) and `logDebug()` (gated) in `cdp-injector.ts`. Browser-side logs are gated by `_saDebug` flag.
- **Panel script return value** — Now includes `sections` object alongside existing `state`, `count`, `activeCount` fields.

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

[0.7.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.7.0
[0.6.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.6.0
[0.5.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.5.0
[0.4.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.4.0
[0.3.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.3.0
[0.2.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.2.0
[0.1.0]: https://github.com/abdofallah/Antigravity-Sub-Agents/releases/tag/v0.1.0
