import type { GoalDecision, GoalState, ValidationResult } from "./types.js"
import { verificationOk } from "./validation.js"

const COMPLETION_REJECTED_REASON =
  "Model reported completion, but verification failed; continuing while budget remains."

const SPIN_REASON =
  "Verification failed and the checkpoint made no tool calls; suppressed continuation to avoid a spin loop."

export function budgetStopReason(state: GoalState) {
  if (state.turnCount >= state.maxTurns) {
    return `Turn budget reached (${state.turnCount}/${state.maxTurns}).`
  }
  return undefined
}

export type ApplyOutcomeResult = {
  rejectedComplete: boolean
  suppressedSpin: boolean
  shouldContinue: boolean
}

export function applyCheckpointOutcome(
  state: GoalState,
  decision: GoalDecision,
  validation: ValidationResult,
  toolCallCount: number,
  options: { once?: boolean } = {},
): ApplyOutcomeResult {
  let rejectedComplete = false
  let suppressedSpin = false

  if (decision.status === "complete" && verificationOk(validation)) {
    state.status = "complete"
    state.last.reason = decision.reason
    pushHistory(state, "goal_complete", { reason: decision.reason })
    return { rejectedComplete: false, suppressedSpin: false, shouldContinue: false }
  }

  if (decision.status === "complete" && !verificationOk(validation)) {
    rejectedComplete = true
    state.last.reason = COMPLETION_REJECTED_REASON
    pushHistory(state, "completion_rejected_by_validation", {
      reason: decision.reason,
      exitCode: validation.exitCode,
    })
  }

  if (decision.status === "blocked") {
    state.status = "blocked"
    state.last.reason = decision.reason
    pushHistory(state, "goal_blocked", { reason: decision.reason })
    return { rejectedComplete, suppressedSpin: false, shouldContinue: false }
  }

  if (!validation.ok && !validation.skipped && toolCallCount === 0) {
    suppressedSpin = true
    state.status = "blocked"
    state.last.reason = SPIN_REASON
    pushHistory(state, "goal_blocked", { reason: SPIN_REASON })
    return { rejectedComplete, suppressedSpin, shouldContinue: false }
  }

  if (state.status === "active" && !options.once) {
    pushHistory(state, "goal_continues", {
      reason: decision.reason,
      validationOk: validation.ok,
      validationSkipped: validation.skipped,
    })
  }

  if (state.status === "active" && options.once) {
    state.status = "paused"
    state.last.reason = "--once completed one checkpoint and paused."
    pushHistory(state, "goal_paused", { reason: state.last.reason })
  }

  const shouldContinue = state.status === "active" && !options.once
  return { rejectedComplete, suppressedSpin, shouldContinue }
}

export function shouldSuppressIdleContinuation(state: GoalState) {
  if (state.status !== "active") return true
  const validation = state.last.validation
  const toolCalls = state.last.toolCallCount ?? 0
  if (validation && !validation.ok && !validation.skipped && toolCalls === 0) return true
  if (state.last.reason === SPIN_REASON) return true
  return false
}

function pushHistory(state: GoalState, event: string, details?: Record<string, unknown>) {
  state.history.push({ at: new Date().toISOString(), event, details })
  state.history = state.history.slice(-200)
}
