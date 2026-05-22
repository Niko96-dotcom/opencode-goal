# Dogfood results (2026-05-23)

Manual CLI loop against this monorepo. Commands run from workspace root unless noted.

This historical run used legacy workspace-local `.goal/` state. Current releases default to external workspace state shared with `cursor-goal`; pass `--state-dir .goal` or `GOAL_STATE_SCOPE=workspace` to reproduce the legacy paths.

## Task exercised

- Added `packages/goal-core/test/exports.test.ts` (public API export smoke test).
- Added `examples/dogfood/fail-verify.sh` (always exits 1).

Verify surface: `npm test -w @nikomohr/goal-core`

## Scenarios

| Scenario | Command | Result |
|----------|---------|--------|
| Set goal + continuation prompt | `npx goal "..." --verify "npm test -w @nikomohr/goal-core"` | **PASS** — state `active`, run log written, continuation emitted |
| Status | `npx goal status` | **PASS** |
| CONTINUE + verify pass | `goal checkpoint` with `GOAL_STATUS: CONTINUE`, `--tool-calls 2` | **PASS** — `Last validation: passed (exit 0)`, turn 1→2, still `active` |
| COMPLETE + verify fail | `--verify "bash examples/dogfood/fail-verify.sh"` then `GOAL_STATUS: COMPLETE` | **PASS** — stayed `active`, reason *Model reported completion, but verification failed* |
| Zero-tool spin | CONTINUE + `--tool-calls 0` + failing verify | **PASS** — `blocked`, spin reason set |
| Pause / resume | `goal pause` / `goal resume` | **PASS** |
| Clear | `goal clear` | **PASS** |

## What worked

- Verify gate rejects completion when shell fails (matches unit tests in `checkpoint.test.ts`).
- Anti-spin blocks `CONTINUE` with zero tool calls when verify fails.
- Durable goal state and run audit trail created on goal set.
- Continuation prompt includes verification stdout tail after a passing run.

## Gaps / bugs found

1. **OpenCode plugin not exercised here** — This run was CLI-only; plugin idle continuation and `session.next.goal.*` events need a live OpenCode session (compare with upstream PR #28610 events).
2. **Event payload parity** — Upstream PR emits `session.next.goal.set|updated|cleared|completed`; this plugin uses file state + synthetic inject; no cross-client event stream yet.

## Event / integration notes for upstream

When commenting on [PR #28610](https://github.com/anomalyco/opencode/pull/28610), highlight that **goal-core** already implements:

- `completion_rejected_by_validation` history event
- `goal_blocked` on zero-tool + failed verify
- Optional durable run artifacts alongside SQLite session goals
