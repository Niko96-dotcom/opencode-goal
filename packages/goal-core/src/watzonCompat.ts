import fs from "node:fs/promises"
import { watzonStatePath } from "./paths.js"
import type { GoalState } from "./types.js"

/** Read watzon/opencode-goal session state for a session (optional bridge). */
export async function loadWatzonSessionGoal(
  cwd: string,
  sessionID: string,
): Promise<{ objective: string; status: string } | null> {
  try {
    const raw = await fs.readFile(watzonStatePath(cwd), "utf8")
    const parsed = JSON.parse(raw) as { goals?: Record<string, { objective?: string; status?: string }> }
    const goal = parsed?.goals?.[sessionID]
    if (!goal?.objective) return null
    return { objective: goal.objective, status: goal.status ?? "active" }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

/** Map goal-core lifecycle to watzon status string. */
export function toWatzonStatus(status: GoalState["status"]) {
  if (status === "complete") return "completed"
  if (status === "budget_limited") return "budget_limited"
  return status
}
