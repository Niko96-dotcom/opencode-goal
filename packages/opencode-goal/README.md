# opencode-goal

OpenCode plugin that brings Codex-style goal loops to the TUI: shell verify gate, `GOAL_STATUS` / `GOAL_REASON` contract, external workspace state, and conservative idle continuation.

## Install

### From this monorepo (local dev)

In your project or global OpenCode config:

```json
{
  "plugin": ["file:///absolute/path/to/opencode goal/packages/opencode-goal"]
}
```

See root `opencode.json` for a copy-paste example.

### Published (when released)

```json
{
  "plugin": ["@nikomohr/opencode-goal"]
}
```

## Usage

- `/goal <objective>` — create or replace workspace goal
- `/goal status` — show current goal state
- `/goal pause` | `/goal resume` | `/goal clear`
- `/goal --verify "npm test" <objective>` — set shell verification (stored in state)

When the session goes idle, the plugin may queue a synthetic continuation prompt (same contract as `goal prompt` / cursor-goal). After assistant turns, it runs **goal-core** checkpoint logic when assistant text was captured.

## CLI companion

Use `@nikomohr/goal-cli` in the same repo:

```bash
npx goal "fix flaky tests" --verify "npm test"
npx goal checkpoint --tool-calls 3 < assistant.md
```

## vs watzon/opencode-goal

See [docs/PARITY.md](../../docs/PARITY.md). This plugin adds shell verify and `GOAL_STATUS` rejection of premature COMPLETE.

## vs GSD

`/goal` = one session objective until done. `/gsd-*` = phased delivery. See root README.
