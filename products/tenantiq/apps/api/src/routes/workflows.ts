import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, tenantScopingMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../app/types';

const workflowCreateSchema = z.object({
	name: z.string().min(1).max(200),
	type: z.string().min(1).max(50),
	schedule: z.string().max(100).nullable().optional(),
	parameters: z.record(z.unknown()).optional(),
	conditions: z.record(z.unknown()).optional(),
});

const workflows = new Hono<AppEnv>();

workflows.use('*', authMiddleware);
workflows.use('*', standardRateLimit);

workflows.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	const workflowList = await db
		.select()
		.from(schema.workflows)
		.where(eq(schema.workflows.tenantId, tenantId))
		.orderBy(desc(schema.workflows.createdAt));

	return c.json({ workflows: workflowList });
});

workflows.get('/:workflowId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const workflowId = c.req.param('workflowId');
	if (!workflowId) return c.json({ error: 'Missing workflowId' }, 400);
	const db = getDb(c.env);

	const workflow = await db
		.select()
		.from(schema.workflows)
		.where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.tenantId, tenantId)))
		.limit(1);

	if (workflow.length === 0) {
		return c.json({ error: 'Not Found' }, 404);
	}

	const executions = await db
		.select()
		.from(schema.workflowExecutions)
		.where(eq(schema.workflowExecutions.workflowId, workflowId))
		.orderBy(desc(schema.workflowExecutions.startedAt))
		.limit(50);

	return c.json({ workflow: workflow[0], executions });
});

workflows.post('/', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.get('userId') ?? c.get('user')?.sub ?? 'system';
	const raw = await c.req.json().catch(() => ({}));
	const parsed = workflowCreateSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
	}
	const { name, type, schedule, parameters, conditions } = parsed.data;
	const db = getDb(c.env);

	const workflowId = crypto.randomUUID();
	await db.insert(schema.workflows).values({
		id: workflowId,
		tenantId,
		name,
		type,
		schedule: schedule || null,
		enabled: 1,
		parameters: parameters ? JSON.stringify(parameters) : null,
		conditions: conditions ? JSON.stringify(conditions) : null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy: userId,
	});

	return c.json({ message: 'Workflow created successfully', workflowId });
});

export default workflows;
