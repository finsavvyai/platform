import type { ClawClient } from '@opensyber/claw-sdk'
import type { SubTask, SubTaskResult } from './types.js'

const WORKER_SYSTEM_PROMPT = [
  'You are a focused worker agent. Execute the given subtask thoroughly.',
  'Return only the result — no preamble, no meta-commentary.',
  'If the task requires code, return the code. If analysis, return findings.',
].join(' ')

/**
 * Worker agent — executes a single subtask using the Claw Gateway.
 * Each worker has an ID and a set of declared skills.
 */
export class Worker {
  readonly id: string
  private readonly skills: string[]
  private readonly claw: ClawClient

  constructor(id: string, skills: string[], clawClient: ClawClient) {
    this.id = id
    this.skills = skills
    this.claw = clawClient
  }

  /**
   * Execute a subtask and return the result.
   * @param subtask - The subtask to execute
   * @param timeoutMs - Maximum execution time (default 60s)
   * @returns SubTaskResult with output or error
   */
  async execute(
    subtask: SubTask,
    timeoutMs = 60_000
  ): Promise<SubTaskResult> {
    const start = Date.now()

    try {
      const output = await this.executeWithTimeout(subtask, timeoutMs)
      return {
        subtaskId: subtask.id,
        workerId: this.id,
        output,
        success: true,
        durationMs: Date.now() - start,
      }
    } catch (error) {
      return {
        subtaskId: subtask.id,
        workerId: this.id,
        output: error instanceof Error ? error.message : String(error),
        success: false,
        durationMs: Date.now() - start,
      }
    }
  }

  /** Check if this worker declares a specific skill */
  hasSkill(skill: string): boolean {
    return this.skills.includes(skill)
  }

  /** Get all declared skills */
  getSkills(): readonly string[] {
    return this.skills
  }

  /**
   * Execute the subtask with a timeout guard.
   * @param subtask - Subtask to execute
   * @param timeoutMs - Timeout in milliseconds
   * @returns LLM response text
   */
  private async executeWithTimeout(
    subtask: SubTask,
    timeoutMs: number
  ): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const prompt = this.buildPrompt(subtask)
      const response = await this.claw.ask(prompt, {
        system: WORKER_SYSTEM_PROMPT,
        maxTokens: 4096,
      })
      return response
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Build the prompt for the LLM from the subtask.
   * Includes skill context if the worker has relevant skills.
   */
  private buildPrompt(subtask: SubTask): string {
    const parts = [`Execute this subtask:\n${subtask.description}`]

    if (this.skills.length > 0) {
      parts.push(`\nYour available skills: ${this.skills.join(', ')}`)
      parts.push('Use relevant skills to complete the task.')
    }

    return parts.join('\n')
  }
}

/**
 * Create a pool of workers with the given configuration.
 * @param count - Number of workers to create
 * @param clawClient - Shared Claw Gateway client
 * @param skillSets - Optional per-worker skill arrays
 * @returns Array of Worker instances
 */
export function createWorkerPool(
  count: number,
  clawClient: ClawClient,
  skillSets?: string[][]
): Worker[] {
  const workers: Worker[] = []

  for (let i = 0; i < count; i++) {
    const id = `worker_${i}`
    const skills = skillSets?.[i] ?? []
    workers.push(new Worker(id, skills, clawClient))
  }

  return workers
}
