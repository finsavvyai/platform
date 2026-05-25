import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import orgsGrantTier from './orgs-grant-tier';
import type { AppEnv } from '../../app/types';

function mkApp(role: string, dbResults: { before: any; afterPlan?: string }) {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		c.set('userRole', role as any);
		c.set('user', { sub: 'admin-1', orgId: 'org-platform', role } as any);
		c.set('userId', 'admin-1');
		await next();
	});
	app.route('/', orgsGrantTier);

	const db = {
		prepare: (sql: string) => ({
			bind: (...args: any[]) => ({
				first: async () => {
					if (sql.includes('SELECT id, billing_plan, deleted_at')) return dbResults.before;
					if (sql.includes('SELECT id, name, billing_plan, deleted_at')) return { id: args[0], name: 'Acme', billing_plan: dbResults.afterPlan ?? 'enterprise', deleted_at: null };
					return null;
				},
				run: async () => ({ success: true }),
				all: async () => ({ results: [] }),
			}),
		}),
	};

	return { app, env: { DB: db } as any };
}

describe('POST /:id/grant-tier', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects non-admin', async () => {
		const { app, env } = mkApp('member', { before: { id: 'org-1', billing_plan: 'free', deleted_at: null } });
		const res = await app.fetch(new Request('http://t/org-1/grant-tier', { method: 'POST', body: JSON.stringify({ tier: 'enterprise', reason: 'demo' }) }), env);
		expect(res.status).toBe(403);
	});

	it('rejects invalid tier', async () => {
		const { app, env } = mkApp('super_admin', { before: { id: 'org-1', billing_plan: 'free', deleted_at: null } });
		const res = await app.fetch(new Request('http://t/org-1/grant-tier', { method: 'POST', body: JSON.stringify({ tier: 'platinum', reason: 'demo run' }) }), env);
		expect(res.status).toBe(400);
	});

	it('rejects short reason', async () => {
		const { app, env } = mkApp('super_admin', { before: { id: 'org-1', billing_plan: 'free', deleted_at: null } });
		const res = await app.fetch(new Request('http://t/org-1/grant-tier', { method: 'POST', body: JSON.stringify({ tier: 'enterprise', reason: 'x' }) }), env);
		expect(res.status).toBe(400);
	});

	it('returns 404 for unknown org', async () => {
		const { app, env } = mkApp('super_admin', { before: null as any });
		const res = await app.fetch(new Request('http://t/missing/grant-tier', { method: 'POST', body: JSON.stringify({ tier: 'enterprise', reason: 'sales demo' }) }), env);
		expect(res.status).toBe(404);
	});

	it('grants tier + clears soft-delete by default', async () => {
		const { app, env } = mkApp('super_admin', { before: { id: 'org-1', billing_plan: 'free', deleted_at: 1700000000000 } });
		const res = await app.fetch(new Request('http://t/org-1/grant-tier', { method: 'POST', body: JSON.stringify({ tier: 'enterprise', reason: 'sales demo with Acme' }) }), env);
		expect(res.status).toBe(200);
		const json = await res.json() as any;
		expect(json.ok).toBe(true);
		expect(json.before.billing_plan).toBe('free');
		expect(json.after.billing_plan).toBe('enterprise');
	});
});
