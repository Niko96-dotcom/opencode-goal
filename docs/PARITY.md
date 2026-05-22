# Goal parity: cursor-goal vs watzon/opencode-goal vs opencode-goal (this repo)

Reference clones live under `repos/cursor-goal` and `repos/opencode-goal`.

## State paths

| Host | Path | Scope |
|------|------|--------|
| **cursor-goal** | `$XDG_STATE_HOME/cursor-goal/workspaces/<slug>-<hash>/current.json` | External workspace state |
| **cursor-goal** | `.goal/current.json` | Legacy workspace-local state when explicitly requested |
| **watzon/opencode-goal** | `.opencode/goals/state.json` | Per OpenCode session (`goals[sessionID]`) |
| **this repo (goal-core)** | `$XDG_STATE_HOME/cursor-goal/workspaces/<slug>-<hash>/current.json` | Same external state contract as cursor-goal |
| **this repo (plugin)** | Also mirrors active session slice to `.opencode/goals/state.json` when running in OpenCode | Session bridge plus external state |

**Recommendation:** Treat the external `cursor-goal/workspaces/<slug>-<hash>/current.json` resolver as the cross-tool contract (Cursor CLI, OpenCode plugin, CI). Use `--state-dir .goal` only when a workspace-local audit artifact is explicitly desired.

## Hooks and runtime integration

| Capability | cursor-goal | watzon plugin | this `opencode-goal` |
|------------|-------------|---------------|----------------------|
| Slash `/goal` | Cursor skill (chat) | `config.command.goal` + `command.execute.before` | Same as watzon |
| System prompt injection | Skill text | `experimental.chat.system.transform` | Same |
| Compaction preservation | N/A (IDE) | `experimental.session.compacting` | Same |
| Idle auto-continue | Manual in chat | `session.status` idle + `session.idle` → `session.promptAsync` | Same (conservative gates) |
| Model tools | N/A | `get_goal`, `update_goal` | `get_goal`, `update_goal` (delegates to goal-core rules) |
| CLI checkpoint | `cursor-goal checkpoint` | None | `goal` / `cursor-goal` via `goal-cli` |

## Continuation contract

| Aspect | cursor-goal | watzon | this repo |
|--------|-------------|--------|-----------|
| Prompt source | `buildContinuationPrompt()` | Inline `continuationPrompt(goal)` | `goal-core` `buildContinuationPrompt()` (Codex-aligned) |
| Machine-readable status | **Required:** `GOAL_STATUS` + `GOAL_REASON` | Model calls `update_goal` tool | Both: lines in assistant text **and** optional `update_goal` |
| User “type continue” | Discouraged in contract | Discouraged in system inject | Same |

## Verify / checkpoint

| Behavior | cursor-goal | watzon | this repo |
|----------|-------------|--------|-----------|
| Shell verify command | `--verify` on CLI; stored in state | **Not implemented** | `verifyCommand` in external state; CLI + plugin |
| Reject COMPLETE when verify fails | **Yes** (`loopPolicy`) | No shell gate | **Yes** (goal-core) |
| Verify skipped = OK for complete | Yes (`validation.skipped`) | N/A | Yes |
| Run logs | External state run files; legacy `.goal/runs/*.md` with `--state-dir .goal` | No | Optional via goal-cli |

## GOAL_STATUS contract

| Status (normalized) | cursor-goal | watzon | this repo |
|---------------------|-------------|--------|-----------|
| COMPLETE / done | → `complete` if verify OK | `update_goal(completed)` | Same as cursor-goal via parser |
| COMPLETE + verify fail | Stays `active`, history `completion_rejected_by_validation` | Unclear / honor model | Same as cursor-goal |
| CONTINUE | Stays `active` | Keep working + idle continue | Same |
| BLOCKED | → `blocked` | `update_goal(blocked)` | Same |

Parser accepts `GOAL_STATUS:` lines and Codex-style XML-ish fallbacks (from cursor-goal `statusParser.ts`).

## Anti-spin rules

| Rule | cursor-goal | watzon | this repo |
|------|-------------|--------|-----------|
| Max turns budget | `maxTurns` / `turnsUsed` | Token budget only | **Both** turn + token (plugin) |
| Zero tool calls + verify fail | → `blocked`, no continuation | `lastContinuationHadToolCalls === false` skips **next** idle continue | **Both** (core blocks; plugin skips queue) |
| Debounce continuation | N/A | 1500ms | 1500ms (plugin) |
| Management commands suppress continue | N/A | pause/status/help set `suppressNextIdleContinuation` | Same |

## Lifecycle

| Status | cursor-goal | watzon | goal-core |
|--------|-------------|--------|-----------|
| active | ✓ | ✓ | ✓ |
| paused | ✓ | ✓ | ✓ |
| complete | ✓ | completed | complete |
| blocked | ✓ | ✓ | ✓ |
| budget_limited | ✓ (turns) | ✓ (tokens) | ✓ |
| cleared | clear file | cleared | mapped to clear |

## Parity gaps (watzon → this repo)

1. **Shell verification gate** — watzon has no `--verify` / no CLI rejection of premature COMPLETE.
2. **GOAL_STATUS lines** — watzon relies on `update_goal` tool, not structured end-of-turn lines.
3. **External workspace state** — watzon is session-scoped only.
4. **Run audit logs** — watzon does not write durable run markdown.

## Parity gaps (this repo → cursor-goal)

1. **OpenCode idle continuation** — cursor-goal expects the user/skill to loop in chat; plugin auto-queues here.
2. **Token budget** — inherited from watzon in plugin; cursor-goal uses turn budget primarily.

## Smoke alignment

Use cursor-goal’s [smoke-test.md](https://github.com/Niko96-dotcom/cursor-goal/blob/main/docs/smoke-test.md) for CLI checks. For OpenCode: set goal via `/goal`, let session go idle, confirm continuation prompt and that verify failure + zero tool calls does not spin.
