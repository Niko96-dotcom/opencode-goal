# opencode-goal workspace

Portable **Codex-style goal loop** for OpenCode, Pi, Command Code, and Cursor-compatible workflows: shared TypeScript core, CLI, and OpenCode plugin.

## Packages

| Package | Purpose |
|---------|---------|
| `@nikomohr/goal-core` | External workspace state, `checkpoint()`, verify gate, `GOAL_STATUS` parser, continuation prompt |
| `@nikomohr/goal-cli` | `goal` CLI |
| `@nikomohr/opencode-goal` | OpenCode plugin (`/goal`, idle continuation, system inject) |

## Quick start

```bash
git clone https://github.com/Niko96-dotcom/opencode-goal.git
cd opencode-goal
npm install
npm test
npm run build
```

### CLI (npm)

```bash
npm install -g @nikomohr/goal-cli
goal "implement feature X" --verify "npm test"
goal status
```

From the repo without a global install:

```bash
npx @nikomohr/goal-cli "implement feature X" --verify "npm test"
npx goal status
npx goal prompt
# After an assistant turn (pipe or --file):
npx goal checkpoint --tool-calls 2 --file ./last-assistant.md
```

### OpenCode plugin

Copy or symlink `opencode.json` into your project, adjusting the `file://` path to this repo’s `packages/opencode-goal`.

```json
{
  "plugin": ["file:///absolute/path/to/opencode goal/packages/opencode-goal"]
}
```

Then in OpenCode: `/goal fix the failing unit tests --verify "npm test"`.

## Goal vs GSD

These solve different problems and are meant to run **together** in OpenCode:

| | `/goal` (this project) | `/gsd-*` (Get Shit Done) |
|--|------------------------|---------------------------|
| **Scope** | One durable objective until done or blocked | Multi-phase roadmap, plans, verification waves |
| **State** | User state directory by default; workspace `.goal/` is opt-in | `.planning/` manifests, ROADMAP, phase SUMMARYs |
| **Loop** | Checkpoint → verify shell → continue or stop | Discuss → plan → execute → verify phase |
| **Best for** | “Keep working on this until tests pass” | “Ship milestone v2 with traced requirements” |

Use `/goal` when you want a **session- or workspace-level** execution loop with evidence and anti-spin rules. Use `/gsd-progress` and phase commands when you need **structured delivery** across many steps. A `/goal` objective can reference GSD (“complete phase 3 per ROADMAP”) without merging the two codepaths.

## Documentation

- [docs/INSTALL-OPENCODE.md](docs/INSTALL-OPENCODE.md) — plugin wiring for `~/.config/opencode/opencode.json`
- [docs/DOGFOOD.md](docs/DOGFOOD.md) — CLI loop verification results
- [docs/PUBLISH.md](docs/PUBLISH.md) — npm publish strategy
- [docs/UPSTREAM-CONTRIBUTION.md](docs/UPSTREAM-CONTRIBUTION.md) — PR #28610 comment draft
- [docs/PARITY.md](docs/PARITY.md) — cursor-goal vs watzon/opencode-goal vs this repo
- [docs/UPSTREAM.md](docs/UPSTREAM.md) — OpenCode #27167 and PR #28610
Reference clones under `repos/` are ignored and used only for local parity research when present.

## License

MIT
