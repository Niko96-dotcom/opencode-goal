import test from "node:test"
import assert from "node:assert/strict"
import * as goalCore from "../src/index.js"

test("goal-core public API exports", () => {
  const expected = [
    "checkpoint",
    "createGoalState",
    "loadGoalState",
    "saveGoalState",
    "clearGoalState",
    "runValidation",
    "parseGoalDecision",
    "buildContinuationPrompt",
    "applyCheckpointOutcome",
    "resolveGoalDir",
    "defaultGoalDir",
  ]
  for (const name of expected) {
    assert.equal(typeof (goalCore as Record<string, unknown>)[name], "function", name)
  }
})
