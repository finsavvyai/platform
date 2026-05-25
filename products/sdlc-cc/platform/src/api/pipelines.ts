// API: CRUD pipelines, trigger
import { Router, Request, Response } from 'express';
import { PipelineExecutionError, PipelineService, Stage } from '../services/pipeline';

const router = Router();
const pipelineService = new PipelineService();

interface CreatePipelineRequest {
  name: string;
  stages: Stage[];
}

function isStage(value: unknown): value is Stage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Stage>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.command === 'string';
}

function isStageArray(value: unknown): value is Stage[] {
  return Array.isArray(value) && value.every((stage) => isStage(stage));
}

router.get('/pipelines', (_req: Request, res: Response) => {
  res.json(pipelineService.listPipelines());
});

// Create pipeline
router.post('/pipelines', (req: Request, res: Response) => {
  try {
    const { name, stages } = req.body as CreatePipelineRequest;

    if (typeof name !== 'string' || !name.trim() || !isStageArray(stages)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const pipeline = pipelineService.createPipeline(name, stages);
    res.status(201).json(pipeline);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get pipeline
router.get('/pipelines/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pipeline = pipelineService.getPipeline(id);

    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    res.json(pipeline);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Update pipeline
router.put('/pipelines/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pipeline = pipelineService.updatePipeline(id, req.body);

    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    res.json(pipeline);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Delete pipeline
router.delete('/pipelines/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = pipelineService.deletePipeline(id);

    if (!deleted) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Execute pipeline
router.post('/pipelines/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const execution = await pipelineService.executePipeline(id);
    res.status(202).json(execution);
  } catch (error) {
    if (error instanceof PipelineExecutionError) {
      res.status(422).json({
        error: error.message,
        execution: error.execution,
      });
      return;
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get execution
router.get('/executions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const execution = pipelineService.getExecution(id);

    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    res.json(execution);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// List executions for pipeline
router.get('/pipelines/:id/executions', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const executions = pipelineService.listExecutions(id);
    res.json(executions);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
export { pipelineService };
