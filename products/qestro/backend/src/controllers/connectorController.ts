import { Request, Response } from 'express';
import { MCPOverflowConnectorService } from '../services/MCPOverflowConnectorService';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { apiConnectors, connectorJobs } from '../schema/index.js';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Connector Controller
 *
 * Handles API requests for connector generation, management, and testing
 * using MCPOverflow AI Engine integration.
 *
 * @author Questro Team
 * @version 1.0.0
 */

// ========== VALIDATION SCHEMAS ==========

const generateConnectorSchema = z.object({
  name: z.string().min(1).max(100),
  specType: z.enum(['openapi', 'swagger', 'graphql', 'rest']),
  spec: z.union([z.string(), z.record(z.any())]),
  language: z.enum(['typescript', 'javascript', 'python', 'go']),
  runtime: z.enum(['cloudflare-workers', 'aws-lambda', 'vercel', 'nodejs']),
  includeTests: z.boolean().optional().default(false),
  includeDocumentation: z.boolean().optional().default(false),
  projectId: z.string().uuid().optional(),
});

const analyzeAPISchema = z.object({
  spec: z.union([z.string(), z.record(z.any())]),
});

const updateConnectorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().optional(),
  types: z.string().optional(),
  config: z.string().optional(),
  tests: z.string().optional(),
  documentation: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

// ========== CONTROLLER FUNCTIONS ==========

/**
 * POST /api/connectors/generate
 * Generate a connector synchronously
 */
export const generateConnector = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = generateConnectorSchema.parse(req.body);

    // Check user's connector limit
    const existingConnectors = await db
      .select()
      .from(apiConnectors)
      .where(eq(apiConnectors.userId, userId));

    const maxConnectors = Number(process.env.MCPOVERFLOW_MAX_CONNECTORS_PER_USER) || 50;
    if (existingConnectors.length >= maxConnectors) {
      return res.status(429).json({
        error: 'Connector limit reached',
        limit: maxConnectors,
        current: existingConnectors.length
      });
    }

    console.log(`[ConnectorController] Generating connector: ${validatedData.name} for user: ${userId}`);

    // Generate connector using MCPOverflow service
    const service = MCPOverflowConnectorService.getInstance();
    const connector = await service.generateConnector({
      name: validatedData.name,
      specType: validatedData.specType,
      spec: validatedData.spec as any,
      language: validatedData.language,
      runtime: validatedData.runtime,
      includeTests: validatedData.includeTests,
      includeDocumentation: validatedData.includeDocumentation,
    });

    // Save to database
    const [savedConnector] = await db
      .insert(apiConnectors)
      .values({
        id: connector.id,
        userId,
        projectId: validatedData.projectId,
        name: connector.name,
        language: connector.language,
        runtime: connector.runtime,
        code: connector.code,
        types: connector.types,
        config: connector.config,
        tests: connector.tests,
        documentation: connector.documentation,
        metadata: connector.metadata,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(`[ConnectorController] Connector generated and saved: ${connector.id}`);

    return res.status(201).json({
      success: true,
      connector: savedConnector,
      generationTime: connector.metadata.duration,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Generate error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    return res.status(500).json({
      error: 'Failed to generate connector',
      message: error.message
    });
  }
};

/**
 * POST /api/connectors/generate-async
 * Generate a connector asynchronously using job queue
 */
export const generateConnectorAsync = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = generateConnectorSchema.parse(req.body);

    console.log(`[ConnectorController] Creating async job for: ${validatedData.name}`);

    // Create async job
    const service = MCPOverflowConnectorService.getInstance();
    const job = await service.generateConnectorAsync({
      name: validatedData.name,
      specType: validatedData.specType,
      spec: validatedData.spec as any,
      language: validatedData.language,
      runtime: validatedData.runtime,
      includeTests: validatedData.includeTests,
      includeDocumentation: validatedData.includeDocumentation,
    });

    // Save job to database
    await db.insert(connectorJobs).values({
      id: job.jobId,
      userId,
      connectorName: validatedData.name,
      status: job.status,
      type: 'generate',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[ConnectorController] Async job created: ${job.jobId}`);

    return res.status(202).json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      statusUrl: `/api/connectors/jobs/${job.jobId}`,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Generate async error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    return res.status(500).json({
      error: 'Failed to create generation job',
      message: error.message
    });
  }
};

/**
 * POST /api/connectors/analyze
 * Analyze an API spec without generating code
 */
export const analyzeAPI = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = analyzeAPISchema.parse(req.body);

    console.log(`[ConnectorController] Analyzing API spec for user: ${userId}`);

    const service = MCPOverflowConnectorService.getInstance();
    const analysis = await service.analyzeAPI(validatedData.spec as any);

    return res.status(200).json({
      success: true,
      analysis,
      estimatedTime: MCPOverflowConnectorService.estimateGenerationTime(analysis),
    });

  } catch (error: any) {
    console.error('[ConnectorController] Analyze error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    return res.status(500).json({
      error: 'Failed to analyze API',
      message: error.message
    });
  }
};

/**
 * GET /api/connectors
 * List all connectors for the authenticated user
 */
export const listConnectors = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, status, limit = '50', offset = '0' } = req.query;

    const query = db
      .select()
      .from(apiConnectors)
      .where(eq(apiConnectors.userId, userId))
      .orderBy(desc(apiConnectors.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Apply filters
    const conditions = [eq(apiConnectors.userId, userId)];

    if (projectId) {
      conditions.push(eq(apiConnectors.projectId, projectId as string));
    }

    if (status) {
      conditions.push(eq(apiConnectors.status, status as any));
    }

    const connectors = await db
      .select()
      .from(apiConnectors)
      .where(and(...conditions))
      .orderBy(desc(apiConnectors.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const total = await db
      .select({ count: apiConnectors.id })
      .from(apiConnectors)
      .where(and(...conditions));

    return res.status(200).json({
      success: true,
      connectors,
      total: total.length,
      limit: Number(limit),
      offset: Number(offset),
    });

  } catch (error: any) {
    console.error('[ConnectorController] List error:', error);
    return res.status(500).json({
      error: 'Failed to list connectors',
      message: error.message
    });
  }
};

/**
 * GET /api/connectors/:id
 * Get a specific connector by ID
 */
export const getConnector = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const [connector] = await db
      .select()
      .from(apiConnectors)
      .where(and(
        eq(apiConnectors.id, id),
        eq(apiConnectors.userId, userId)
      ))
      .limit(1);

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    return res.status(200).json({
      success: true,
      connector,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Get error:', error);
    return res.status(500).json({
      error: 'Failed to get connector',
      message: error.message
    });
  }
};

/**
 * PUT /api/connectors/:id
 * Update a connector
 */
export const updateConnector = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const validatedData = updateConnectorSchema.parse(req.body);

    // Check ownership
    const [existing] = await db
      .select()
      .from(apiConnectors)
      .where(and(
        eq(apiConnectors.id, id),
        eq(apiConnectors.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    // Update connector
    const [updated] = await db
      .update(apiConnectors)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(apiConnectors.id, id))
      .returning();

    console.log(`[ConnectorController] Connector updated: ${id}`);

    return res.status(200).json({
      success: true,
      connector: updated,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Update error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    return res.status(500).json({
      error: 'Failed to update connector',
      message: error.message
    });
  }
};

/**
 * DELETE /api/connectors/:id
 * Delete a connector
 */
export const deleteConnector = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check ownership
    const [existing] = await db
      .select()
      .from(apiConnectors)
      .where(and(
        eq(apiConnectors.id, id),
        eq(apiConnectors.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    // Delete connector
    await db
      .delete(apiConnectors)
      .where(eq(apiConnectors.id, id));

    console.log(`[ConnectorController] Connector deleted: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Connector deleted successfully',
    });

  } catch (error: any) {
    console.error('[ConnectorController] Delete error:', error);
    return res.status(500).json({
      error: 'Failed to delete connector',
      message: error.message
    });
  }
};

/**
 * GET /api/connectors/jobs/:jobId
 * Get job status
 */
export const getJobStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobId } = req.params;

    // Check job ownership
    const [job] = await db
      .select()
      .from(connectorJobs)
      .where(and(
        eq(connectorJobs.id, jobId),
        eq(connectorJobs.userId, userId)
      ))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get status from MCPOverflow
    const service = MCPOverflowConnectorService.getInstance();
    const status = await service.getJobStatus(jobId);

    // Update job in database
    await db
      .update(connectorJobs)
      .set({
        status: status.status,
        result: status.result ? JSON.stringify(status.result) : undefined,
        error: status.error,
        completedAt: status.completedAt ? new Date(status.completedAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(connectorJobs.id, jobId));

    // If completed, save connector
    if (status.status === 'completed' && status.result) {
      const existingConnector = await db
        .select()
        .from(apiConnectors)
        .where(eq(apiConnectors.id, status.result.id))
        .limit(1);

      if (existingConnector.length === 0) {
        await db.insert(apiConnectors).values({
          id: status.result.id,
          userId,
          name: status.result.name,
          language: status.result.language,
          runtime: status.result.runtime,
          code: status.result.code,
          types: status.result.types,
          config: status.result.config,
          tests: status.result.tests,
          documentation: status.result.documentation,
          metadata: status.result.metadata,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return res.status(200).json({
      success: true,
      job: status,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Get job status error:', error);
    return res.status(500).json({
      error: 'Failed to get job status',
      message: error.message
    });
  }
};

/**
 * GET /api/connectors/jobs
 * List all jobs for the authenticated user
 */
export const listJobs = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, limit = '50', offset = '0' } = req.query;

    const conditions = [eq(connectorJobs.userId, userId)];

    if (status) {
      conditions.push(eq(connectorJobs.status, status as any));
    }

    const jobs = await db
      .select()
      .from(connectorJobs)
      .where(and(...conditions))
      .orderBy(desc(connectorJobs.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const total = await db
      .select({ count: connectorJobs.id })
      .from(connectorJobs)
      .where(and(...conditions));

    return res.status(200).json({
      success: true,
      jobs,
      total: total.length,
      limit: Number(limit),
      offset: Number(offset),
    });

  } catch (error: any) {
    console.error('[ConnectorController] List jobs error:', error);
    return res.status(500).json({
      error: 'Failed to list jobs',
      message: error.message
    });
  }
};

/**
 * POST /api/connectors/:id/tests
 * Generate tests for a connector
 */
export const generateTests = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check ownership
    const [connector] = await db
      .select()
      .from(apiConnectors)
      .where(and(
        eq(apiConnectors.id, id),
        eq(apiConnectors.userId, userId)
      ))
      .limit(1);

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const service = MCPOverflowConnectorService.getInstance();
    const { tests } = await service.generateTests(id);

    // Update connector with tests
    await db
      .update(apiConnectors)
      .set({
        tests,
        updatedAt: new Date(),
      })
      .where(eq(apiConnectors.id, id));

    return res.status(200).json({
      success: true,
      tests,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Generate tests error:', error);
    return res.status(500).json({
      error: 'Failed to generate tests',
      message: error.message
    });
  }
};

/**
 * POST /api/connectors/:id/validate
 * Validate a connector
 */
export const validateConnector = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check ownership
    const [connector] = await db
      .select()
      .from(apiConnectors)
      .where(and(
        eq(apiConnectors.id, id),
        eq(apiConnectors.userId, userId)
      ))
      .limit(1);

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const service = MCPOverflowConnectorService.getInstance();
    const validation = await service.validateConnector(connector as any);

    return res.status(200).json({
      success: true,
      validation,
    });

  } catch (error: any) {
    console.error('[ConnectorController] Validate error:', error);
    return res.status(500).json({
      error: 'Failed to validate connector',
      message: error.message
    });
  }
};
