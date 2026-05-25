import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { workflowTemplateRoutes } from './workflow-templates';
import type { AppEnv } from '../app/types';

// Mock auth middleware to pass through
vi.mock('../middleware/auth.middleware', () => ({
	authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
	requireRole: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
	tenantScopingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock('../middleware/rateLimit.middleware', () => ({
	standardRateLimit: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

function createApp() {
	const app = new Hono<AppEnv>();
	app.route('/api/workflow-templates', workflowTemplateRoutes);
	return app;
}

describe('GET /api/workflow-templates', () => {
	let app: ReturnType<typeof createApp>;

	beforeEach(() => {
		app = createApp();
	});

	it('should return all 25 templates', async () => {
		const res = await app.request('/api/workflow-templates');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.total).toBe(25);
		expect(body.templates.length).toBe(25);
	});

	it('should filter by category', async () => {
		const res = await app.request('/api/workflow-templates?category=security');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.total).toBe(6);
		for (const t of body.templates) {
			expect(t.category).toBe('security');
		}
	});

	it('should reject invalid category', async () => {
		const res = await app.request('/api/workflow-templates?category=invalid');
		expect(res.status).toBe(400);
	});

	it('should return a single template by ID', async () => {
		const res = await app.request('/api/workflow-templates/onboard-new-user');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.template.id).toBe('onboard-new-user');
		expect(body.template.category).toBe('lifecycle');
	});

	it('should return 404 for unknown template ID', async () => {
		const res = await app.request('/api/workflow-templates/does-not-exist');
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe('Template not found');
	});

	it('should return templates with valid structure', async () => {
		const res = await app.request('/api/workflow-templates/reclaim-unused-licenses');
		const body = await res.json();
		const t = body.template;
		expect(t).toHaveProperty('id');
		expect(t).toHaveProperty('name');
		expect(t).toHaveProperty('steps');
		expect(t).toHaveProperty('tags');
		expect(t.steps.length).toBeGreaterThanOrEqual(2);
	});
});
