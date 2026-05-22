# Suggestion: verify gate in SessionGoal (PR #28610)

Pseudocode for `packages/opencode/src/session/goal.ts` (or wherever status transitions run after a turn):

```typescript
// After parsing model goal status and running optional verify shell:
function applyTurnOutcome(goal, decision, validation, toolCallCount) {
  if (decision.status === "complete" && validation.ok) {
    return completeGoal(goal)
  }
  if (decision.status === "complete" && !validation.ok) {
    goal.history.push({ type: "completion_rejected_by_validation", ... })
    return { continueLoop: true, rejectComplete: true }
  }
  if (!validation.ok && toolCallCount === 0) {
    return blockGoal(goal, "zero_tool_calls_after_failed_verify")
  }
  if (decision.status === "blocked") {
    return blockGoal(goal, decision.reason)
  }
  return { continueLoop: true }
}
```

Mirror tests from `@nikomohr/goal-core` `test/checkpoint.test.ts` and `test/loopPolicy.test.ts`.
