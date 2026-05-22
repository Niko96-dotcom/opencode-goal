import { tool, type Plugin } from "@opencode-ai/plugin"
import {
  buildContinuationPrompt,
  checkpoint,
  clearGoalState,
  createGoalState,
  formatGoalStatus,
  loadGoalState,
  resolveGoalDir,
  saveGoalState,
  shouldSuppressIdleContinuation,
} from "@nikomohr/goal-core"

type ParsedCommand =
  | { kind: "status" }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "clear" }
  | { kind: "create"; objective: string; verifyCommand?: string; maxTurns?: number }
  | { kind: "help"; reason?: string }

const CONTINUATION_DEBOUNCE_MS = 1500
const GOAL_COMMAND_TEMPLATE =
  "OpenCode goal command arguments:\n\n$ARGUMENTS\n\nThe opencode-goal plugin rewrites this command before it reaches the assistant."

function textPart(text: string) {
  return { type: "text" as const, text, synthetic: true }
}

function now() {
  return Date.now()
}

function tokenize(input: string) {
  const result: string[] = []
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(input))) {
    result.push((match[1] ?? match[2] ?? match[3] ?? "").replace(/\\(["'])/g, "$1"))
  }
  return result
}

function parseCommand(argumentsText: string): ParsedCommand {
  const trimmed = argumentsText.trim()
  if (!trimmed) return { kind: "status" }
  const tokens = tokenize(trimmed)
  const first = tokens[0]?.toLowerCase()
  if (first === "status" || first === "show") return { kind: "status" }
  if (first === "pause") return { kind: "pause" }
  if (first === "resume") return { kind: "resume" }
  if (first === "clear") return { kind: "clear" }
  if (first === "help" || first === "--help" || first === "-h") return { kind: "help" }

  let verifyCommand: string | undefined
  let maxTurns: number | undefined
  const objectiveTokens: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === "--verify" || token === "-v") {
      verifyCommand = tokens[++i]
      continue
    }
    if (token === "--max-turns") {
      maxTurns = Number(tokens[++i])
      continue
    }
    objectiveTokens.push(token)
  }
  const objective = objectiveTokens.join(" ").trim()
  if (!objective) return { kind: "help", reason: "Missing goal objective." }
  return { kind: "create", objective, verifyCommand, maxTurns }
}

function helpText(reason?: string) {
  return [
    reason ? `${reason}\n` : "",
    "Usage:",
    "- /goal <objective>",
    "- /goal --verify \"npm test\" <objective>",
    "- /goal status | pause | resume | clear",
  ]
    .filter(Boolean)
    .join("\n")
}

export const GoalPlugin: Plugin = async ({ client, worktree, directory }) => {
  const root = directory || worktree
  const stateDir = resolveGoalDir(root)
  const continuationInFlight = new Set<string>()
  const continuationPending = new Map<string, number>()
  const sessionAssistantText = new Map<string, string>()
  const sessionToolCalls = new Map<string, number>()
  const suppressNextIdle = new Set<string>()

  async function getState() {
    return loadGoalState(stateDir)
  }

  async function runPostTurnCheckpoint(sessionID: string) {
    const text = sessionAssistantText.get(sessionID)
    if (!text) return
    const state = await getState()
    if (!state || state.status !== "active") return
    try {
      const result = await checkpoint({
        cwd: root,
        stateDir,
        assistantText: text,
        toolCalls: sessionToolCalls.get(sessionID) ?? 0,
      })
      if (result.suppressedSpin || !result.shouldContinue) suppressNextIdle.add(sessionID)
    } catch {
      /* conservative */
    }
  }

  async function queueContinuation(sessionID: string) {
    if (continuationInFlight.has(sessionID)) return
    const t = now()
    if (t - (continuationPending.get(sessionID) ?? 0) < CONTINUATION_DEBOUNCE_MS) return
    continuationPending.set(sessionID, t)
    if (suppressNextIdle.has(sessionID)) {
      suppressNextIdle.delete(sessionID)
      return
    }
    const state = await getState()
    if (!state || state.status !== "active" || shouldSuppressIdleContinuation(state)) return
    continuationInFlight.add(sessionID)
    try {
      const prompt = buildContinuationPrompt(state, state.last.validation)
      const sessionClient = client as unknown as { session?: { promptAsync?: (a: unknown) => Promise<unknown> } }
      await sessionClient.session?.promptAsync?.({
        path: { id: sessionID },
        body: { parts: [textPart(prompt)] },
      })
    } finally {
      setTimeout(() => continuationInFlight.delete(sessionID), CONTINUATION_DEBOUNCE_MS)
    }
  }

  return {
    async config(config) {
      config.command ??= {}
      config.command.goal ??= {
        template: GOAL_COMMAND_TEMPLATE,
        description: "workspace goal with verify gate",
        agent: "build",
      }
    },

    tool: {
      get_goal: tool({
        description: "Get workspace goal state",
        args: {},
        async execute() {
          return formatGoalStatus(await getState())
        },
      }),
      update_goal: tool({
        description: "Mark goal completed or blocked",
        args: {
          status: tool.schema.enum(["completed", "blocked"]),
          summary: tool.schema.string(),
        },
        async execute(args) {
          const state = await getState()
          if (!state) return "No goal exists."
          state.status = args.status === "completed" ? "complete" : "blocked"
          state.last.reason = args.summary
          await saveGoalState(stateDir, state)
          return formatGoalStatus(state)
        },
      }),
    },

    async "command.execute.before"(input, output) {
      if (input.command !== "goal") return
      const parsed = parseCommand(input.arguments)
      const sessionID = input.sessionID
      let prompt = ""

      if (parsed.kind === "help") {
        suppressNextIdle.add(sessionID)
        prompt = helpText(parsed.reason)
      } else if (parsed.kind === "status") {
        suppressNextIdle.add(sessionID)
        prompt = formatGoalStatus(await getState())
      } else if (parsed.kind === "pause") {
        suppressNextIdle.add(sessionID)
        const state = await getState()
        if (state?.status === "active") {
          state.status = "paused"
          await saveGoalState(stateDir, state)
        }
        prompt = formatGoalStatus(await getState())
      } else if (parsed.kind === "resume") {
        const state = await getState()
        if (state && ["paused", "blocked"].includes(state.status)) {
          state.status = "active"
          await saveGoalState(stateDir, state)
        }
        prompt = formatGoalStatus(await getState())
      } else if (parsed.kind === "clear") {
        suppressNextIdle.add(sessionID)
        await clearGoalState(stateDir)
        prompt = formatGoalStatus(null)
      } else if (parsed.kind === "create") {
        const state = createGoalState({
          cwd: root,
          objective: parsed.objective,
          verifyCommand: parsed.verifyCommand,
          maxTurns: parsed.maxTurns,
          stateDir,
        })
        await saveGoalState(stateDir, state)
        prompt = `${formatGoalStatus(state)}\n\nStart working. End with GOAL_STATUS and GOAL_REASON.`
      }

      output.parts.splice(0, output.parts.length, textPart(prompt) as never)
    },

    async "experimental.chat.system.transform"(_input, output) {
      const state = await getState()
      if (!state || state.status !== "active") return
      output.system.push(`Active goal:\n${formatGoalStatus(state)}`)
    },

    async "experimental.session.compacting"(_input, output) {
      const state = await getState()
      if (!state || state.status !== "active") return
      output.context.push(`Preserve goal:\n${formatGoalStatus(state)}`)
    },

    async event({ event }) {
      const e = event as { type?: string; properties?: Record<string, unknown> }
      const props = e.properties ?? {}
      const sessionID =
        (props.sessionID as string) ??
        (props.info as { sessionID?: string } | undefined)?.sessionID ??
        (props.part as { sessionID?: string } | undefined)?.sessionID
      if (!sessionID) return

      if (e.type === "message.updated" && (props.info as { role?: string })?.role === "assistant") {
        const info = props.info as { text?: string; content?: string }
        const text = info.text ?? info.content ?? ""
        if (text) sessionAssistantText.set(sessionID, text)
        sessionToolCalls.set(sessionID, 0)
      }
      if (e.type === "message.part.updated" && (props.part as { type?: string })?.type === "tool") {
        sessionToolCalls.set(sessionID, (sessionToolCalls.get(sessionID) ?? 0) + 1)
      }
      if (
        (e.type === "session.status" && (props.status as { type?: string })?.type === "idle") ||
        e.type === "session.idle"
      ) {
        await runPostTurnCheckpoint(sessionID)
        await queueContinuation(sessionID)
      }
    },
  }
}

export default { id: "opencode-goal", server: GoalPlugin }
