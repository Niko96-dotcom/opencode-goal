# @nikomohr/goal-cli

Portable CLI for setting objectives, checkpoints, pause/resume, and verification.

```bash
npx @nikomohr/goal-cli "fix tests" --verify "npm test"
npx @nikomohr/goal-cli status --json
```

The binary name is `goal`. State is external by default and compatible with `cursor-goal`; use `--state-dir .goal` for legacy workspace-local state.
