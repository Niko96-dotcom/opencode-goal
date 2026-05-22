# OpenCode upstream: native goals

## Issue #27167 — [FEATURE]: Add native session goals with /goal

- **URL:** https://github.com/anomalyco/opencode/issues/27167
- **State (May 2026):** Open; maintainer note: not planned yet, kept open for demand.
- **Ask:** Persisted per-session goal, pause/resume/clear, idle continuation, token/time usage, optional budgets, verification before “done”.
- **Why plugins exist:** Slash command templates alone cannot provide persistence, runtime continuation, usage accounting, or client sync — same rationale as Codex’s in-app goal runtime.

## PR #28610 — feat: native /goal command for autonomous task completion

- **URL:** https://github.com/anomalyco/opencode/pull/28610
- **Author:** @NathanKong76 — closes #27167
- **Gate:** `experimental.goals` (default off)
- **Design (from PR description):**
  - SQLite `GoalTable` + `SessionGoal.Service`
  - Tools: `create_goal`, `update_goal`, `get_goal`
  - Synthetic user continuation message when goal still active after a turn
  - Iteration limit (default 50); `/goal pause|resume|clear`; `--token-budget`
  - Lazy `config.get()` inside `runLoop` to avoid `InstanceRef` errors during layer resolution

## Patterns worth contributing upstream

When reviewing or commenting on PR #28610, offer tests/docs for patterns proven in **cursor-goal** / **goal-core**:

### 1. Verify gate (evidence-first completion)

- Model proposes completion; **runtime** runs configured shell command (or explicit skip).
- Reject `complete` when verify fails even if the model says COMPLETE.
- Record `completion_rejected_by_validation` in goal history.

### 2. Anti-spin (zero tool calls + failed verify)

- If verify fails and the turn had **zero tool calls**, do not auto-continue (set blocked or suppress next idle injection).
- Prevents “narration loops” without repo changes.

### 3. GOAL_STATUS / GOAL_REASON contract

- End-of-turn machine-readable lines (Codex cookbook alignment).
- Parser normalizes `DONE`, `COMPLETE`, `needs input`, etc.
- Last line wins when multiple status blocks appear.

### 4. Dual budget semantics

- **Turn budget** (cursor-goal): `maxTurns` / `turnCount`
- **Token budget** (watzon / PR): optional cap with wrap-up, not fake completion

### 5. Durable audit artifact

- Optional durable run markdown for audit (complements SQLite session goals). Workspace-local `.goal/` remains useful as an explicit legacy mode.

## Deprecation path for this plugin

If PR #28610 merges with parity on verify + anti-spin:

1. Keep **goal-core** + **goal-cli** for Cursor and CI (`--verify`, durable audit state).
2. Thin **opencode-goal** to: bridge external goal state ↔ native goal API, or deprecate auto-continue and document migration to `experimental.goals`.
3. Track issue #27167 for API stability before removing plugin hooks.

## References

- Codex goals: https://developers.openai.com/codex/use-cases/follow-goals
- cursor-goal research: `repos/cursor-goal/docs/codex-goal-research.md`
- watzon plugin: `repos/opencode-goal/src/index.ts`
