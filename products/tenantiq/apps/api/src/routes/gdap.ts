/** GDAP (Granular Delegated Admin Privileges) & Partner Center Routes */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { createPartnerCenterClient } from '../lib/partner-center/graph-client';
import { AZURE_AD_ROLES } from '../lib/partner-center/azure-ad-roles';

export const gdapRoutes = new Hono<AppEnv>();
gdapRoutes.use('*', authMiddleware);

const createSchema = z.object({
	customerId: z.string().uuid(),
	displayName: z.string().min(1).max(200),
	roles: z.array(z.string()).min(1),
	duration: z.string().regex(/^P\d+[DY]$/, 'ISO 8601 duration like P180D or P2Y'),
});
const updateSchema = z.object({
	displayName: z.string().min(1).max(200).optional(),
	roles: z.array(z.string()).min(1).optional(),
	duration: z.string().regex(/^P\d+[DY]$/).optional(),
});
const accessAssignmentSchema = z.object({
	securityGroupId: z.string().uuid(),
	roles: z.array(z.string()).min(1),
});
const partnerInfoSchema = z.object({
	partnerId: z.string().min(1).max(100),
	partnerTenantId: z.string().uuid(),
});

function parseDuration(iso: string): number {
	const m = iso.match(/^P(\d+)([DY])$/);
	if (!m) return 180 * 86400000;
	return parseInt(m[1]) * (m[2] === 'Y' ? 365 : 1) * 86400000;
}
function parseBody<T>(result: z.SafeParseReturnType<unknown, T>): T | string {
	return result.success ? result.data : (result.error.errors[0]?.message ?? 'Invalid input');
}

gdapRoutes.get('/relationships', async (c) => {
	const orgId = c.get('user').orgId;
	const rows = await c.env.DB.prepare(
		`SELECT * FROM gdap_relationships WHERE org_id = ? ORDER BY created_at DESC`,
	).bind(orgId).all();
	const data = (rows.results ?? []).map((r: Record<string, unknown>) => ({
		...r, roles: JSON.parse((r.roles as string) || '[]'),
	}));
	return c.json({ data });
});

gdapRoutes.post('/relationships', async (c) => {
	const orgId = c.get('user').orgId;
	const parsed = parseBody(createSchema.safeParse(await c.req.json().catch(() => ({}))));
	if (typeof parsed === 'string') return c.json({ error: parsed }, 400);

	const id = crypto.randomUUID();
	const now = Date.now();
	const expiresAt = now + parseDuration(parsed.duration);

	await c.env.DB.prepare(
		`INSERT INTO gdap_relationships
		 (id, org_id, customer_id, customer_name, display_name, status, roles, duration, created_at, expires_at)
		 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
	).bind(
		id, orgId, parsed.customerId, parsed.displayName,
		parsed.displayName, JSON.stringify(parsed.roles),
		parsed.duration, now, expiresAt,
	).run();

	return c.json({ data: { id, status: 'pending', expiresAt } }, 201);
});

gdapRoutes.get('/relationships/:id', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await c.env.DB.prepare(
		`SELECT * FROM gdap_relationships WHERE id = ? AND org_id = ?`,
	).bind(c.req.param('id'), orgId).first();

	if (!row) return c.json({ error: 'Relationship not found' }, 404);
	return c.json({ data: { ...row, roles: JSON.parse((row.roles as string) || '[]') } });
});

gdapRoutes.patch('/relationships/:id', async (c) => {
	const orgId = c.get('user').orgId;
	const relId = c.req.param('id');
	const parsed = parseBody(updateSchema.safeParse(await c.req.json().catch(() => ({}))));
	if (typeof parsed === 'string') return c.json({ error: parsed }, 400);

	const existing = await c.env.DB.prepare(
		`SELECT id, status FROM gdap_relationships WHERE id = ? AND org_id = ?`,
	).bind(relId, orgId).first();
	if (!existing) return c.json({ error: 'Relationship not found' }, 404);
	if (existing.status === 'terminated') return c.json({ error: 'Cannot update terminated relationship' }, 409);

	const sets: string[] = [];
	const binds: unknown[] = [];
	if (parsed.displayName) { sets.push('display_name = ?'); binds.push(parsed.displayName); }
	if (parsed.roles) { sets.push('roles = ?'); binds.push(JSON.stringify(parsed.roles)); }
	if (parsed.duration) {
		sets.push('duration = ?', 'expires_at = ?');
		binds.push(parsed.duration, Date.now() + parseDuration(parsed.duration));
	}
	if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

	binds.push(relId, orgId);
	await c.env.DB.prepare(
		`UPDATE gdap_relationships SET ${sets.join(', ')} WHERE id = ? AND org_id = ?`,
	).bind(...binds).run();

	return c.json({ data: { id: relId, updated: true } });
});

gdapRoutes.delete('/relationships/:id', async (c) => {
	const orgId = c.get('user').orgId;
	const relId = c.req.param('id');

	const existing = await c.env.DB.prepare(
		`SELECT id FROM gdap_relationships WHERE id = ? AND org_id = ?`,
	).bind(relId, orgId).first();
	if (!existing) return c.json({ error: 'Relationship not found' }, 404);

	await c.env.DB.prepare(
		`UPDATE gdap_relationships SET status = 'terminated', terminated_at = ? WHERE id = ? AND org_id = ?`,
	).bind(Date.now(), relId, orgId).run();

	return c.json({ data: { id: relId, status: 'terminated' } });
});

gdapRoutes.get('/roles', (c) => c.json({ data: AZURE_AD_ROLES }));

gdapRoutes.post('/relationships/:id/access-assignment', async (c) => {
	const orgId = c.get('user').orgId;
	const relId = c.req.param('id');
	const parsed = parseBody(accessAssignmentSchema.safeParse(await c.req.json().catch(() => ({}))));
	if (typeof parsed === 'string') return c.json({ error: parsed }, 400);

	const rel = await c.env.DB.prepare(
		`SELECT id, status FROM gdap_relationships WHERE id = ? AND org_id = ?`,
	).bind(relId, orgId).first();
	if (!rel) return c.json({ error: 'Relationship not found' }, 404);
	if (rel.status !== 'active') return c.json({ error: 'Relationship must be active' }, 409);

	const partnerInfo = await c.env.DB.prepare(
		`SELECT partner_tenant_id FROM partner_config WHERE org_id = ?`,
	).bind(orgId).first<{ partner_tenant_id: string }>();
	if (!partnerInfo) return c.json({ error: 'Partner Center not configured for this org' }, 412);

	try {
		const pc = createPartnerCenterClient(c.env, partnerInfo.partner_tenant_id);
		const assignment = await pc.createAccessAssignment(relId, parsed.securityGroupId, parsed.roles);
		const localId = assignment.id ?? crypto.randomUUID();
		const createdAt = Date.now();
		await c.env.DB.prepare(
			`INSERT INTO gdap_access_assignments (id, relationship_id, org_id, security_group_id, roles, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).bind(localId, relId, orgId, parsed.securityGroupId, JSON.stringify(parsed.roles), assignment.status ?? 'pending', createdAt).run();
		return c.json({ data: {
			id: localId, relationshipId: relId,
			securityGroupId: parsed.securityGroupId, roles: parsed.roles,
			status: assignment.status ?? 'pending', createdAt,
		} }, 201);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Partner Center call failed';
		return c.json({ error: 'Failed to create access assignment', detail: msg }, 502);
	}
});

gdapRoutes.get('/partner-info', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await c.env.DB.prepare(
		`SELECT partner_id, partner_tenant_id, created_at FROM partner_config WHERE org_id = ?`,
	).bind(orgId).first();

	if (!row) return c.json({ data: null });
	return c.json({ data: row });
});

gdapRoutes.post('/partner-info', async (c) => {
	const orgId = c.get('user').orgId;
	const parsed = parseBody(partnerInfoSchema.safeParse(await c.req.json().catch(() => ({}))));
	if (typeof parsed === 'string') return c.json({ error: parsed }, 400);

	const now = Date.now();
	await c.env.DB.prepare(
		`INSERT INTO partner_config (id, org_id, partner_id, partner_tenant_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (org_id) DO UPDATE SET partner_id = ?, partner_tenant_id = ?, updated_at = ?`,
	).bind(
		crypto.randomUUID(), orgId, parsed.partnerId, parsed.partnerTenantId, now, now,
		parsed.partnerId, parsed.partnerTenantId, now,
	).run();

	return c.json({ data: { partnerId: parsed.partnerId, configured: true } });
});
