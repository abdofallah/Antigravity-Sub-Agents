# Chrome DevTools Protocol (CDP) Injection — Deep Dive

This document explains how the Antigravity Sub-Agents extension injects real-time status UI into the Agent Manager sidebar using Chrome DevTools Protocol.

## Table of Contents

- [Why CDP?](#why-cdp)
- [How Antigravity IDE Works](#how-antigravity-ide-works)
- [Module Structure](#module-structure)
- [CDP Connection Flow](#cdp-connection-flow)
- [Target Management](#target-management)
- [DOM Injection Strategy](#dom-injection-strategy)
- [Script Builder Architecture](#script-builder-architecture)
- [Trusted Types CSP Compliance](#trusted-types-csp-compliance)
- [Router Subscription](#router-subscription)
- [Self-Retrying Injection Sections](#self-retrying-injection-sections)
- [Debug Logging](#debug-logging)
- [Persistent UI Enforcement](#persistent-ui-enforcement)
- [Chat Locking](#chat-locking)
- [Setup Guide](#setup-guide)
- [Troubleshooting](#troubleshooting)

---

## Why CDP?

Antigravity IDE's Agent Manager (the chat sidebar) is a **web-based UI** running inside an Electron BrowserWindow. The extension API doesn't provide hooks to modify this UI. However, since Electron is built on Chromium, we can use the **Chrome DevTools Protocol** to:

1. Connect to the renderer process via WebSocket.
2. Execute JavaScript in the page context.
3. Manipulate the DOM to inject our status panel.
4. Subscribe to events for real-time updates.

This is the same protocol that Chrome DevTools itself uses.

## How Antigravity IDE Works

Antigravity IDE has multiple Electron windows/targets:

| Target | Title | Role |
|--------|-------|------|
| Page | `"Launchpad"` | Initial splash screen |
| Page | `"Manager"` | Agent Manager sidebar (our target) |
| Page | `"9router - Antigravity"` | Main editor workbench |
| Worker | (unnamed) | Service workers |

The **Manager** target is the one that renders the chat interface. It appears after the Launchpad loads, which is why we implement target hot-switching.

## Module Structure

The CDP system is organized under `src/cdp/`:

```
src/cdp/
├── index.ts              Re-exports CdpSidebarInjector
├── cdp-injector.ts       Connection orchestration, event bindings, injection lifecycle
├── target-manager.ts     HTTP target discovery, ws module resolution, best-target selection
└── scripts/
    ├── css.ts            Generates injection CSS (dot indicators, spinners, keyframes)
    ├── build-router-sub.ts    TanStack Router subscription for conversation detection
    ├── build-chatbox-ui.ts    Parent chat dropdown + notification badge
    ├── build-lock-watcher.ts  Sub-agent chat restrictions + archive banner overrides
    └── build-panel-script.ts  Main panel injection IIFE composing all fragments
```

**Design principle:** Each script builder is a pure TypeScript function that returns a raw JavaScript string. The `buildPanelScript()` composer calls `buildChatboxUI()` and `buildLockWatcher()` to assemble the full injection payload. This makes each fragment independently testable.

**Smoke tests** in `src/tests/cdp-scripts.test.ts` validate that all builders produce syntactically valid JavaScript, including edge cases like empty data and special characters.

## CDP Connection Flow

```
1. Extension activates
   │
2. Probe CDP port (default: 9347)
   │  GET http://127.0.0.1:9347/json
   │   └─ (target-manager.ts: getTargets)
   │
3. Receive target list
   │  [ { id, type, title, webSocketDebuggerUrl }, ... ]
   │   └─ (target-manager.ts: findBestTarget)
   │
4. Find best target (prefer "Manager", fallback to "Launchpad")
   │
5. Connect WebSocket to target's debugger URL
   │  ws://127.0.0.1:9347/devtools/page/{targetId}
   │   └─ (target-manager.ts: loadWs resolves ws from IDE's node_modules)
   │
6. Enable Runtime domain
   │  → Runtime.enable
   │
7. Register CDP bindings
   │  → Runtime.addBinding("__saRouterChange")    // Route events
   │  → Runtime.addBinding("__saCancelAction")    // Cancel buttons
   │  → Runtime.addBinding("__saActionHandler")   // Approve/reject actions
   │
8. Inject CSS + JavaScript
   │  → Runtime.evaluate(cssScript)               ← scripts/css.ts
   │  → Runtime.evaluate(panelScript)             ← scripts/build-panel-script.ts
   │
9. Start refresh loop + heartbeat + target rescan
```

### Port Discovery

The CDP port is configured via:

```bash
# Launch flag (recommended)
Antigravity.exe --remote-debugging-port=9347

# Environment variable (persistent)
ELECTRON_EXTRA_LAUNCH_ARGS=--remote-debugging-port=9347
```

The extension probes this port on activation and retries every 10 seconds.

### WebSocket Module Resolution

The `ws` npm package is not bundled with the extension. Instead, `target-manager.ts` resolves it from the IDE's own `node_modules`:

```
C:\Users\{user}\AppData\Local\Programs\Antigravity IDE\
  resources\app\node_modules\ws
```

This avoids bundling issues and uses the exact same WebSocket implementation as the IDE itself.

## Target Management

### Hot-Switching (`cdp-injector.ts`)

The Launchpad target loads first, and the Manager target appears later. The extension handles this:

```
1. Initial connection → "Launchpad" (best available)
2. Start target rescan timer (5s interval)
3. Rescan detects "Manager" target appears
4. Gracefully close Launchpad WebSocket
5. Connect to Manager target
6. Re-inject CSS + JavaScript
```

The `_switching` flag prevents the close handler from triggering a reconnection loop.

### Heartbeat

At a configurable interval (`subagents.heartbeatInterval`, default 300ms), the extension sends a no-op CDP call to verify the connection is alive. If the heartbeat fails, it triggers reconnection.

## DOM Injection Strategy

### Target Location

The status panel is injected into the **right panel** of the Agent Manager UI. The injection point is identified by this DOM hierarchy:

```html
<div id="antigravity.agentSidePanelInputBox">
  <!-- Existing chat input area -->
</div>

<!-- We inject ABOVE this, targeting the section above the input box -->
```

Specifically, we find the **scrollable messages container** (identified by `overflow-y-auto` class) and append our panel there.

### Two-Phase Injection

**Phase 1: Create Shell** (`build-panel-script.ts`)

On first injection, create the persistent container:

```html
<div id="sa-section" style="...">
  <div id="sa-header">
    <span class="sa-spinner"></span>
    <span>N sub-agents running</span>
    <button id="sa-stop-all-btn">Stop All</button>
  </div>
  <div id="sa-items">
    <!-- Agent cards go here -->
  </div>
</div>
```

**Phase 2: Update Content**

On subsequent updates, only the children of `#sa-items` are cleared and repopulated. This minimizes DOM thrashing.

### Agent Cards

Each sub-agent gets a card element:

```html
<div class="sa-agent-card" style="...">
  <div class="sa-dot sa-dot-running"></div>   <!-- Status indicator -->
  <div>
    <div>Agent Label</div>                     <!-- Name -->
    <div>🧠 Pro-H · 12 steps · 2m 30s</div>  <!-- Stats -->
  </div>
  <div>
    <button>Stop</button>                      <!-- Cancel button -->
    <button>👁</button>                        <!-- View chat -->
  </div>
</div>
```

## Script Builder Architecture

The injection JavaScript is built by composable TypeScript functions:

```
buildPanelScript(data)           ← Main entry point (build-panel-script.ts)
  │
  ├── Embeds agent data as JSON
  ├── Creates shell HTML structure
  ├── Renders agent cards with action buttons
  │
  ├── buildChatboxUI()           ← Dropdown + notification badge (build-chatbox-ui.ts)
  │     └── Shows running count on parent chat input
  │
  └── buildLockWatcher()         ← Chat restrictions (build-lock-watcher.ts)
        ├── Input overlay on sub-agent chats
        ├── Archive banner override
        └── MutationObserver + setInterval enforcement
```

Each builder returns a string of raw JavaScript. The main builder wraps everything in an IIFE that:
1. Checks if an update is needed (data hash comparison)
2. Creates or updates the shell DOM
3. Sets up watchers for UI persistence

## Trusted Types CSP Compliance

Antigravity IDE enforces **Trusted Types** Content Security Policy, which blocks `innerHTML`, `outerHTML`, and similar APIs. All DOM manipulation uses safe APIs:

```typescript
// ❌ BLOCKED by CSP
element.innerHTML = '<div>...</div>';

// ✅ ALLOWED — pure DOM API
const div = document.createElement('div');
div.textContent = 'Safe text';
div.style.cssText = 'color: red;';
parent.appendChild(div);
```

CSS injection uses a `<style>` element created via `document.createElement('style')` with a `TextNode` child, avoiding any CSP violations.

## Router Subscription

To detect which conversation the user is viewing, `build-router-sub.ts` subscribes to the **TanStack Router** that powers the Manager UI:

```javascript
// Subscribe to route changes
var router = window.__TSR_ROUTER__;
if (router && router.subscribe) {
    router.subscribe('onResolved', function(ev) {
        var matches = ev.toLocation?.matches || [];
        for (var i = 0; i < matches.length; i++) {
            if (matches[i].params?.cascadeId) {
                window.__saRouterChange(JSON.stringify({
                    convoId: matches[i].params.cascadeId
                }));
                break;
            }
        }
    });
}
```

The `__saRouterChange` CDP binding forwards route events to the extension's TypeScript code (`cdp-injector.ts: _onRouterChange`), which resets the retry counter and triggers panel refreshes.

## Self-Retrying Injection Sections

When the user switches conversations, React may not have rendered all DOM targets yet. The injection system handles this through **independent, per-section status tracking**.

### Section Status Reporting

The browser-side script tracks three independent sections:

```javascript
var sections = { chatbox: 'pending', watcher: 'pending', sidebar: 'pending' };
```

Each section reports its own outcome:

| Section | Possible States | Retryable? |
|---------|----------------|------------|
| `chatbox` | `done`, `skip`, `cleared`, `missing-inputbox`, `no-convo` | `missing-inputbox` |
| `watcher` | `installed`, `updated` | Never |
| `sidebar` | `done`, `created`, `reused`, `no-scroll-area` | `no-scroll-area` |

### Server-Side Retry Logic

The `cdp-injector.ts` result handler checks the sections:

```
1. Parse result → extract sections object
2. needsRetry = sidebar === 'no-scroll-area' || chatbox === 'missing-inputbox'
3. If needsRetry → schedule retry at 300ms (uiPollInterval)
4. On retry → re-execute full script (idempotent via data-sa-* guards)
5. Completed sections skip instantly → no flicker
```

**Key guarantees:**
- Retry counter resets to 0 on every route change and agent event.
- No retry limit — retries continue indefinitely until all sections succeed.
- Log throttling: first 5 retries logged individually, then every 10th.

### State-Guard Data Attributes

All DOM mutations are protected by `data-sa-*` attributes to prevent redundant re-processing:

| Attribute | Element | Purpose |
|-----------|---------|--------|
| `data-sa-drop-hash` | Chatbox dropdown | Skip rebuild if agent set unchanged |
| `data-sa-lock-state` | Lock target | Skip lock UI mutations if state unchanged |
| `data-sa-badge-state` | `document.body` | Skip notification badge updates if unchanged |
| `data-sa-breadcrumb` | Breadcrumb segment | Prevent breadcrumb re-rewriting |

## Debug Logging

All verbose logging is gated behind the `subagents.debugLogging` setting (default: `false`).

### Server-Side (VS Code Output Channel)

| Function | When |
|----------|------|
| `log()` | Always — connections, state changes, errors, route changes |
| `logDebug()` | Only when `debugLogging: true` — trace dumps (`↳`), retry scheduling |

### Browser-Side (Chromium DevTools Console)

A `_saDebug` flag is injected into every script execution:

```javascript
var _saDebug = false; // or true when debugLogging enabled
function _saLog(msg) {
    _saTrace.push(msg);  // Always collect for debug results
    if (_saDebug) console.log('[SA:panel] ' + msg);  // Only output when enabled
}
```

All `[SA:watcher]` console.log calls are similarly gated with `if (_saDebug)`.

### Enabling Debug Mode

```json
// settings.json
{ "subagents.debugLogging": true }
```

Or via Settings UI → Extensions → Sub-Agents → Debug Logging.

## Persistent UI Enforcement

React's Virtual DOM constantly re-renders the Manager UI, which can destroy our injected elements. The `build-lock-watcher.ts` module implements a multi-layer persistence strategy:

### Layer 1: MutationObserver

```javascript
var obs = new MutationObserver(enforceLocks);
obs.observe(document.body, { childList: true, subtree: true });
```

Any DOM change triggers our enforcement function.

### Layer 2: setInterval Fallback

```javascript
setInterval(enforceLocks, ${pollInterval}); // default 300ms, configurable via subagents.uiPollInterval
```

Catches cases where MutationObserver misses a change.

### Layer 3: Event-Driven Refresh

The Orchestrator fires events on state changes, which trigger `injectSubAgentPanel()` in `cdp-injector.ts`. This provides instant updates when agents complete.

## Chat Locking

### Sub-Agent Chats (View Only)

When viewing a sub-agent's chat (`build-lock-watcher.ts`):

1. **Input overlay** — absolute-positioned div over the chat input box with lock icon.
2. **Revert button removal** — `[data-testid="revert-button"]` elements set to `display:none`.
3. **Archive banner override** — "This chat is archived" banner's children hidden, replaced with "🔒 Sub-agent chat — view only" overlay.

### Parent Chats (During Execution)

When viewing the parent's chat while sub-agents run (`build-chatbox-ui.ts`):

1. **Input overlay** — shows spinner, running count, and "Stop All & Don't Report" button.
2. The stop button triggers `__saCancelAction` with `type: 'silent'`.

### Why Overlay Instead of Replace?

React re-renders destroy text node changes instantly. Our strategy:

```javascript
// ❌ React immediately reverts this
span.textContent = 'New text';

// ✅ Hide original, overlay our own
originalElement.style.display = 'none';
var overlay = document.createElement('div');
overlay.style.cssText = 'position:absolute;inset:0;...';
parent.appendChild(overlay);
```

## Setup Guide

### Method 1: Launch Script (Recommended)

Create a `.bat` file on your desktop:

```batch
@echo off
start "" "C:\...\Antigravity.exe" --remote-debugging-port=9347
```

### Method 2: Environment Variable (Persistent)

```powershell
[System.Environment]::SetEnvironmentVariable(
    "ELECTRON_EXTRA_LAUNCH_ARGS",
    "--remote-debugging-port=9347",
    "User"
)
```

After setting, restart Antigravity IDE.

### Method 3: Extension Command

Run `Sub-Agents: Setup CDP (Sidebar Injection)` from the command palette.

### Verify

After launching with CDP enabled:

```bash
curl http://127.0.0.1:9347/json/version
```

Expected response:

```json
{
    "Browser": "Chrome/...",
    "Protocol-Version": "1.3",
    ...
}
```

## Troubleshooting

### "CDP not available"

- Antigravity was not launched with `--remote-debugging-port=9347`.
- Another process is using port 9347.
- Check with: `netstat -an | findstr 9347`

### "SCRIPT ERROR: SyntaxError"

- Usually a brace mismatch in the injected JavaScript.
- Run `npm run test:cdp` to validate all script builders produce valid JS.
- Check the "Sub-Agents CDP" output channel for details.
- Run `Sub-Agents: Open Manager DevTools` to debug in the browser console.

### Panel Not Appearing

- The Manager target may not have loaded yet (wait a few seconds).
- Check if the extension found the right target in the output log.
- Try `Sub-Agents: Refresh` to force a re-injection.

### UI Flickering

- React re-renders are fighting with our DOM changes.
- The MutationObserver in `build-lock-watcher.ts` should handle this, but extreme cases may need the `setInterval` fallback frequency adjusted.

### Connection Drops

- The heartbeat timer detects disconnections.
- Auto-reconnection triggers automatically.
- Check the output channel for reconnection logs.

### Enabling Verbose Logs

- Set `subagents.debugLogging` to `true` in Settings.
- Browser-side `[SA:panel]` and `[SA:watcher]` logs appear in the Manager DevTools console.
- Server-side `↳` trace dumps and retry logs appear in the "Sub-Agents CDP" output channel.
