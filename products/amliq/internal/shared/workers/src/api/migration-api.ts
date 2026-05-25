/**
 * Migration API Endpoints
 * HTTP API for database migration management
 */

import { MigrationCLI } from '../database/migration-cli';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Hono } from 'hono';

const migrationRoutes = new Hono<{ Bindings: Env }>();

// Request schemas
const runMigrationsSchema = z.object({
  products: z.string().optional(),
  regions: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  verbose: z.boolean().optional().default(false),
  config: z.object({
    autoRun: z.boolean().optional(),
    enableAIMigrations: z.boolean().optional(),
    rollbackOnError: z.boolean().optional()
  }).optional()
});

const statusSchema = z.object({
  product: z.string().optional(),
  region: z.enum(['US', 'EU']).optional(),
  format: z.enum(['json', 'table']).optional().default('table')
});

const validateSchema = z.object({
  product: z.string().optional(),
  region: z.enum(['US', 'EU']).optional(),
  format: z.enum(['json', 'table']).optional().default('table')
});

const historySchema = z.object({
  executionId: z.string().optional(),
  limit: z.number().optional().default(20),
  format: z.enum(['json', 'table']).optional().default('table')
});

/**
 * Run all pending migrations
 */
migrationRoutes.post('/run', zValidator('json', runMigrationsSchema), async (c) => {
  try {
    const { products, regions, dryRun, verbose, config } = c.req.valid('json');

    const cli = new MigrationCLI(c.env);
    const result = await cli.execute({
      command: 'run',
      options: {
        products,
        regions,
        dryRun,
        verbose,
        config
      }
    });

    return c.json({
      success: result.success,
      message: result.output,
      data: result.data
    }, result.success ? 200 : 400);

  } catch (error) {
    console.error('Migration API error:', error);
    return c.json({
      success: false,
      message: `Migration execution failed: ${error.message}`,
      error: error.message
    }, 500);
  }
});

/**
 * Get migration status
 */
migrationRoutes.get('/status', zValidator('query', statusSchema), async (c) => {
  try {
    const { product, region, format } = c.req.valid('query');

    const cli = new MigrationCLI(c.env);
    const result = await cli.execute({
      command: 'status',
      options: {
        product,
        region,
        format
      }
    });

    return c.json({
      success: result.success,
      message: result.output,
      data: result.data
    });

  } catch (error) {
    console.error('Status API error:', error);
    return c.json({
      success: false,
      message: `Status check failed: ${error.message}`,
      error: error.message
    }, 500);
  }
});

/**
 * Validate database integrity
 */
migrationRoutes.get('/validate', zValidator('query', validateSchema), async (c) => {
  try {
    const { product, region, format } = c.req.valid('query');

    const cli = new MigrationCLI(c.env);
    const result = await cli.execute({
      command: 'validate',
      options: {
        product,
        region,
        format
      }
    });

    return c.json({
      success: result.success,
      message: result.output,
      data: result.data
    });

  } catch (error) {
    console.error('Validation API error:', error);
    return c.json({
      success: false,
      message: `Validation failed: ${error.message}`,
      error: error.message
    }, 500);
  }
});

/**
 * Get migration history
 */
migrationRoutes.get('/history', zValidator('query', historySchema), async (c) => {
  try {
    const { executionId, limit, format } = c.req.valid('query');

    const cli = new MigrationCLI(c.env);
    const result = await cli.execute({
      command: 'history',
      options: {
        executionId,
        limit,
        format
      }
    });

    return c.json({
      success: result.success,
      message: result.output,
      data: result.data
    });

  } catch (error) {
    console.error('History API error:', error);
    return c.json({
      success: false,
      message: `History retrieval failed: ${error.message}`,
      error: error.message
    }, 500);
  }
});

/**
 * Get comprehensive migration dashboard data
 */
migrationRoutes.get('/dashboard', async (c) => {
  try {
    const cli = new MigrationCLI(c.env);

    // Get status, validation, and recent history
    const [statusResult, validationResult, historyResult] = await Promise.all([
      cli.execute({ command: 'status', options: { format: 'json' } }),
      cli.execute({ command: 'validate', options: { format: 'json' } }),
      cli.execute({ command: 'history', options: { limit: 10, format: 'json' } })
    ]);

    const dashboard = {
      overview: {
        status: statusResult.data?.overallStatus || 'unknown',
        validation: validationResult.data?.overall || 'unknown',
        lastUpdate: new Date().toISOString()
      },
      products: statusResult.data?.products || {},
      validation: validationResult.data?.details || {},
      recentExecutions: historyResult.data?.slice(0, 5) || [],
      summary: {
        totalProducts: Object.keys(statusResult.data?.products || {}).length,
        needsMigration: Object.values(statusResult.data?.products || {})
          .flat()
          .filter((r: any) => r.healthStatus === 'needs_migration').length,
        hasErrors: Object.values(validationResult.data?.details || {})
          .flat()
          .filter((r: any) => r.validity === 'invalid').length
      }
    };

    return c.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return c.json({
      success: false,
      message: `Dashboard data failed: ${error.message}`,
      error: error.message
    }, 500);
  }
});

/**
 * Schedule automatic migrations (if supported)
 */
migrationRoutes.post('/schedule', async (c) => {
  try {
    const scheduleData = await c.req.json();

    // This would integrate with Cloudflare Cron or scheduled jobs
    // For now, return a success response indicating the schedule would be created

    return c.json({
      success: true,
      message: 'Migration scheduling endpoint - would integrate with Cloudflare Cron',
      data: {
        schedule: scheduleData,
        scheduledAt: new Date().toISOString(),
        nextRun: 'Would calculate based on schedule'
      }
    });

  } catch (error) {
    console.error('Schedule API error:', error);
    return c.json({
      success: false,
      message: `Scheduling failed: ${error.message}`,
      error: error.message
    }, 500);
  }
});

/**
 * Health check endpoint for migration system
 */
migrationRoutes.get('/health', async (c) => {
  try {
    const cli = new MigrationCLI(c.env);

    // Quick status check
    const result = await cli.execute({
      command: 'status',
      options: { format: 'json' }
    });

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: result.success ? 'healthy' : 'unhealthy',
        migration: 'healthy',
        ai: c.env.AI ? 'available' : 'unavailable'
      },
      metrics: {
        lastCheck: new Date().toISOString(),
        responseTime: Date.now()
      }
    };

    if (!result.success) {
      health.status = 'degraded';
      health.services.database = 'unhealthy';
    }

    return c.json(health, health.status === 'healthy' ? 200 : 503);

  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, 503);
  }
});

/**
 * Migration documentation endpoint
 */
migrationRoutes.get('/docs', async (c) => {
  const docs = {
    title: 'Database Migration API',
    version: '1.0.0',
    description: 'API for managing database migrations in the FinSavvy AI Suite',
    endpoints: {
      'POST /run': {
        description: 'Run pending migrations',
        parameters: {
          products: 'string (optional) - Comma-separated list of products',
          regions: 'string (optional) - Comma-separated list of regions (US,EU)',
          dryRun: 'boolean (optional) - Preview migrations without executing',
          verbose: 'boolean (optional) - Enable verbose logging',
          config: 'object (optional) - Migration configuration'
        },
        example: {
          products: 'billing,compliance',
          regions: 'US,EU',
          dryRun: false,
          verbose: true
        }
      },
      'GET /status': {
        description: 'Get current migration status',
        parameters: {
          product: 'string (optional) - Specific product to check',
          region: 'string (optional) - Specific region to check',
          format: 'string - Output format (json, table)'
        }
      },
      'GET /validate': {
        description: 'Validate database integrity',
        parameters: {
          product: 'string (optional) - Specific product to validate',
          region: 'string (optional) - Specific region to validate',
          format: 'string - Output format (json, table)'
        }
      },
      'GET /history': {
        description: 'Get migration execution history',
        parameters: {
          executionId: 'string (optional) - Specific execution ID',
          limit: 'number - Maximum number of results (default: 20)',
          format: 'string - Output format (json, table)'
        }
      },
      'GET /dashboard': {
        description: 'Get comprehensive migration dashboard data',
        parameters: {}
      },
      'POST /schedule': {
        description: 'Schedule automatic migrations',
        parameters: {
          schedule: 'object - Schedule configuration'
        }
      },
      'GET /health': {
        description: 'Health check for migration system',
        parameters: {}
      }
    },
    products: ['core', 'billing', 'compliance', 'intelligence', 'risk'],
    regions: ['US', 'EU'],
    environments: ['development', 'staging', 'production']
  };

  return c.json(docs);
});

export default migrationRoutes;