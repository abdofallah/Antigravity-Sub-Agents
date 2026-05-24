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

### 3. Build

```bash
npm run build        # One-time build
npm run dev          # Watch mode (rebuilds on changes)
```

### 4. Test in Antigravity IDE

1. Open the `antigravity-subagents` folder in Antigravity IDE.
2. Press `F5` to launch the Extension Development Host.
3. The extension will activate automatically.

## Project Structure

```
antigravity-subagents/
├── src/
│   ├── extension.ts          # Entry point — wires all modules
│   ├── orchestrator.ts       # Core brain — lifecycle, polling, state
│   ├── mcp-bridge.ts         # MCP server exposing tools to agents
│   ├── cdp-injector.ts       # CDP-based sidebar UI injection
│   ├── tree-provider.ts      # VS Code TreeView providers
│   ├── status-bar.ts         # Status bar widget
│   ├── notifications.ts      # Toast notification manager
│   └── types.ts              # Shared types, enums, constants
├── resources/
│   └── subagents.svg         # Activity bar icon
├── docs/
│   ├── ARCHITECTURE.md       # System architecture overview
│   └── CDP.md                # CDP injection deep-dive
├── .github/
│   └── workflows/
│       └── release.yml       # CI/CD pipeline
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript config
├── tsup.config.ts            # Build config
├── CHANGELOG.md              # Release notes
└── README.md                 # Project readme
```

## Code Style

- **TypeScript strict mode** — all code must pass `strict: true`.
- **No `innerHTML`** — use DOM API (`createElement`, `appendChild`) for Trusted Types CSP compliance.
- **Event-driven** — use the Orchestrator's `onEvent()` emitter, not polling, for UI updates.
- **Documentation** — all public methods must have JSDoc comments.
- **Module headers** — each file starts with a `@module` JSDoc block explaining its role.

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
docs: update architecture diagram
chore: bump SDK version
```

### Pull Requests

1. Fork the repository.
2. Create a feature branch from `dev`.
3. Make your changes with clear commit messages.
4. Ensure `npm run build` passes cleanly (no errors or warnings).
5. Submit a PR targeting the `dev` branch.
6. Describe what changed and why in the PR description.

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

## Reporting Issues

- Use [GitHub Issues](https://github.com/abdofallah/Antigravity-Sub-Agents/issues).
- Include logs from the "Sub-Agents CDP" output channel.
- Include your Antigravity IDE version and OS.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
