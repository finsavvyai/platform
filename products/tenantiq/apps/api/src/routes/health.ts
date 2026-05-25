import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const startedAt = Date.now();

export const healthRoutes = new Hono<AppEnv>();

/**
 * Health check endpoint for monitoring and deployment verification
 * Returns 200 OK if all systems are operational
 * Returns 503 Service Unavailable if any critical system is down
 */
healthRoutes.get('/', async (c) => {
	const checks: {
		database: 'healthy' | 'unhealthy';
		timestamp: string;
		version: string;
		uptimeSeconds: number;
	} = {
		database: 'unhealthy',
		timestamp: new Date().toISOString(),
		version: c.env.APP_VERSION || '0.0.0-dev',
		uptimeSeconds: 0
	};

	try {
		// Check database connectivity (D1)
		const db = c.env.DB;
		await db.prepare('SELECT 1 as health_check').first();
		checks.database = 'healthy';
	} catch (err) {
		console.error('Database health check failed:', err);
	}

	checks.uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

	// Overall health status
	const isHealthy = checks.database === 'healthy';

	return c.json(
		{
			status: isHealthy ? 'healthy' : 'unhealthy',
			checks,
			environment: c.env.ENVIRONMENT || 'production'
		},
		isHealthy ? 200 : 503
	);
});

/**
 * Readiness check - indicates if the service is ready to accept traffic
 * Used by load balancers and orchestration systems
 */
healthRoutes.get('/ready', async (c) => {
	try {
		// Check database connectivity (D1)
		const db = c.env.DB;
		await db.prepare('SELECT 1 as readiness_check').first();

		return c.json({
			status: 'ready',
			timestamp: new Date().toISOString()
		});
	} catch (err) {
		return c.json(
			{
				status: 'not_ready',
				error: 'Database connection failed',
				timestamp: new Date().toISOString()
			},
			503
		);
	}
});

/**
 * Liveness check - indicates if the service is alive
 * Used by orchestration systems to determine if the service should be restarted
 */
healthRoutes.get('/live', async (c) => {
	return c.json({
		status: 'alive',
		timestamp: new Date().toISOString()
	});
});
