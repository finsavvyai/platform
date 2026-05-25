/**
 * Cloudflare Worker - OpenHands AI Engine
 * Production-ready deployment on Cloudflare Workers
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OpenHandsAdapter } from './openhands-adapter';

// Types for Cloudflare Workers environment
interface Env {
  // KV Namespace for job storage
  AI_JOBS: KVNamespace;

  // Secrets
  OPENHANDS_API_KEY: string;
  OPENHANDS_API_URL: string;

  // Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

// Job storage interface
interface Job {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: ['https://mcpoverflow.com', 'https://app.mcpoverflow.io', 'https://mcpoverflow.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Logging middleware
app.use('/*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`);
});

// Health check
app.get('/health', async (c) => {
  try {
    const adapter = new OpenHandsAdapter({
      apiUrl: c.env.OPENHANDS_API_URL,
      apiKey: c.env.OPENHANDS_API_KEY,
    });

    const health = await adapter.healthCheck();

    return c.json({
      status: health.healthy ? 'healthy' : 'unhealthy',
      service: 'mcpoverflow-ai-engine',
      environment: c.env.ENVIRONMENT,
      openhands: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

// Analyze API specification
app.post('/api/analyze', async (c) => {
  try {
    const { specType, spec } = await c.req.json();

    if (!specType || !spec) {
      return c.json({ error: 'Missing specType or spec' }, 400);
    }

    const adapter = new OpenHandsAdapter({
      apiUrl: c.env.OPENHANDS_API_URL,
      apiKey: c.env.OPENHANDS_API_KEY,
    });

    const apiSpec = {
      type: specType,
      content: spec,
    };

    const analysis = await adapter.analyzeAPI(apiSpec);
    return c.json(analysis);
  } catch (error) {
    console.error('API analysis error:', error);
    return c.json({
      error: 'Failed to analyze API',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Generate MCP connector
app.post('/api/generate-connector', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      specType,
      spec,
      language,
      runtime,
      authConfig,
      selectedEndpoints,
      customizations,
    } = body;

    if (!name || !specType || !spec || !language || !runtime) {
      return c.json({
        error: 'Missing required fields: name, specType, spec, language, runtime',
      }, 400);
    }

    // Create job
    const jobId = crypto.randomUUID();
    const job: Job = {
      id: jobId,
      type: 'connector_generation',
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store job in KV
    await c.env.AI_JOBS.put(jobId, JSON.stringify(job), {
      expirationTtl: 86400, // 24 hours
    });

    // Process in background using Durable Objects or Queue
    // For now, we'll process synchronously with timeout
    c.executionCtx.waitUntil(
      processConnectorGeneration(c.env, jobId, body)
    );

    return c.json({
      jobId,
      status: 'pending',
      message: 'Connector generation started',
      estimatedMs: 120000,
    }, 202);
  } catch (error) {
    console.error('Connector generation error:', error);
    return c.json({
      error: 'Failed to generate connector',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Generate tests
app.post('/api/generate-tests', async (c) => {
  try {
    const { connector, spec } = await c.req.json();

    if (!connector || !spec) {
      return c.json({ error: 'Missing connector or spec' }, 400);
    }

    const adapter = new OpenHandsAdapter({
      apiUrl: c.env.OPENHANDS_API_URL,
      apiKey: c.env.OPENHANDS_API_KEY,
    });

    const apiSpec = {
      type: spec.type,
      content: spec.content,
    };

    const tests = await adapter.generateTests(connector, apiSpec);
    return c.json(tests);
  } catch (error) {
    console.error('Test generation error:', error);
    return c.json({
      error: 'Failed to generate tests',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Validate connector
app.post('/api/validate-connector', async (c) => {
  try {
    const { connector, tests } = await c.req.json();

    if (!connector || !tests) {
      return c.json({ error: 'Missing connector or tests' }, 400);
    }

    const adapter = new OpenHandsAdapter({
      apiUrl: c.env.OPENHANDS_API_URL,
      apiKey: c.env.OPENHANDS_API_KEY,
    });

    const validation = await adapter.validateConnector(connector, tests);
    return c.json(validation);
  } catch (error) {
    console.error('Connector validation error:', error);
    return c.json({
      error: 'Failed to validate connector',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Fix connector
app.post('/api/fix-connector', async (c) => {
  try {
    const { connector, error: connectorError } = await c.req.json();

    if (!connector || !connectorError) {
      return c.json({ error: 'Missing connector or error' }, 400);
    }

    const adapter = new OpenHandsAdapter({
      apiUrl: c.env.OPENHANDS_API_URL,
      apiKey: c.env.OPENHANDS_API_KEY,
    });

    const fix = await adapter.fixConnector(connector, connectorError);
    return c.json(fix);
  } catch (error) {
    console.error('Connector fix error:', error);
    return c.json({
      error: 'Failed to fix connector',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Generate documentation
app.post('/api/generate-documentation', async (c) => {
  try {
    const { connector, spec } = await c.req.json();

    if (!connector || !spec) {
      return c.json({ error: 'Missing connector or spec' }, 400);
    }

    const adapter = new OpenHandsAdapter({
      apiUrl: c.env.OPENHANDS_API_URL,
      apiKey: c.env.OPENHANDS_API_KEY,
    });

    const apiSpec = {
      type: spec.type,
      content: spec.content,
    };

    const documentation = await adapter.generateDocumentation(connector, apiSpec);
    return c.json(documentation);
  } catch (error) {
    console.error('Documentation generation error:', error);
    return c.json({
      error: 'Failed to generate documentation',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Generate from natural language description
app.post('/api/generate-from-description', async (c) => {
  try {
    const { description } = await c.req.json();

    if (!description) {
      return c.json({ error: 'Missing description' }, 400);
    }

    // Create job
    const jobId = crypto.randomUUID();
    const job: Job = {
      id: jobId,
      type: 'nl_generation',
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store job in KV
    await c.env.AI_JOBS.put(jobId, JSON.stringify(job), {
      expirationTtl: 86400, // 24 hours
    });

    // Process in background
    c.executionCtx.waitUntil(
      processNLGeneration(c.env, jobId, description)
    );

    return c.json({
      jobId,
      status: 'pending',
      message: 'Natural language generation started',
      estimatedMs: 180000,
    }, 202);
  } catch (error) {
    console.error('NL generation error:', error);
    return c.json({
      error: 'Failed to generate from description',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get job status
app.get('/api/jobs/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');

    const jobData = await c.env.AI_JOBS.get(jobId);
    if (!jobData) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const job = JSON.parse(jobData);
    return c.json(job);
  } catch (error) {
    console.error('Job status error:', error);
    return c.json({
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Background job processor for connector generation
async function processConnectorGeneration(env: Env, jobId: string, body: any) {
  try {
    // Update job status
    const job: Job = {
      id: jobId,
      type: 'connector_generation',
      status: 'processing',
      progress: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.AI_JOBS.put(jobId, JSON.stringify(job));

    const adapter = new OpenHandsAdapter({
      apiUrl: env.OPENHANDS_API_URL,
      apiKey: env.OPENHANDS_API_KEY,
    });

    const apiSpec = {
      type: body.specType,
      content: body.spec,
    };

    const connector = await adapter.generateConnector(apiSpec, {
      name: body.name,
      language: body.language,
      runtime: body.runtime,
      authConfig: body.authConfig,
      selectedEndpoints: body.selectedEndpoints,
      customizations: body.customizations,
    });

    // Update job with result
    job.status = 'completed';
    job.progress = 100;
    job.result = connector;
    job.updatedAt = new Date().toISOString();
    await env.AI_JOBS.put(jobId, JSON.stringify(job));

  } catch (error) {
    const job: Job = {
      id: jobId,
      type: 'connector_generation',
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.AI_JOBS.put(jobId, JSON.stringify(job));
  }
}

// Background job processor for NL generation
async function processNLGeneration(env: Env, jobId: string, description: string) {
  try {
    // Update job status
    const job: Job = {
      id: jobId,
      type: 'nl_generation',
      status: 'processing',
      progress: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.AI_JOBS.put(jobId, JSON.stringify(job));

    const adapter = new OpenHandsAdapter({
      apiUrl: env.OPENHANDS_API_URL,
      apiKey: env.OPENHANDS_API_KEY,
    });

    const result = await adapter.generateFromDescription(description);

    // Update job with result
    job.status = 'completed';
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date().toISOString();
    await env.AI_JOBS.put(jobId, JSON.stringify(job));

  } catch (error) {
    const job: Job = {
      id: jobId,
      type: 'nl_generation',
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.AI_JOBS.put(jobId, JSON.stringify(job));
  }
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};
