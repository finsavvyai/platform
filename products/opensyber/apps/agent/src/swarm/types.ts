/** Queen coordination strategy */
export type QueenType = 'strategic' | 'tactical' | 'adaptive'

/** How to resolve multiple worker results */
export type ConsensusMode = 'first' | 'majority' | 'best'

/** Lifecycle status of a swarm task */
export type SwarmTaskStatus =
  | 'planning'
  | 'executing'
  | 'aggregating'
  | 'done'
  | 'failed'

/** Lifecycle status of a single subtask */
export type SubTaskStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'

/** A top-level task decomposed by the queen */
export interface SwarmTask {
  id: string
  description: string
  subtasks: SubTask[]
  status: SwarmTaskStatus
  result?: string
  startedAt: number
  completedAt?: number
}

/** A unit of work assigned to a worker */
export interface SubTask {
  id: string
  parentTaskId: string
  description: string
  assignedWorker?: string
  status: SubTaskStatus
  result?: string
  error?: string
}

/** Result returned by a worker for a subtask */
export interface SubTaskResult {
  subtaskId: string
  workerId: string
  output: string
  success: boolean
  durationMs: number
}

/** Configuration for a swarm run */
export interface SwarmConfig {
  queenType: QueenType
  workerCount: number
  consensus: ConsensusMode
  /** Timeout per subtask in milliseconds */
  timeout: number
  /** Worker skill sets — one string[] per worker slot */
  workerSkills?: string[][]
}

/** Final result from a swarm run */
export interface SwarmResult {
  taskId: string
  description: string
  subtaskResults: SubTaskResult[]
  aggregatedOutput: string
  totalDurationMs: number
  status: 'success' | 'partial' | 'failed'
}

/** Events emitted during swarm execution */
export type SwarmEvent =
  | { type: 'task_decomposed'; subtaskCount: number }
  | { type: 'subtask_started'; subtaskId: string; workerId: string }
  | { type: 'subtask_completed'; subtaskId: string; success: boolean }
  | { type: 'aggregation_started' }
  | { type: 'swarm_completed'; status: SwarmResult['status'] }
