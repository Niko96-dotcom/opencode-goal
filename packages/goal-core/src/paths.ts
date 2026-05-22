import path from "node:path"
import crypto from "node:crypto"
import os from "node:os"

export const CURRENT_FILE = "current.json"

export function resolveGoalDir(cwd: string, explicit?: string) {
  if (explicit) return path.resolve(explicit)
  if (process.env.GOAL_STATE_DIR) return path.resolve(process.env.GOAL_STATE_DIR)
  if (process.env.CURSOR_GOAL_STATE_DIR) return path.resolve(process.env.CURSOR_GOAL_STATE_DIR)
  if (
    process.env.GOAL_STATE_SCOPE === "workspace" ||
    process.env.CURSOR_GOAL_STATE_SCOPE === "workspace" ||
    process.env.GOAL_LEGACY_WORKSPACE_STATE === "1" ||
    process.env.CURSOR_GOAL_LEGACY_WORKSPACE_STATE === "1"
  ) {
    return path.join(path.resolve(cwd), ".goal")
  }
  return defaultGoalDir(cwd)
}

export function defaultGoalDir(cwd: string) {
  const resolved = path.resolve(cwd)
  const slug = slugify(path.basename(resolved) || "workspace")
  const hash = crypto.createHash("sha256").update(resolved).digest("hex").slice(0, 12)
  const stateRoot = process.env.XDG_STATE_HOME
    ? path.resolve(process.env.XDG_STATE_HOME)
    : path.join(os.homedir(), ".local", "state")
  return path.join(stateRoot, "cursor-goal", "workspaces", `${slug}-${hash}`)
}

export function currentStatePath(stateDir: string) {
  return path.join(stateDir, CURRENT_FILE)
}

export function watzonStatePath(cwd: string) {
  return path.join(cwd, ".opencode", "goals", "state.json")
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
