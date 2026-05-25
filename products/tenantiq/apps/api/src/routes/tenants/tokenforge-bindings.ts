/**
 * TokenForge device binding routes — bind, validate, list, revoke devices.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { genId, logTfEvent, bindDeviceSchema, validateSchema } from './tokenforge-helpers';

export const tokenforgeBindingRoutes = new Hono<AppEnv>();

// POST /:id/tokenforge/bind — register a device binding
tokenforgeBindingRoutes.post('/:id/tokenforge/bind', async (c) => {
	const tenantId = c.req.param('id');
	const user = c.get('user');
	const db = c.env.DB;

	const body = await c.req.json().catch(() => ({}));
	const parsed = bindDeviceSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid device data', details: parsed.error.errors }, 400);
	}

	const { deviceFingerprint, deviceName, publicKeyHash } = parsed.data;

	const config = await db.prepare(
		'SELECT max_devices_per_user, binding_ttl_days FROM tokenforge_config WHERE tenant_id = ? AND enabled = 1',
	).bind(tenantId).first();
	if (!config) return c.json({ error: 'TokenForge not enabled for this tenant' }, 403);

	const activeCount = await db.prepare(
		"SELECT COUNT(*) as cnt FROM tokenforge_device_bindings WHERE tenant_id = ? AND user_id = ? AND status = 'active'",
	).bind(tenantId, user.sub).first() as any;

	if ((activeCount?.cnt ?? 0) >= (config.max_devices_per_user as number)) {
		return c.json({ error: 'Maximum device bindings reached', limit: config.max_devices_per_user }, 409);
	}

	const now = Date.now();
	const ttlMs = (config.binding_ttl_days as number) * 86_400_000;
	const id = genId();

	const existing = await db.prepare(
		'SELECT id FROM tokenforge_device_bindings WHERE tenant_id = ? AND user_id = ? AND device_fingerprint = ?',
	).bind(tenantId, user.sub, deviceFingerprint).first();

	if (existing) {
		await db.prepare(
			"UPDATE tokenforge_device_bindings SET public_key_hash = ?, device_name = ?, status = 'active', last_verified_at = ?, expires_at = ? WHERE id = ?",
		).bind(publicKeyHash, deviceName ?? null, now, now + ttlMs, existing.id).run();
	} else {
		await db.prepare(
			`INSERT INTO tokenforge_device_bindings
			 (id, org_id, tenant_id, user_id, device_fingerprint, device_name, public_key_hash, status, last_verified_at, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
		).bind(id, user.orgId, tenantId, user.sub, deviceFingerprint, deviceName ?? null, publicKeyHash, now, now + ttlMs, now).run();
	}

	await logTfEvent(db, user.orgId, tenantId, 'binding_created', user.sub, deviceFingerprint, { deviceName });
	return c.json({ success: true, bindingId: existing ? existing.id : id }, 201);
});

// POST /:id/tokenforge/validate — verify a device binding
tokenforgeBindingRoutes.post('/:id/tokenforge/validate', async (c) => {
	const tenantId = c.req.param('id');
	const user = c.get('user');
	const db = c.env.DB;

	const body = await c.req.json().catch(() => ({}));
	const parsed = validateSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid validation data' }, 400);

	const { deviceFingerprint, publicKeyHash } = parsed.data;

	const binding = await db.prepare(
		"SELECT * FROM tokenforge_device_bindings WHERE tenant_id = ? AND user_id = ? AND device_fingerprint = ? AND status = 'active'",
	).bind(tenantId, user.sub, deviceFingerprint).first();

	if (!binding) {
		await logTfEvent(db, user.orgId, tenantId, 'validation_failed', user.sub, deviceFingerprint, { reason: 'no_binding' });
		return c.json({ valid: false, reason: 'Device not registered' }, 403);
	}

	if (binding.expires_at && (binding.expires_at as number) < Date.now()) {
		await db.prepare("UPDATE tokenforge_device_bindings SET status = 'expired' WHERE id = ?").bind(binding.id).run();
		await logTfEvent(db, user.orgId, tenantId, 'validation_failed', user.sub, deviceFingerprint, { reason: 'expired' });
		return c.json({ valid: false, reason: 'Binding expired' }, 403);
	}

	if (binding.public_key_hash !== publicKeyHash) {
		await logTfEvent(db, user.orgId, tenantId, 'device_mismatch', user.sub, deviceFingerprint, { reason: 'key_mismatch' });
		return c.json({ valid: false, reason: 'Key mismatch' }, 403);
	}

	await db.prepare('UPDATE tokenforge_device_bindings SET last_verified_at = ? WHERE id = ?')
		.bind(Date.now(), binding.id).run();
	return c.json({ valid: true, bindingId: binding.id });
});

// GET /:id/tokenforge/bindings — list device bindings
tokenforgeBindingRoutes.get('/:id/tokenforge/bindings', async (c) => {
	const tenantId = c.req.param('id');
	const db = c.env.DB;

	const rows = await db.prepare(
		`SELECT id, user_id, device_fingerprint, device_name, status, last_verified_at, expires_at, created_at
		 FROM tokenforge_device_bindings WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200`,
	).bind(tenantId).all();

	return c.json({ bindings: rows.results ?? [] });
});

// DELETE /:id/tokenforge/bindings/:bindingId — revoke a binding
tokenforgeBindingRoutes.delete('/:id/tokenforge/bindings/:bindingId', async (c) => {
	const tenantId = c.req.param('id');
	const bindingId = c.req.param('bindingId');
	const user = c.get('user');
	const db = c.env.DB;

	const binding = await db.prepare(
		'SELECT id, device_fingerprint, user_id FROM tokenforge_device_bindings WHERE id = ? AND tenant_id = ?',
	).bind(bindingId, tenantId).first();
	if (!binding) return c.json({ error: 'Binding not found' }, 404);

	await db.prepare("UPDATE tokenforge_device_bindings SET status = 'revoked' WHERE id = ?").bind(bindingId).run();
	await logTfEvent(db, user.orgId, tenantId, 'binding_revoked', binding.user_id as string, binding.device_fingerprint as string);
	return c.json({ success: true });
});

// GET /:id/tokenforge/events — audit log
tokenforgeBindingRoutes.get('/:id/tokenforge/events', async (c) => {
	const tenantId = c.req.param('id');
	const db = c.env.DB;
	const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);

	const rows = await db.prepare(
		'SELECT * FROM tokenforge_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
	).bind(tenantId, limit).all();

	return c.json({ events: rows.results ?? [] });
});
