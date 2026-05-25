import { ClawClient } from '@opensyber/claw-sdk'
import { Queen } from './queen.js'
import { createWorkerPool, type Worker } from './worker.js'
import type {
  ConsensusMode,
  SubTaskResult,
  SwarmConfig,
  SwarmEvent,
  SwarmResult,
  SwarmTask,
} from './types.js'

/** Callback for swarm lifecycle events */
export type SwarmEventHandler = (event: SwarmEvent) => void

/**
 * Swarm orchestrator — manages queen + workers for the full lifecycle:
 * decompose -> dispatch -> execute -> aggregate.
 */
export class Swarm {
  private readonly config: SwarmConfig
  private readonly claw: ClawClient
  private onEvent?: SwarmEventHandler

  constructor(config: SwarmConfig, clawEndpoint: string, clawApiKey: string) {
    this.config = config
    this.claw = new ClawClient({
      projectId: 'opensyber-swarm',
      apiKey: clawApiKey,
      endpoint: clawEndpoint,
    })
  }

  /** Subscribe to swarm lifecycle events */
  on(handler: SwarmEventHandler): void {
    this.onEvent = handler
  }

  /**
   * Run the full swarm lifecycle for a task.
   * @param task - Natural language task description
   * @returns Final aggregated result
   */
  async run(task: string): Promise<SwarmResult> {
    const start = Date.now()
    const queen = new Queen(this.config.queenType, this.claw)

    // Phase 1: Decompose
    const subtasks = await queen.decompose(task)
    const swarmTask = queen.createSwarmTask(task, subtasks)
    swarmTask.status = 'executing'
    this.emit({ type: 'task_decomposed', subtaskCount: subtasks.length })

    // Phase 2: Create workers and dispatch
    const workers = createWorkerPool(
      this.config.workerCount,
      this.claw,
      this.config.workerSkills
    )
    queen.dispatch(subtasks, workers.map((w) => w.id))

    // Phase 3: Execute subtasks in parallel
    const results = await this.executeAll(swarmTask, workers)

    // Phase 4: Aggregate
    swarmTask.status = 'aggregating'
    this.emit({ type: 'aggregation_started' })

    const resolved = this.resolveConsensus(results)
    const aggregated = await queen.aggregate(task, resolved)

    // Finalize
    swarmTask.status = 'done'
    swarmTask.result = aggregated
    swarmTask.completedAt = Date.now()

    const status = this.computeStatus(results)
    this.emit({ type: 'swarm_completed', status })

    return {
      taskId: swarmTask.id,
      description: task,
      subtaskResults: results,
      aggregatedOutput: aggregated,
      totalDurationMs: Date.now() - start,
      status,
    }
  }

  /** Execute all subtasks across workers with timeout */
  private async executeAll(
    swarmTask: SwarmTask,
    workers: Worker[]
  ): Promise<SubTaskResult[]> {
    const workerMap = new Map(workers.map((w) => [w.id, w]))
    const promises = swarmTask.subtasks.map(async (subtask) => {
      const worker = workerMap.get(subtask.assignedWorker ?? '')
      if (!worker) {
        return {
          subtaskId: subtask.id,
          workerId: 'unassigned',
          output: 'No worker assigned',
          success: false,
          durationMs: 0,
        } satisfies SubTaskResult
      }

      this.emit({ type: 'subtask_started', subtaskId: subtask.id, workerId: worker.id })
      subtask.status = 'running'

      const result = await worker.execute(subtask, this.config.timeout)
      subtask.status = result.success ? 'done' : 'failed'
      subtask.result = result.output

      this.emit({ type: 'subtask_completed', subtaskId: subtask.id, success: result.success })
      return result
    })

    return Promise.all(promises)
  }

  /** Apply consensus mode to filter/select results */
  private resolveConsensus(results: SubTaskResult[]): SubTaskResult[] {
    const succeeded = results.filter((r) => r.success)
    const mode: ConsensusMode = this.config.consensus

    if (mode === 'first') {
      const first = succeeded[0]
      return first ? [first] : results.slice(0, 1)
    }

    if (mode === 'best') {
      const sorted = [...succeeded].sort((a, b) => a.durationMs - b.durationMs)
      const best = sorted[0]
      return best ? [best] : results.slice(0, 1)
    }

    // majority: return all successful results
    return succeeded.length > 0 ? succeeded : results
  }

  /** Determine overall swarm status from results */
  private computeStatus(
    results: SubTaskResult[]
  ): SwarmResult['status'] {
    const total = results.length
    const successes = results.filter((r) => r.success).length

    if (successes === total) return 'success'
    if (successes > 0) return 'partial'
    return 'failed'
  }

  /** Emit an event if a handler is registered */
  private emit(event: SwarmEvent): void {
    this.onEvent?.(event)
  }
}
