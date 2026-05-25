# Contributing to Antigravity Sub-Agents

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) v16+
- [Antigravity IDE](https://antigravity.dev/) v1.107+
- The [Antigravity SDK](https://github.com/Kanezal/antigravity-sdk) (bundled automatically)

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/abdofallah/Antigravity-Sub-Agents.git
cd Antigravity-Sub-Agents
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build & Test

```bash
npm run build        # Build + run tests (24 CDP smoke tests)
npm run build:only   # Build only (skip tests)
npm run dev          # Watch mode (rebuilds on changes)
npm run test         # Run all tests
npm run test:cdp     # Run CDP script smoke tests only
```

### 4. Test in Antigravity IDE

1. Open the `antigravity-subagents` folder in Antigravity IDE.
2. Press `F5` to launch the Extension Development Host.
3. The extension will activate automatically.

## Project Structure

```
antigravity-subagents/
├── src/
│   ├── extension.ts              # Entry point — wires all modules (~200 LOC)
│   ├── types.ts                  # Shared types, enums, constants
│   ├── tree-provider.ts          # VS Code TreeView providers
│   ├── status-bar.ts             # Status bar widget
│   ├── notifications.ts          # Toast notification manager
│   │
│   ├── config/                   # Configuration & setup
│   │   ├── settings.ts           # Settings reads, model maps
│   │   ├── mcp-config.ts         # MCP config find/write/auto-fix/health
│   │   └── instructions.ts       # Prompt injection file writer
│   │
│   ├── commands/                 # VS Code command handlers
│   │   ├── index.ts              # Command registration hub
│   │   ├── launch-flow.ts        # Multi-agent QuickPick wizard
│   │   ├── quick-launch.ts       # Single-agent quick launch
│   │   └── health-check.ts       # CDP setup guide, diagnostics
│   │
│   ├── cdp/                      # Chrome DevTools Protocol injection
│   │   ├── index.ts              # Re-exports CdpSidebarInjector
│   │   ├── cdp-injector.ts       # Connection + injection orchestration
│   │   ├── target-manager.ts     # Target discovery, ws module resolution
│   │   └── scripts/              # Modular injection script builders
│   │       ├── css.ts            # Injection CSS
│   │       ├── build-router-sub.ts    # Router subscription
│   │       ├── build-chatbox-ui.ts    # Parent chat dropdown
│   │       ├── build-lock-watcher.ts  # Chat locking enforcement
│   │       └── build-panel-script.ts  # Main panel IIFE
│   │
│   ├── mcp/                      # MCP Bridge server
│   │   ├── index.ts              # Re-exports McpBridge
│   │   ├── bridge.ts             # HTTP server lifecycle + routing
│   │   ├── handlers.ts           # Endpoint handlers
│   │   └── server-script.ts      # MCP stdio server generator
│   │
│   ├── orchestrator/             # Core brain
│   │   ├── index.ts              # Re-exports Orchestrator class
│   │   ├── orchestrator.ts       # Slim coordinator (~340 LOC)
│   │   ├── launcher.ts           # Cascade creation + workspace discovery
│   │   ├── monitor.ts            # Polling loop + stale detection
│   │   ├── messaging.ts          # Message buffering + batch delivery
│   │   └── actions.ts            # Cancel, approve, respond, reject
│   │
│   └── tests/                    # Smoke tests
│       └── cdp-scripts.test.ts   # 24 CDP script validation tests
│
├── resources/
│   └── subagents.svg             # Activity bar icon
├── docs/
│   ├── ARCHITECTURE.md           # System architecture overview
│   └── CDP.md                    # CDP injection deep-dive
├── .github/
│   └── workflows/
│       └── release.yml           # CI/CD pipeline
├── package.json                  # Extension manifest + scripts
├── tsconfig.json                 # TypeScript config (strict mode)
├── tsup.config.ts                # Build config (CommonJS, es2020)
├── CHANGELOG.md                  # Release notes
└── README.md                     # Project readme
```

## Code Style

- **TypeScript strict mode** — all code must pass `tsc --noEmit` with zero errors.
- **No `innerHTML`** — use DOM API (`createElement`, `appendChild`) for Trusted Types CSP compliance.
- **Event-driven** — use the Orchestrator's `onEvent()` emitter, not polling, for UI updates.
- **Documentation** — all public methods must have JSDoc comments.
- **Module headers** — each file starts with a `@module` JSDoc block explaining its role.
- **Context interfaces** — sub-modules receive state via typed context objects, never import the parent class.
- **Tests must pass** — `npm run build` runs tests automatically; PRs with failing tests won't be accepted.

## Architecture Principles

### Separation of Concerns

Each directory owns one domain:

| Directory | Domain |
|-----------|--------|
| `config/` | Reading settings, writing MCP config, LS health |
| `commands/` | VS Code command palette interactions |
| `cdp/` | Chrome DevTools Protocol injection |
| `mcp/` | HTTP bridge for parent-agent communication |
| `orchestrator/` | Agent lifecycle, state, polling, messaging |

### Context Interface Pattern

Sub-modules under `orchestrator/` do NOT import the `Orchestrator` class directly. Instead, the main class passes a typed context object:

```typescript
// In launcher.ts
export interface LaunchContext {
    sdk: AntigravitySDK;
    agents: Map<string, ISubAgent>;
    fire: (agent: ISubAgent, type: ISubAgentEvent['type']) => void;
    persistState: () => void;
    // ...
}

export async function launchBatch(ctx: LaunchContext, config: ILaunchConfig) { ... }
```

This avoids circular imports and makes modules independently testable.

### Script Builder Pattern

CDP injection scripts are built by composable TypeScript functions that return raw JavaScript strings. The main `buildPanelScript()` composes fragments from other builders. Tests validate that the output is syntactically valid JavaScript.

## Making Changes

### Branching

- `main` — stable release branch
- `dev` — development branch (PR target)
- Feature branches: `feature/your-feature-name`
- Bug fixes: `fix/your-fix-name`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add per-agent model selection
fix: resolve brace mismatch in CDP injector script
refactor: extract orchestrator monitor to separate module
docs: update architecture diagram
chore: bump SDK version
test: add smoke tests for lock watcher script
```

### Pull Requests

1. Fork the repository.
2. Create a feature branch from `dev`.
3. Make your changes with clear commit messages.
4. Ensure `npm run build` passes cleanly (build + tests, no errors).
5. Ensure `npx tsc --noEmit` has zero type errors.
6. Submit a PR targeting the `dev` branch.
7. Describe what changed and why in the PR description.

## Architecture Notes

Before making changes, read:

- [Architecture Overview](docs/ARCHITECTURE.md) — system design and module interactions.
- [CDP Injection Deep-Dive](docs/CDP.md) — how the sidebar injection works.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Bundle SDK with `noExternal` | Avoids requiring users to install the SDK separately |
| MutationObserver + setInterval | React VDOM re-renders destroy direct DOM modifications |
| Two cancel modes | User cancels report results; parent stops are silent |
| Archive on create | Hides sub-agent chats from sidebar clutter |
| Event-driven + fallback poll | Instant UI updates with 3s safety net |
| Context interfaces | Avoids circular imports between orchestrator and helpers |
| Modular script builders | Each CDP script is testable and composable independently |
| Tests in build pipeline | Catches script syntax errors before packaging |

## Reporting Issues

- Use [GitHub Issues](https://github.com/abdofallah/Antigravity-Sub-Agents/issues).
- Include logs from the "Sub-Agents CDP" output channel.
- Include your Antigravity IDE version and OS.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
