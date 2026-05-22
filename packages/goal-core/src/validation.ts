import { spawn } from "node:child_process"
import { truncateText } from "./text.js"
import type { ValidationResult } from "./types.js"

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+-(?:[^\s]*r[^\s]*f|[^\s]*f[^\s]*r)\b/, reason: "rm -rf style deletion" },
  { pattern: /\bgit\s+reset\s+--hard\b/, reason: "git reset --hard" },
  { pattern: /\bgit\s+clean\s+-[^\s]*[fd][^\s]*\b/, reason: "git clean -fd style deletion" },
]

export function assertSafeCommand(command: string, allowDestructive: boolean) {
  if (allowDestructive) return
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(
        `Refusing to run verification command (${reason}). Set allowDestructive only if intended.`,
      )
    }
  }
}

export async function runValidation(options: {
  command?: string
  cwd: string
  timeoutMs: number
  allowDestructive: boolean
}): Promise<ValidationResult> {
  if (!options.command) {
    return {
      ok: true,
      skipped: true,
      durationMs: 0,
      stdout: "",
      stderr: "",
      reason: "No verification command configured.",
    }
  }

  assertSafeCommand(options.command, options.allowDestructive)

  const started = Date.now()
  let stdout = ""
  let stderr = ""

  return await new Promise<ValidationResult>((resolve) => {
    const child = spawn(options.command!, {
      cwd: options.cwd,
      shell: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref()
    }, options.timeoutMs)

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })

    child.on("close", (exitCode, signal) => {
      clearTimeout(timer)
      resolve({
        command: options.command,
        ok: exitCode === 0,
        skipped: false,
        exitCode,
        signal,
        durationMs: Date.now() - started,
        stdout: truncateText(stdout, 24_000),
        stderr: truncateText(stderr, 24_000),
        reason: signal ? `Process exited by signal ${signal}.` : undefined,
      })
    })

    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({
        command: options.command,
        ok: false,
        skipped: false,
        durationMs: Date.now() - started,
        stdout: truncateText(stdout, 24_000),
        stderr: truncateText(stderr, 24_000),
        reason: error.message,
      })
    })
  })
}

export function verificationOk(validation: ValidationResult) {
  return validation.ok || validation.skipped
}
