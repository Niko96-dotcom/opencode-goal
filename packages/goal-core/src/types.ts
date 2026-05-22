export const GOAL_SCHEMA_VERSION = 1
export const DEFAULT_MAX_TURNS = 8
export const DEFAULT_VALIDATION_TIMEOUT_MS = 300_000

export type GoalLifecycleStatus =
  | "active"
  | "paused"
  | "complete"
  | "blocked"
  | "budget_limited"

export type GoalDecisionStatus = "complete" | "continue" | "blocked"

export type GoalDecision = {
  status: GoalDecisionStatus
  reason: string
  rawStatus?: string
}

export type ValidationResult = {
  command?: string
  ok: boolean
  skipped: boolean
  exitCode?: number | null
  signal?: string | null
  durationMs: number
  stdout: string
  stderr: string
  reason?: string
}

export type GoalState = {
  schemaVersion: typeof GOAL_SCHEMA_VERSION
  goalId: string
  cwd: string
  objective: string
  status: GoalLifecycleStatus
  createdAt: string
  updatedAt: string
  verifyCommand?: string
  maxTurns: number
  turnCount: number
  validationTimeoutMs: number
  allowDestructive: boolean
  runLogPath?: string
  last: {
    decision?: GoalDecision
    validation?: ValidationResult
    assistantTail?: string
    toolCallCount?: number
    reason?: string
  }
  history: Array<{
    at: string
    event: string
    details?: Record<string, unknown>
  }>
}

export type CheckpointInput = {
  assistantText: string
  toolCalls?: number
  verifyCmd?: string
  cwd: string
  stateDir?: string
  once?: boolean
  runVerify?: (command: string, cwd: string) => Promise<ValidationResult>
}

export type CheckpointResult = {
  state: GoalState
  shouldContinue: boolean
  continuationPrompt?: string
  rejectedComplete: boolean
  suppressedSpin: boolean
}
