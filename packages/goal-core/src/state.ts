import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { currentStatePath, resolveGoalDir } from "./paths.js"
import {
  DEFAULT_MAX_TURNS,
  DEFAULT_VALIDATION_TIMEOUT_MS,
  GOAL_SCHEMA_VERSION,
  type GoalLifecycleStatus,
  type GoalState,
} from "./types.js"

function timestampSlug(iso: string) {
  return iso.replace(/[:.]/g, "-")
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "goal"
  )
}

export async function loadGoalState(stateDir: string): Promise<GoalState | null> {
  try {
    const raw = await fs.readFile(currentStatePath(stateDir), "utf8")
    return parseGoalState(JSON.parse(raw) as unknown)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export function parseGoalState(raw: unknown): GoalState {
  if (!raw || typeof raw !== "object") throw new Error("Invalid goal state: not an object")
  const o = raw as Record<string, unknown>
  const status = o.status as GoalLifecycleStatus
  if (!o.objective || typeof o.objective !== "string") throw new Error("Invalid goal state: missing objective")

  return {
    schemaVersion: GOAL_SCHEMA_VERSION,
    goalId: String(o.goalId ?? "unknown"),
    cwd: String(o.cwd ?? process.cwd()),
    objective: o.objective,
    status: status ?? "active",
    createdAt: String(o.createdAt ?? new Date().toISOString()),
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    verifyCommand: o.verifyCommand ? String(o.verifyCommand) : undefined,
    maxTurns: Number(o.maxTurns ?? DEFAULT_MAX_TURNS),
    turnCount: Number(o.turnCount ?? 0),
    validationTimeoutMs: Number(o.validationTimeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS),
    allowDestructive: Boolean(o.allowDestructive),
    runLogPath: o.runLogPath ? String(o.runLogPath) : undefined,
    last: (o.last as GoalState["last"]) ?? {},
    history: Array.isArray(o.history) ? (o.history as GoalState["history"]) : [],
  }
}

export async function saveGoalState(stateDir: string, state: GoalState) {
  state.updatedAt = new Date().toISOString()
  await fs.mkdir(stateDir, { recursive: true })
  if (state.runLogPath) {
    await fs.mkdir(path.dirname(state.runLogPath), { recursive: true })
  }
  const tmp = `${currentStatePath(stateDir)}.${process.pid}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  await fs.rename(tmp, currentStatePath(stateDir))
}

export async function clearGoalState(stateDir: string) {
  try {
    await fs.rm(currentStatePath(stateDir))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

export function createGoalState(options: {
  cwd: string
  objective: string
  verifyCommand?: string
  maxTurns?: number
  stateDir?: string
  allowDestructive?: boolean
}): GoalState {
  const now = new Date().toISOString()
  const stateDir = resolveGoalDir(options.cwd, options.stateDir)
  const goalId = `${timestampSlug(now)}-${slugify(options.objective)}-${crypto.randomBytes(3).toString("hex")}`
  const runLogPath = path.join(stateDir, "runs", `${goalId}.md`)

  return {
    schemaVersion: GOAL_SCHEMA_VERSION,
    goalId,
    cwd: options.cwd,
    objective: options.objective,
    status: "active",
    createdAt: now,
    updatedAt: now,
    verifyCommand: options.verifyCommand,
    maxTurns: options.maxTurns ?? DEFAULT_MAX_TURNS,
    turnCount: 0,
    validationTimeoutMs: DEFAULT_VALIDATION_TIMEOUT_MS,
    allowDestructive: options.allowDestructive ?? false,
    runLogPath,
    last: {},
    history: [{ at: now, event: "goal_created", details: { objective: options.objective } }],
  }
}

export function formatGoalStatus(state: GoalState | null) {
  if (!state) return "No active goal."
  const validation = state.last.validation
  return [
    `Goal: ${state.status}`,
    `Objective: ${state.objective}`,
    `Turns: ${state.turnCount}/${state.maxTurns}`,
    `Verification: ${state.verifyCommand ?? "not configured"}`,
    validation
      ? `Last validation: ${validation.ok ? "passed" : "failed"}${validation.exitCode !== undefined ? ` (exit ${validation.exitCode})` : ""}`
      : "Last validation: none",
    state.runLogPath ? `Run log: ${state.runLogPath}` : undefined,
    state.last.reason ? `Reason: ${state.last.reason}` : undefined,
  ]
    .filter(Boolean)
    .join("\n")
}
