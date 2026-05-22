#!/usr/bin/env node
import {
  buildContinuationPrompt,
  checkpoint,
  clearGoalState,
  createGoalState,
  formatGoalStatus,
  loadGoalState,
  resolveGoalDir,
  saveGoalState,
} from "@nikomohr/goal-core"
import fs from "node:fs/promises"

const args = process.argv.slice(2)
const cwd = process.cwd()
const managementCommands = new Set(["status", "clear", "pause", "resume", "prompt", "checkpoint", "help"])
const optionsWithValues = new Set(["--verify", "-v", "--validate", "--max-turns", "--state-dir", "--file", "--tool-calls"])

function usage() {
  console.log(`Usage:
  goal "<objective>" [--verify CMD] [--max-turns N]
  goal status
  goal status --json
  goal --json
  goal pause | resume | clear
  goal checkpoint [--tool-calls N] [--file path]
  goal prompt
  goal <command> --state-dir .goal
`)
}

function optionValue(...names: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    for (const name of names) {
      if (value === name) return args[index + 1]
      if (value.startsWith(`${name}=`)) return value.slice(name.length + 1)
    }
  }
  return undefined
}

function positionalArgs() {
  const positional: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (!value) continue
    if (optionsWithValues.has(value)) {
      index += 1
      continue
    }
    if (value.startsWith("--")) continue
    positional.push(value)
  }
  return positional
}

function commandName() {
  const [first] = positionalArgs()
  return first && managementCommands.has(first) ? first : undefined
}

function hasFlag(name: string) {
  return args.includes(name)
}

function objectiveText() {
  return positionalArgs().join(" ").trim()
}

async function readAssistantText() {
  const file = optionValue("--file")
  if (file) {
    return fs.readFile(file, "utf8")
  }
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

async function main() {
  const stateDir = resolveGoalDir(cwd, optionValue("--state-dir"))
  const command = commandName()
  const jsonStatus = hasFlag("--json")

  if (jsonStatus && (!command || command === "status")) {
    console.log(JSON.stringify(await loadGoalState(stateDir), null, 2))
    return
  }

  if (!args.length || command === "help" || args.includes("--help")) {
    usage()
    return
  }

  if (command === "status") {
    const state = await loadGoalState(stateDir)
    console.log(formatGoalStatus(state))
    return
  }

  if (command === "clear") {
    await clearGoalState(stateDir)
    console.log("Goal cleared.")
    return
  }

  if (command === "pause" || command === "resume") {
    const state = await loadGoalState(stateDir)
    if (!state) {
      console.log("No goal to update.")
      return
    }
    if (command === "pause" && state.status === "active") {
      state.status = "paused"
      await saveGoalState(stateDir, state)
      console.log("Goal paused.")
      return
    }
    if (command === "resume" && ["paused", "blocked"].includes(state.status)) {
      state.status = "active"
      await saveGoalState(stateDir, state)
      console.log("Goal resumed.")
      return
    }
    console.log(formatGoalStatus(state))
    return
  }

  if (command === "prompt") {
    const state = await loadGoalState(stateDir)
    if (!state || state.status !== "active") {
      console.log("No active goal.")
      return
    }
    console.log(buildContinuationPrompt(state, state.last.validation))
    return
  }

  if (command === "checkpoint") {
    const text = await readAssistantText()
    const toolCalls = Number(optionValue("--tool-calls") ?? 0)
    const result = await checkpoint({
      cwd,
      stateDir,
      assistantText: text,
      toolCalls: Number.isFinite(toolCalls) ? toolCalls : 0,
    })
    console.log(formatGoalStatus(result.state))
    if (result.continuationPrompt) {
      console.log("\n--- continuation ---\n")
      console.log(result.continuationPrompt)
    }
    return
  }

  const cleanObjective = objectiveText().replace(/^"|"$/g, "").trim()
  if (!cleanObjective) {
    usage()
    process.exit(1)
  }

  let verifyCommand: string | undefined
  let maxTurns = 8
  verifyCommand = optionValue("--verify", "-v", "--validate")
  maxTurns = Number(optionValue("--max-turns") ?? 8) || 8

  const state = createGoalState({ cwd, objective: cleanObjective, verifyCommand, maxTurns, stateDir })
  await saveGoalState(stateDir, state)
  console.log(formatGoalStatus(state))
  console.log("\n--- continuation ---\n")
  console.log(buildContinuationPrompt(state))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
