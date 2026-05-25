/**
 * OpenHands Bridge Server
 * Exposes OpenHands adapter as REST API for Go backend to consume
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { OpenHandsAdapter } from './src/openhands-adapter';

// Simplified types for now
type APISpec = any;
type MCPConnector = any;
type TestSuite = any;
type Documentation = any;

const app = express();
const PORT = process.env.OPENHANDS_BRIDGE_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize OpenHands adapter
const adapter = new OpenHandsAdapter({
  apiUrl: process.env.OPENHANDS_API_URL,
  apiKey: process.env.OPENHANDS_API_KEY,
  llm: (process.env.OPENHANDS_LLM as any) || 'gpt-4',
  runtime: (process.env.OPENHANDS_RUNTIME as any) || 'docker',
});

// Simple in-memory job queue
interface Job {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  type: 'connector' | 'tests' | 'documentation';
  request: any;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

const jobs = new Map<string, Job>();

function createJob(type: Job['type'], request: any): string {
  const id = crypto.randomUUID();
  jobs.set(id, {
    id,
    status: 'queued',
    type,
    request,
    createdAt: new Date(),
  });
  return id;
}

async function processJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';

  try {
    let result;
    const { type, request } = job;

    if (type === 'connector') {
      const apiSpec: APISpec = {
        type: request.specType,
        content: request.spec,
      };
      result = await adapter.generateConnector(apiSpec, {
        name: request.name,
        language: request.language,
        runtime: request.runtime,
        authConfig: request.authConfig,
        selectedEndpoints: request.selectedEndpoints,
        customizations: request.customizations,
      });
    } else if (type === 'tests') {
      const apiSpec: APISpec = {
        type: request.spec.type,
        content: request.spec.content,
      };
      result = await adapter.generateTests(request.connector, apiSpec);
    } else if (type === 'documentation') {
      const apiSpec: APISpec = {
        type: request.spec.type,
        content: request.spec.content,
      };
      result = await adapter.generateDocumentation(request.connector, apiSpec);
    }

    job.result = result;
    job.status = 'completed';
    job.completedAt = new Date();
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.completedAt = new Date();
  }
}

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await adapter.healthCheck();
    res.json({
      status: health.healthy ? 'healthy' : 'unhealthy',
      service: 'openhands-bridge',
      openhands: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Analyze API specification
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { specType, spec } = req.body;

    if (!specType || !spec) {
      return res.status(400).json({ error: 'Missing specType or spec' });
    }

    const apiSpec: APISpec = {
      type: specType,
      content: spec,
    };

    const analysis = await adapter.analyzeAPI(apiSpec);
    res.json(analysis);
  } catch (error) {
    console.error('API analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze API',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate MCP connector
app.post('/api/generate-connector', async (req: Request, res: Response) => {
  try {
    const {
      name,
      specType,
      spec,
      language,
      runtime,
      authConfig,
      selectedEndpoints,
      customizations,
    } = req.body;

    if (!name || !specType || !spec || !language || !runtime) {
      return res.status(400).json({
        error: 'Missing required fields: name, specType, spec, language, runtime',
      });
    }

    const apiSpec: APISpec = {
      type: specType,
      content: spec,
    };

    const connector = await adapter.generateConnector(apiSpec, {
      name,
      language,
      runtime,
      authConfig,
      selectedEndpoints,
      customizations,
    });

    res.json(connector);
  } catch (error) {
    console.error('Connector generation error:', error);
    res.status(500).json({
      error: 'Failed to generate connector',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate tests
app.post('/api/generate-tests', async (req: Request, res: Response) => {
  try {
    const { connector, spec } = req.body;

    if (!connector || !spec) {
      return res.status(400).json({ error: 'Missing connector or spec' });
    }

    const apiSpec: APISpec = {
      type: spec.type,
      content: spec.content,
    };

    const tests = await adapter.generateTests(connector as MCPConnector, apiSpec);
    res.json(tests);
  } catch (error) {
    console.error('Test generation error:', error);
    res.status(500).json({
      error: 'Failed to generate tests',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Validate connector
app.post('/api/validate-connector', async (req: Request, res: Response) => {
  try {
    const { connector, tests } = req.body;

    if (!connector || !tests) {
      return res.status(400).json({ error: 'Missing connector or tests' });
    }

    const validation = await adapter.validateConnector(
      connector as MCPConnector,
      tests as TestSuite
    );

    res.json(validation);
  } catch (error) {
    console.error('Connector validation error:', error);
    res.status(500).json({
      error: 'Failed to validate connector',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Fix connector
app.post('/api/fix-connector', async (req: Request, res: Response) => {
  try {
    const { connector, error: connectorError } = req.body;

    if (!connector || !connectorError) {
      return res.status(400).json({ error: 'Missing connector or error' });
    }

    const fix = await adapter.fixConnector(connector as MCPConnector, connectorError);
    res.json(fix);
  } catch (error) {
    console.error('Connector fix error:', error);
    res.status(500).json({
      error: 'Failed to fix connector',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate documentation
app.post('/api/generate-documentation', async (req: Request, res: Response) => {
  try {
    const { connector, spec } = req.body;

    if (!connector || !spec) {
      return res.status(400).json({ error: 'Missing connector or spec' });
    }

    const apiSpec: APISpec = {
      type: spec.type,
      content: spec.content,
    };

    const documentation = await adapter.generateDocumentation(
      connector as MCPConnector,
      apiSpec
    );

    res.json(documentation);
  } catch (error) {
    console.error('Documentation generation error:', error);
    res.status(500).json({
      error: 'Failed to generate documentation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate from natural language description
app.post('/api/generate-from-description', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Missing description' });
    }

    const result = await adapter.generateFromDescription(description);
    res.json(result);
  } catch (error) {
    console.error('NL generation error:', error);
    res.status(500).json({
      error: 'Failed to generate from description',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
// Async job endpoints
app.post('/api/jobs/generate-connector', async (req: Request, res: Response) => {
  try {
    const jobId = createJob('connector', req.body);

    // Process job asynchronously
    processJob(jobId).catch(err => console.error(`Job ${jobId} failed:`, err));

    res.json({
      jobId,
      status: 'queued',
      statusUrl: `/api/jobs/${jobId}`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to queue job',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/jobs/generate-tests', async (req: Request, res: Response) => {
  try {
    const jobId = createJob('tests', req.body);
    processJob(jobId).catch(err => console.error(`Job ${jobId} failed:`, err));

    res.json({
      jobId,
      status: 'queued',
      statusUrl: `/api/jobs/${jobId}`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to queue job',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Job status endpoint
app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const response: any = {
    id: job.id,
    status: job.status,
    type: job.type,
    createdAt: job.createdAt,
  };

  if (job.completedAt) {
    response.completedAt = job.completedAt;
    response.duration = job.completedAt.getTime() - job.createdAt.getTime();
  }

  if (job.status === 'completed') {
    response.result = job.result;
  } else if (job.status === 'failed') {
    response.error = job.error;
  }

  res.json(response);
});

// List all jobs
app.get('/api/jobs', (req: Request, res: Response) => {
  const allJobs = Array.from(jobs.values()).map(job => ({
    id: job.id,
    status: job.status,
    type: job.type,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  }));

  res.json({ jobs: allJobs, total: allJobs.length });
});

app.listen(PORT, () => {
  console.log(`OpenHands Bridge Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
