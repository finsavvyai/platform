// Pipeline service: define stages, execute, status tracking
import EventEmitter from 'events';

export interface Stage {
  id: string;
  name: string;
  command: string;
  timeout?: number;
  allowFailure?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
  created: Date;
}

export interface PipelineExecution {
  pipelineId: string;
  executionId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  stageResults: StageResult[];
  startTime?: Date;
  endTime?: Date;
}

export interface StageResult {
  stageId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  output: string;
  duration: number;
  error?: string;
}

export interface PipelineServiceOptions {
  executeStage?: (stage: Stage) => Promise<string>;
}

export class PipelineExecutionError extends Error {
  readonly execution: PipelineExecution;
  readonly stageResult: StageResult;

  constructor(message: string, execution: PipelineExecution, stageResult: StageResult) {
    super(message);
    this.name = 'PipelineExecutionError';
    this.execution = execution;
    this.stageResult = stageResult;
  }
}

let pipelineCounter = 0;
let executionCounter = 0;

export class PipelineService extends EventEmitter {
  private pipelines: Map<string, Pipeline> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();
  private executeStageHandler: (stage: Stage) => Promise<string>;

  constructor(options: PipelineServiceOptions = {}) {
    super();
    this.executeStageHandler = options.executeStage ?? defaultStageExecutor;
  }

  createPipeline(name: string, stages: Stage[]): Pipeline {
    if (!name.trim()) {
      throw new Error('Pipeline name is required');
    }

    if (stages.length === 0) {
      throw new Error('Pipeline must include at least one stage');
    }

    const pipeline: Pipeline = {
      id: `pipe_${Date.now()}_${++pipelineCounter}`,
      name: name.trim(),
      stages,
      created: new Date(),
    };
    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  getPipeline(id: string): Pipeline | undefined {
    return this.pipelines.get(id);
  }

  listPipelines(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  updatePipeline(id: string, updates: Partial<Pipeline>): Pipeline | undefined {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return undefined;
    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error('Pipeline name cannot be empty');
    }
    if (updates.stages && updates.stages.length === 0) {
      throw new Error('Pipeline must include at least one stage');
    }
    const updated = { ...pipeline, ...updates };
    this.pipelines.set(id, updated);
    this.emit('pipeline:updated', updated);
    return updated;
  }

  deletePipeline(id: string): boolean {
    return this.pipelines.delete(id);
  }

  async executePipeline(pipelineId: string): Promise<PipelineExecution> {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const execution: PipelineExecution = {
      pipelineId,
      executionId: `exec_${Date.now()}_${++executionCounter}`,
      status: 'running',
      stageResults: [],
      startTime: new Date(),
    };

    this.executions.set(execution.executionId, execution);
    this.emit('execution:started', execution);

    for (const stage of pipeline.stages) {
      const stageStart = Date.now();
      const result: StageResult = {
        stageId: stage.id,
        status: 'running',
        output: '',
        duration: 0,
      };

      try {
        result.output = await this.executeStageHandler(stage);
        result.status = 'success';
      } catch (error) {
        result.status = 'failed';
        result.error = error instanceof Error ? error.message : String(error);
      }

      result.duration = Date.now() - stageStart;
      execution.stageResults.push(result);
      this.emit('stage:completed', result);

      if (result.status === 'failed' && !stage.allowFailure) {
        execution.status = 'failed';
        execution.endTime = new Date();
        this.executions.set(execution.executionId, execution);
        this.emit('execution:failed', execution);
        throw new PipelineExecutionError(
          result.error ?? `Stage ${stage.id} failed`,
          cloneExecution(execution),
          { ...result }
        );
      }
    }

    execution.status = 'success';
    execution.endTime = new Date();
    this.executions.set(execution.executionId, execution);
    this.emit('execution:completed', execution);
    return execution;
  }

  getExecution(id: string): PipelineExecution | undefined {
    return this.executions.get(id);
  }

  listExecutions(pipelineId: string): PipelineExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.pipelineId === pipelineId
    );
  }
}

function cloneExecution(execution: PipelineExecution): PipelineExecution {
  return {
    ...execution,
    stageResults: execution.stageResults.map((stageResult) => ({ ...stageResult })),
  };
}

function parseSimulatedDuration(command: string): number {
  const sleepMatch = command.match(/sleep\s+(\d+(?:\.\d+)?)/i);
  if (!sleepMatch) {
    return 100;
  }

  return Math.max(0, Math.round(Number(sleepMatch[1]) * 1000));
}

function defaultStageExecutor(stage: Stage): Promise<string> {
  if (!stage.command.trim()) {
    return Promise.reject(new Error(`Stage ${stage.id} command is required`));
  }

  return new Promise((resolve, reject) => {
    const timeout = stage.timeout ?? 30000;
    const duration = parseSimulatedDuration(stage.command);
    const shouldFail = /\bfail\b|exit\s+1|throw\b/i.test(stage.command);
    let settled = false;

    const finish = (callback: (value: string | Error) => void, value: string | Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutTimer);
      callback(value);
    };

    const timeoutTimer = setTimeout(() => {
      finish(
        (value) => reject(value as Error),
        new Error(`Stage ${stage.id} timeout after ${timeout}ms`)
      );
    }, timeout);

    setTimeout(() => {
      if (shouldFail) {
        finish(
          (value) => reject(value as Error),
          new Error(`Stage ${stage.id} failed: ${stage.command}`)
        );
        return;
      }

      finish(
        (value) => resolve(value as string),
        `Stage ${stage.name} executed: ${stage.command}`
      );
    }, duration);
  });
}
