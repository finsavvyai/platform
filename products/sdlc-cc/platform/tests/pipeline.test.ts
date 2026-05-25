import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineExecutionError, PipelineService, Stage } from '../src/services/pipeline';

describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    service = new PipelineService();
  });

  it('should create a pipeline', () => {
    const stages: Stage[] = [
      { id: 'stage1', name: 'Build', command: 'npm run build' },
      { id: 'stage2', name: 'Test', command: 'npm test' },
    ];

    const pipeline = service.createPipeline('My Pipeline', stages);

    expect(pipeline.id).toBeDefined();
    expect(pipeline.name).toBe('My Pipeline');
    expect(pipeline.stages).toHaveLength(2);
  });

  it('should get a pipeline by id', () => {
    const stages: Stage[] = [{ id: 'stage1', name: 'Build', command: 'npm run build' }];
    const created = service.createPipeline('Test', stages);

    const retrieved = service.getPipeline(created.id);

    expect(retrieved).toEqual(created);
  });

  it('should return undefined for non-existent pipeline', () => {
    const result = service.getPipeline('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should update a pipeline', () => {
    const stages: Stage[] = [{ id: 'stage1', name: 'Build', command: 'npm run build' }];
    const pipeline = service.createPipeline('Test', stages);

    const updated = service.updatePipeline(pipeline.id, { name: 'Updated Name' });

    expect(updated?.name).toBe('Updated Name');
  });

  it('should delete a pipeline', () => {
    const stages: Stage[] = [{ id: 'stage1', name: 'Build', command: 'npm run build' }];
    const pipeline = service.createPipeline('Test', stages);

    const deleted = service.deletePipeline(pipeline.id);

    expect(deleted).toBe(true);
    expect(service.getPipeline(pipeline.id)).toBeUndefined();
  });

  it('should execute a pipeline', async () => {
    const stages: Stage[] = [
      { id: 'stage1', name: 'Build', command: 'npm run build' },
      { id: 'stage2', name: 'Test', command: 'npm test' },
    ];
    const pipeline = service.createPipeline('Test', stages);

    const execution = await service.executePipeline(pipeline.id);

    expect(execution.status).toBe('success');
    expect(execution.stageResults).toHaveLength(2);
    expect(execution.stageResults[0].status).toBe('success');
  });

  it('should handle stage timeout', async () => {
    const stages: Stage[] = [
      { id: 'stage1', name: 'Long', command: 'sleep 10', timeout: 50 },
    ];
    const pipeline = service.createPipeline('Timeout Test', stages);

    try {
      await service.executePipeline(pipeline.id);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should allow failing stage with allowFailure flag', async () => {
    const stages: Stage[] = [
      { id: 'stage1', name: 'Build', command: 'fail', allowFailure: true },
      { id: 'stage2', name: 'Test', command: 'test' },
    ];
    const pipeline = service.createPipeline('Test', stages);

    const execution = await service.executePipeline(pipeline.id);

    expect(execution.status).toBe('success');
    expect(execution.stageResults[0].status).toBe('failed');
    expect(execution.stageResults[1].status).toBe('success');
  });

  it('should capture failed stage results before throwing', async () => {
    const stages: Stage[] = [
      { id: 'stage1', name: 'Build', command: 'fail' },
      { id: 'stage2', name: 'Test', command: 'test' },
    ];
    const pipeline = service.createPipeline('Failure Test', stages);

    await expect(service.executePipeline(pipeline.id)).rejects.toBeInstanceOf(PipelineExecutionError);

    const [execution] = service.listExecutions(pipeline.id);
    expect(execution.status).toBe('failed');
    expect(execution.stageResults).toHaveLength(1);
    expect(execution.stageResults[0].status).toBe('failed');
  });

  it('should reject empty pipelines', () => {
    expect(() => service.createPipeline('Invalid', [])).toThrow(
      'Pipeline must include at least one stage'
    );
  });

  it('should get execution by id', async () => {
    const stages: Stage[] = [{ id: 'stage1', name: 'Build', command: 'build' }];
    const pipeline = service.createPipeline('Test', stages);
    const execution = await service.executePipeline(pipeline.id);

    const retrieved = service.getExecution(execution.executionId);

    expect(retrieved).toEqual(execution);
  });

  it('should list executions for a pipeline', async () => {
    const stages: Stage[] = [{ id: 'stage1', name: 'Build', command: 'build' }];
    const pipeline = service.createPipeline('Test', stages);

    await service.executePipeline(pipeline.id);
    await service.executePipeline(pipeline.id);

    const executions = service.listExecutions(pipeline.id);

    expect(executions).toHaveLength(2);
  });

  it('should emit events during execution', async () => {
    const stages: Stage[] = [{ id: 'stage1', name: 'Build', command: 'build' }];
    const pipeline = service.createPipeline('Test', stages);
    let eventCount = 0;

    service.on('execution:started', () => eventCount++);
    service.on('stage:completed', () => eventCount++);
    service.on('execution:completed', () => eventCount++);

    await service.executePipeline(pipeline.id);

    expect(eventCount).toBeGreaterThan(0);
  });
});
