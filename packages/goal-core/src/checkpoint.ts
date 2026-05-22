import { buildContinuationPrompt } from "./prompt.js"
import { applyCheckpointOutcome, budgetStopReason } from "./loopPolicy.js"
import { resolveGoalDir } from "./paths.js"
import { parseGoalDecision } from "./statusParser.js"
import { loadGoalState, saveGoalState } from "./state.js"
import { tailText } from "./text.js"
import type { CheckpointInput, CheckpointResult } from "./types.js"
import { runValidation } from "./validation.js"

export async function checkpoint(input: CheckpointInput): Promise<CheckpointResult> {
  const stateDir = resolveGoalDir(input.cwd, input.stateDir)
  const state = await loadGoalState(stateDir)
  if (!state) throw new Error('No goal exists. Set one with /goal or `goal "<objective>"`.')
  if (state.status !== "active") {
    throw new Error(`Goal is ${state.status}; only active goals accept checkpoints.`)
  }

  const budgetReason = budgetStopReason(state)
  if (budgetReason) {
    state.status = "budget_limited"
    state.last.reason = budgetReason
    await saveGoalState(stateDir, state)
    return {
      state,
      shouldContinue: false,
      rejectedComplete: false,
      suppressedSpin: false,
    }
  }

  const decision = parseGoalDecision(input.assistantText)
  state.turnCount += 1
  state.last.decision = decision
  state.last.toolCallCount = input.toolCalls ?? 0
  state.last.assistantTail = tailText(input.assistantText, 4000)

  const verifyCommand = input.verifyCmd ?? state.verifyCommand
  const validation = input.runVerify
    ? await input.runVerify(verifyCommand ?? "", input.cwd)
    : await runValidation({
        command: verifyCommand,
        cwd: input.cwd,
        timeoutMs: state.validationTimeoutMs,
        allowDestructive: state.allowDestructive,
      })

  state.last.validation = validation

  const outcome = applyCheckpointOutcome(
    state,
    decision,
    validation,
    input.toolCalls ?? 0,
    { once: input.once },
  )

  await saveGoalState(stateDir, state)

  const continuationPrompt =
    outcome.shouldContinue && state.status === "active"
      ? buildContinuationPrompt(state, validation)
      : undefined

  return {
    state,
    shouldContinue: outcome.shouldContinue,
    continuationPrompt,
    rejectedComplete: outcome.rejectedComplete,
    suppressedSpin: outcome.suppressedSpin,
  }
}

export { buildContinuationPrompt as prompt }
