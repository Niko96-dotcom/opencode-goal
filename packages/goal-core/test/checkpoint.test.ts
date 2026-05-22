import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import assert from "node:assert/strict"
import { checkpoint } from "../src/checkpoint.js"
import { createGoalState, loadGoalState, saveGoalState } from "../src/state.js"
import { defaultGoalDir, resolveGoalDir } from "../src/paths.js"

test("checkpoint rejects COMPLETE when verify fails", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "goal-core-verify-"))
  const stateDir = resolveGoalDir(tmp)
  const state = createGoalState({
    cwd: tmp,
    objective: "ship feature",
    verifyCommand: "false",
    maxTurns: 5,
    stateDir,
  })
  await saveGoalState(stateDir, state)

  const result = await checkpoint({
    cwd: tmp,
    stateDir,
    assistantText: "All done.\nGOAL_STATUS: COMPLETE\nGOAL_REASON: finished",
    toolCalls: 1,
    runVerify: async () => ({
      ok: false,
      skipped: false,
      durationMs: 0,
      stdout: "",
      stderr: "forced fail",
    }),
  })

  assert.equal(result.state.status, "active")
  assert.equal(result.rejectedComplete, true)
  assert.equal(result.shouldContinue, true)

  const saved = await loadGoalState(stateDir)
  assert.equal(saved?.status, "active")
  assert.match(saved?.last.reason ?? "", /verification failed/i)
})

test("checkpoint blocks zero-tool spin on verify failure", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "goal-core-spin-"))
  const stateDir = resolveGoalDir(tmp)
  const state = createGoalState({ cwd: tmp, objective: "fix tests", stateDir })
  await saveGoalState(stateDir, state)

  const result = await checkpoint({
    cwd: tmp,
    stateDir,
    assistantText: "GOAL_STATUS: CONTINUE\nGOAL_REASON: retry",
    toolCalls: 0,
    runVerify: async () => ({
      ok: false,
      skipped: false,
      durationMs: 0,
      stdout: "",
      stderr: "fail",
    }),
  })

  assert.equal(result.state.status, "blocked")
  assert.equal(result.suppressedSpin, true)
  assert.equal(result.shouldContinue, false)
})

test("default state dir matches cursor-goal external workspace state", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "goal-core-state-"))
  const stateDir = resolveGoalDir(tmp)

  assert.equal(stateDir, defaultGoalDir(tmp))
  assert.ok(!stateDir.startsWith(path.join(tmp, ".goal")))
  assert.match(stateDir, /cursor-goal/)
})
