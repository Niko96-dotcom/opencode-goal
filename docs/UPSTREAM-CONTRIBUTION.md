# Upstream contribution — PR #28610

Copy-paste ready comment for https://github.com/anomalyco/opencode/pull/28610

---

Thanks for pushing native goals — this closes a real gap vs Codex-style loops (#27167).

I maintain a portable **goal-core** implementation (checkpoint + verify gate + anti-spin) used by an OpenCode plugin and a Cursor CLI. A few patterns are already battle-tested there and may be worth folding into `SessionGoal` / the prompt loop before `experimental.goals` ships broadly:

### 1. Verify gate must reject COMPLETE when shell fails

Model `GOAL_STATUS: COMPLETE` should not finish the goal if the configured verification command exits non-zero.

Reference: `packages/goal-core/src/loopPolicy.ts` — `applyCheckpointOutcome()` sets `rejectedComplete` and keeps status `active` with history event `completion_rejected_by_validation`.

```typescript
if (decision.status === "complete" && !verificationOk(validation)) {
  rejectedComplete = true
  state.last.reason = "Model reported completion, but verification failed; continuing while budget remains."
  pushHistory(state, "completion_rejected_by_validation", { ... })
}
```

Unit test: `packages/goal-core/test/checkpoint.test.ts` — *checkpoint rejects COMPLETE when verify fails*.

### 2. Zero-tool-call anti-spin after failed verify

If verification fails and the turn had **zero tool calls**, do not inject another synthetic continuation (otherwise the model narrates forever without touching the repo).

Reference: `loopPolicy.ts` — blocks with `SPIN_REASON` and `suppressedSpin: true`.

```typescript
if (!validation.ok && !validation.skipped && toolCallCount === 0) {
  state.status = "blocked"
  state.last.reason = "Verification failed and the checkpoint made no tool calls; suppressed continuation to avoid a spin loop."
}
```

### 3. Machine-readable end-of-turn contract

Align with Codex cookbook: require final lines:

```text
GOAL_STATUS: COMPLETE | CONTINUE | BLOCKED
GOAL_REASON: <short evidence sentence>
```

Parser: `packages/goal-core/src/statusParser.ts` (normalizes `DONE`, `COMPLETE`, etc.; last block wins).

### 4. Optional durable audit trail (complements SQLite)

Session goals in SQLite are great for client sync; durable state plus run markdown helps CI and cross-tool parity (Cursor CLI, headless checkpoint). Workspace-local `.goal/` remains available as an explicit legacy mode when a repo-local artifact is useful.

Reference: `packages/goal-core/src/state.ts`, `paths.ts`.

### 5. Suggested acceptance tests for upstream

- `complete` + failing verify → goal stays active, iteration continues
- `continue` + failing verify + `toolCalls === 0` → goal blocked, no next synthetic user message
- `complete` + passing verify (or explicit skip) → `session.next.goal.completed`

Happy to contribute tests or a small doc section if useful. Repo: *opencode-goal monorepo* (`@nikomohr/goal-core`).

---

## PR #28610 approach summary

| Area | Upstream PR | This repo (goal-core) |
|------|-------------|------------------------|
| Persistence | SQLite `GoalTable` + `SessionGoal.Service` | External workspace state + run markdown |
| Feature gate | `experimental.goals` | OpenCode `plugin` entry |
| Continuation | Synthetic user message in `runLoop` | `buildContinuationPrompt()` + plugin idle inject |
| Tools | `create_goal`, `update_goal`, `get_goal` | `/goal` slash + CLI `goal checkpoint` |
| Budget | Token budget + iteration limit (50) | Turn budget (`maxTurns`) + optional verify timeout |
| Events | `session.next.goal.*` | File history array (not yet wired to OpenCode event bus) |

## Optional minimal patch file

See [patches/upstream-28610-verify-gate-suggestion.md](./patches/upstream-28610-verify-gate-suggestion.md) for pseudocode mapping `SessionGoal` update paths to the goal-core gate.
