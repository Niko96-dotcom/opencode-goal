/**
 * Smoke-test opencode-goal hooks without a live LLM round-trip.
 * Run: node scripts/plugin-hook-smoke.mjs
 */
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL("..", import.meta.url)))
const stateDir = await mkdtemp(join(tmpdir(), "opencode-goal-state-"))
process.env.GOAL_STATE_DIR = stateDir

await rm(stateDir, { recursive: true, force: true })

const mod = await import(join(root, "packages/opencode-goal/src/index.ts"))
const pluginFactory = mod.default?.server ?? mod.GoalPlugin
if (typeof pluginFactory !== "function") {
  throw new Error("Could not load GoalPlugin factory")
}

const client = { session: { promptAsync: async () => {} } }
const plugin = await pluginFactory({ client, worktree: root, directory: root })

const config = { command: {} }
await plugin.config(config)
if (!config.command.goal) throw new Error("goal command not registered")

const sessionID = "ses_smoke_test"
const output = { parts: [{ type: "text", text: "original" }] }

await plugin["command.execute.before"](
  { command: "goal", arguments: '--verify "npm test -w @nikomohr/goal-core" smoke plugin hooks', sessionID },
  output,
)

const injected = output.parts[0]?.text ?? ""
if (!injected.includes("active")) throw new Error("create goal did not set active status")
if (!injected.includes("smoke plugin hooks")) throw new Error("objective missing from status")

const current = JSON.parse(await readFile(join(stateDir, "current.json"), "utf8"))
if (current.status !== "active") throw new Error(`expected active, got ${current.status}`)
if (current.verifyCommand !== "npm test -w @nikomohr/goal-core") {
  throw new Error(`verify not parsed: ${current.verifyCommand}`)
}

output.parts[0] = { type: "text", text: "original" }
await plugin["command.execute.before"](
  { command: "goal", arguments: "status", sessionID },
  output,
)
if (!output.parts[0].text.includes("smoke plugin hooks")) {
  throw new Error("status command did not return goal state")
}

const sys = { system: [] }
await plugin["experimental.chat.system.transform"]({}, sys)
if (!sys.system.some((s) => s.includes("Active goal"))) {
  throw new Error("system transform did not inject active goal")
}

console.log("OK plugin-hook-smoke: command registration, create, status, system transform")
