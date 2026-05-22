# @nikomohr/goal-core

Shared goal state, checkpoint handling, verify gate, `GOAL_STATUS` parsing, and continuation prompts.

By default, state resolves to the same external workspace directory as `cursor-goal`:

```text
$XDG_STATE_HOME/cursor-goal/workspaces/<slug>-<hash>/
```

Use `--state-dir .goal`, `GOAL_STATE_SCOPE=workspace`, or `CURSOR_GOAL_STATE_SCOPE=workspace` for legacy workspace-local state.

Used by `@nikomohr/goal-cli`, `@nikomohr/opencode-goal`, and Pi/Command Code wrappers.
