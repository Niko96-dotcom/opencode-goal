# Install opencode-goal in OpenCode

## Local config

Add the plugin to `~/.config/opencode/opencode.json`:

```json
"plugin": [
  "file:///absolute/path/to/opencode-goal/packages/opencode-goal"
]
```

Restart OpenCode (or reload config) after editing.

## Monorepo build

From the workspace root:

```bash
cd opencode-goal
npm install
npm run build
npm test
```

`npm run build` compiles `@nikomohr/goal-core` and `@nikomohr/goal-cli`. The OpenCode plugin (`@nikomohr/opencode-goal`) is TypeScript consumed directly by Bun via `file://` — no separate build step.

## Usage in OpenCode

```text
/goal status
/goal clear
/goal pause
/goal resume
/goal --verify "npm test" fix the failing unit tests
```

The plugin wires:

- Slash command rewrite + system inject for active goals
- Idle continuation (debounced) when a goal stays `active`
- Checkpoint semantics aligned with **goal-core** (verify gate, anti-spin)

## Coexistence with GSD

This does **not** remove or replace Get Shit Done plugins. `/goal` is a workspace-level execution loop; `/gsd-*` remains the structured milestone workflow. See [README.md](../README.md#goal-vs-gsd).

## npm install

For published installs, prefer:

```json
"plugin": ["@nikomohr/opencode-goal"]
```

For local development, keep the `file://` path above.
