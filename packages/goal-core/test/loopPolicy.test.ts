import test from "node:test"
import assert from "node:assert/strict"
import { applyCheckpointOutcome } from "../src/loopPolicy.js"
import type { GoalState } from "../src/types.js"

function baseState(): GoalState {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    goalId: "test",
    cwd: "/tmp",
    objective: "test objective",
    status: "active",
    createdAt: now,
    updatedAt: now,
    maxTurns: 8,
    turnCount: 1,
    validationTimeoutMs: 30_000,
    allowDestructive: false,
    last: {},
    history: [],
  }
}

test("rejects complete when verification fails", () => {
  const state = baseState()
  const result = applyCheckpointOutcome(
    state,
    { status: "complete", reason: "done" },
    { ok: false, skipped: false, durationMs: 1, stdout: "", stderr: "fail" },
    2,
  )
  assert.equal(state.status, "active")
  assert.equal(result.rejectedComplete, true)
  assert.equal(result.shouldContinue, true)
})

test("blocks spin when verify fails with zero tool calls", () => {
  const state = baseState()
  const result = applyCheckpointOutcome(
    state,
    { status: "continue", reason: "still working" },
    { ok: false, skipped: false, durationMs: 1, stdout: "", stderr: "fail" },
    0,
  )
  assert.equal(state.status, "blocked")
  assert.equal(result.suppressedSpin, true)
  assert.equal(result.shouldContinue, false)
})

test("accepts complete when verification passes", () => {
  const state = baseState()
  applyCheckpointOutcome(
    state,
    { status: "complete", reason: "tests pass" },
    { ok: true, skipped: false, durationMs: 1, stdout: "", stderr: "" },
    1,
  )
  assert.equal(state.status, "complete")
})
