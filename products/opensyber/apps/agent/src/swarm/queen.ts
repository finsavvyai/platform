import type { ClawClient } from '@opensyber/claw-sdk'
import type {
  QueenType,
  SubTask,
  SubTaskResult,
  SwarmTask,
} from './types.js'

/** System prompts per queen type */
const QUEEN_SYSTEM_PROMPTS: Record<QueenType, string> = {
  strategic: [
    'You are a strategic coordinator. Decompose tasks into independent,',
    'high-level subtasks that can be executed in parallel.',
    'Focus on clear separation of concerns and minimal dependencies.',
  ].join(' '),
  tactical: [
    'You are a tactical coordinator. Break tasks into precise, ordered',
    'steps with explicit inputs and outputs for each step.',
    'Optimize for correctness and completeness.',
  ].join(' '),
  adaptive: [
    'You are an adaptive coordinator. Analyze the task complexity and',
    'choose the best decomposition strategy dynamically.',
    'Balance parallelism with dependency management.',
  ].join(' '),
}

/** Generates a unique ID with a prefix */
function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${rand}`
}

/**
 * Queen agent — decomposes tasks, dispatches to workers, aggregates results.
 * Uses the Claw Gateway for all LLM reasoning.
 */
export class Queen {
  private readonly type: QueenType
  private readonly claw: ClawClient

  constructor(type: QueenType, clawClient: ClawClient) {
    this.type = type
    this.claw = clawClient
  }

  /**
   * Decompose a high-level task into executable subtasks.
   * @param task - Natural language description of the task
   * @returns Array of subtasks ready for worker dispatch
   */
  async decompose(task: string): Promise<SubTask[]> {
    const taskId = makeId('task')
    const prompt = [
      `Decompose this task into subtasks. Return ONLY a JSON array of objects`,
      `with "description" (string) fields. No markdown, no explanation.`,
      `\nTask: ${task}`,
    ].join(' ')

    const response = await this.claw.ask(prompt, {
      system: QUEEN_SYSTEM_PROMPTS[this.type],
      maxTokens: 2048,
    })

    return this.parseSubtasks(response, taskId)
  }

  /**
   * Dispatch subtasks to available workers using round-robin assignment.
   * Mutates subtask assignedWorker fields in place.
   * @param subtasks - Subtasks to assign
   * @param workerIds - Available worker IDs
   */
  dispatch(subtasks: SubTask[], workerIds: string[]): void {
    if (workerIds.length === 0) {
      throw new Error('No workers available for dispatch')
    }
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i]
      if (subtask) subtask.assignedWorker = workerIds[i % workerIds.length]
    }
  }

  /**
   * Aggregate worker results into a final coherent output.
   * @param task - Original task description
   * @param results - Results from all workers
   * @returns Combined output string
   */
  async aggregate(
    task: string,
    results: SubTaskResult[]
  ): Promise<string> {
    const succeeded = results.filter((r) => r.success)
    if (succeeded.length === 0) {
      return 'All subtasks failed. No results to aggregate.'
    }

    const resultSummary = succeeded
      .map((r, i) => `[Subtask ${i + 1}]: ${r.output}`)
      .join('\n')

    const prompt = [
      `You received results from parallel subtasks for this goal:`,
      `"${task}"`,
      `\nSubtask results:\n${resultSummary}`,
      `\nSynthesize these into a single coherent response.`,
      `Be concise and actionable.`,
    ].join('\n')

    return this.claw.ask(prompt, {
      system: 'You are a results aggregator. Combine subtask outputs concisely.',
      maxTokens: 4096,
    })
  }

  /**
   * Create a SwarmTask record for tracking.
   * @param description - Task description
   * @param subtasks - Decomposed subtasks
   */
  createSwarmTask(description: string, subtasks: SubTask[]): SwarmTask {
    return {
      id: makeId('swarm'),
      description,
      subtasks,
      status: 'planning',
      startedAt: Date.now(),
    }
  }

  /** Parse LLM output into SubTask array */
  private parseSubtasks(raw: string, taskId: string): SubTask[] {
    const cleaned = raw
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error(`Queen failed to parse subtask JSON: ${cleaned.slice(0, 200)}`)
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Queen decomposition did not return an array')
    }

    return parsed.map((item: { description?: string }, index: number) => ({
      id: `${taskId}_sub_${index}`,
      parentTaskId: taskId,
      description: item.description ?? String(item),
      status: 'pending' as const,
    }))
  }
}
