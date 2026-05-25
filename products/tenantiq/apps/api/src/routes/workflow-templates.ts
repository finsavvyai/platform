import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { ALL_TEMPLATES, findTemplateById, findTemplatesByCategory } from '../lib/workflows/templates';
import type { TemplateCategory } from '../../../../packages/shared/src/types/workflow-dsl';
import type { AppEnv } from '../app/types';

const categorySchema = z.enum(['license', 'security', 'lifecycle', 'governance']);

export const workflowTemplateRoutes = new Hono<AppEnv>();

workflowTemplateRoutes.use('*', authMiddleware);
workflowTemplateRoutes.use('*', standardRateLimit);

// GET / — list all templates, optional ?category= filter
workflowTemplateRoutes.get('/', async (c) => {
	const categoryParam = c.req.query('category');

	if (categoryParam) {
		const parsed = categorySchema.safeParse(categoryParam);
		if (!parsed.success) {
			return c.json({ error: 'Invalid category. Must be: license, security, lifecycle, governance' }, 400);
		}
		const templates = findTemplatesByCategory(parsed.data);
		return c.json({ templates, total: templates.length });
	}

	return c.json({ templates: ALL_TEMPLATES, total: ALL_TEMPLATES.length });
});

// GET /:id — get single template by ID
workflowTemplateRoutes.get('/:id', async (c) => {
	const id = c.req.param('id');
	if (!id) return c.json({ error: 'Missing id' }, 400);
	const template = findTemplateById(id);

	if (!template) {
		return c.json({ error: 'Template not found' }, 404);
	}

	return c.json({ template });
});

// POST /:id/install — install template as new workflow for current org
workflowTemplateRoutes.post('/:id/install', requireRole('admin', 'super_admin'), async (c) => {
	const id = c.req.param('id');
	if (!id) return c.json({ error: 'Missing id' }, 400);
	const template = findTemplateById(id);

	if (!template) {
		return c.json({ error: 'Template not found' }, 404);
	}

	const tenantId = c.get('tenantId');
	const userId = c.get('userId') ?? c.get('user')?.sub ?? 'system';
	const db = getDb(c.env);

	const body = await c.req.json().catch(() => ({}));
	const workflowName = typeof body.name === 'string' && body.name.length > 0
		? body.name
		: template.name;

	const workflowId = crypto.randomUUID();

	await db.insert(schema.workflows).values({
		id: workflowId,
		tenantId,
		name: workflowName,
		type: `template:${template.category}`,
		schedule: template.triggerType === 'schedule' ? '0 2 * * *' : null,
		enabled: 1,
		parameters: JSON.stringify({
			templateId: template.id,
			steps: template.steps,
			triggerType: template.triggerType,
			tags: template.tags,
		}),
		conditions: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy: userId,
	});

	return c.json({
		message: 'Workflow template installed',
		workflowId,
		templateId: template.id,
	});
});
