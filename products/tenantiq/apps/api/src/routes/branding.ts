/**
 * White-Label Branding API Routes
 * Manage per-org branding: logo, colors, company name, custom domain.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';

export const brandingRoutes = new Hono<AppEnv>();
brandingRoutes.use('*', authMiddleware);

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const updateBrandingSchema = z.object({
	logoUrl: z.string().url().max(500).nullable().optional(),
	faviconUrl: z.string().url().max(500).nullable().optional(),
	primaryColor: z.string().regex(hexColorRegex, 'Must be hex color').optional(),
	secondaryColor: z.string().regex(hexColorRegex, 'Must be hex color').optional(),
	companyName: z.string().min(1).max(200).optional(),
	customDomain: z.string().max(253).nullable().optional(),
	emailFromName: z.string().max(100).nullable().optional(),
});

// GET /api/branding — get current org branding
brandingRoutes.get('/', async (c) => {
	const user = c.get('user');
	if (!user.orgId) return c.json({ branding: null });

	const row = await c.env.DB.prepare(
		'SELECT * FROM org_branding WHERE org_id = ? LIMIT 1',
	).bind(user.orgId).first().catch(() => null);

	return c.json({ branding: row });
});

// PUT /api/branding — update (upsert) branding
brandingRoutes.put('/', async (c) => {
	const user = c.get('user');
	if (!user.orgId) return c.json({ error: 'No organization' }, 400);

	const body = await c.req.json().catch(() => ({}));
	const parsed = updateBrandingSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0].message }, 422);
	}

	const data = parsed.data;
	const now = Date.now();

	const existing = await c.env.DB.prepare(
		'SELECT id FROM org_branding WHERE org_id = ? LIMIT 1',
	).bind(user.orgId).first().catch(() => null);

	if (existing) {
		const sets: string[] = [];
		const vals: unknown[] = [];
		if (data.primaryColor !== undefined) { sets.push('primary_color = ?'); vals.push(data.primaryColor); }
		if (data.secondaryColor !== undefined) { sets.push('secondary_color = ?'); vals.push(data.secondaryColor); }
		if (data.companyName !== undefined) { sets.push('company_name = ?'); vals.push(data.companyName); }
		if (data.logoUrl !== undefined) { sets.push('logo_url = ?'); vals.push(data.logoUrl); }
		if (data.faviconUrl !== undefined) { sets.push('favicon_url = ?'); vals.push(data.faviconUrl); }
		if (data.customDomain !== undefined) { sets.push('custom_domain = ?'); vals.push(data.customDomain); }
		if (data.emailFromName !== undefined) { sets.push('email_from_name = ?'); vals.push(data.emailFromName); }
		if (sets.length === 0) return c.json({ error: 'No fields to update' }, 422);

		sets.push('updated_at = ?');
		vals.push(now, user.orgId);

		await c.env.DB.prepare(
			`UPDATE org_branding SET ${sets.join(', ')} WHERE org_id = ?`,
		).bind(...vals).run();
	} else {
		const id = crypto.randomUUID();
		await c.env.DB.prepare(
			`INSERT INTO org_branding (id, org_id, logo_url, favicon_url, primary_color, secondary_color, company_name, custom_domain, email_from_name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			id, user.orgId,
			data.logoUrl ?? null, data.faviconUrl ?? null,
			data.primaryColor ?? '#2563eb', data.secondaryColor ?? '#7c3aed',
			data.companyName ?? '', data.customDomain ?? null,
			data.emailFromName ?? null, now, now,
		).run();
	}

	const updated = await c.env.DB.prepare(
		'SELECT * FROM org_branding WHERE org_id = ? LIMIT 1',
	).bind(user.orgId).first().catch(() => null);

	return c.json({ success: true, branding: updated });
});

// POST /api/branding/logo — upload logo to R2, return public URL.
// Body: raw bytes; Content-Type must be png/jpeg/svg+xml; max 2 MB.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const EXT_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/svg+xml': 'svg',
};

// POST /api/branding/custom-domain/init — generate a one-time TXT
// verification token. Caller must publish a TXT record at
// _tenantiq-verify.<customDomain> with the returned token, then call
// /verify. Token is rotated each init.
brandingRoutes.post('/custom-domain/init', async (c) => {
	const user = c.get('user');
	if (!user.orgId) return c.json({ error: 'No organization' }, 400);

	const body = await c.req.json().catch(() => ({})) as { domain?: string };
	const domain = (body.domain ?? '').trim().toLowerCase();
	if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,}$/.test(domain)) {
		return c.json({ error: 'Invalid domain' }, 422);
	}

	const tokenBytes = new Uint8Array(16);
	crypto.getRandomValues(tokenBytes);
	const token = `tenantiq-verify-${[...tokenBytes].map(b => b.toString(16).padStart(2, '0')).join('')}`;

	const now = Date.now();
	const existing = await c.env.DB.prepare('SELECT id FROM org_branding WHERE org_id = ? LIMIT 1')
		.bind(user.orgId).first<{ id: string }>().catch(() => null);

	if (existing) {
		await c.env.DB.prepare(
			'UPDATE org_branding SET custom_domain = ?, custom_domain_verification_token = ?, custom_domain_verified_at = NULL, custom_domain_status = ?, updated_at = ? WHERE org_id = ?',
		).bind(domain, token, 'pending', now, user.orgId).run();
	} else {
		await c.env.DB.prepare(
			`INSERT INTO org_branding (id, org_id, custom_domain, custom_domain_verification_token, custom_domain_status, primary_color, secondary_color, company_name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(crypto.randomUUID(), user.orgId, domain, token, 'pending', '#2563eb', '#7c3aed', '', now, now).run();
	}

	return c.json({
		domain,
		recordType: 'TXT',
		recordName: `_tenantiq-verify.${domain}`,
		recordValue: token,
		instruction: `Publish a TXT record at _tenantiq-verify.${domain} with value "${token}", then POST /api/branding/custom-domain/verify`,
		status: 'pending',
	});
});

// POST /api/branding/custom-domain/verify — re-fetch DNS and mark verified
// if TXT matches. DNS-over-HTTPS via Cloudflare 1.1.1.1.
brandingRoutes.post('/custom-domain/verify', async (c) => {
	const user = c.get('user');
	if (!user.orgId) return c.json({ error: 'No organization' }, 400);

	const row = await c.env.DB.prepare(
		'SELECT custom_domain, custom_domain_verification_token FROM org_branding WHERE org_id = ? LIMIT 1',
	).bind(user.orgId).first<{ custom_domain: string | null; custom_domain_verification_token: string | null }>().catch(() => null);

	if (!row?.custom_domain || !row?.custom_domain_verification_token) {
		return c.json({ error: 'No pending custom-domain challenge — call /init first' }, 400);
	}

	const expected = row.custom_domain_verification_token;
	const dnsName = `_tenantiq-verify.${row.custom_domain}`;
	let txtRecords: string[] = [];
	try {
		const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsName)}&type=TXT`, {
			headers: { Accept: 'application/dns-json' },
		});
		const data = await dns.json() as { Answer?: Array<{ data: string }> };
		txtRecords = (data.Answer ?? []).map(a => a.data.replace(/^"|"$/g, ''));
	} catch (err) {
		return c.json({ error: 'DNS lookup failed', detail: err instanceof Error ? err.message : String(err) }, 502);
	}

	const matched = txtRecords.includes(expected);
	if (!matched) {
		return c.json({
			verified: false,
			expected,
			found: txtRecords,
			message: `No TXT match. Add: ${dnsName} TXT "${expected}"`,
		}, 200);
	}

	const verifiedAt = new Date().toISOString();
	await c.env.DB.prepare(
		'UPDATE org_branding SET custom_domain_verified_at = ?, custom_domain_status = ?, updated_at = ? WHERE org_id = ?',
	).bind(verifiedAt, 'verified', Date.now(), user.orgId).run();

	return c.json({
		verified: true,
		domain: row.custom_domain,
		verifiedAt,
		nextStep: 'Add CNAME for the domain pointing at app.tenantiq.app, then contact support to complete Cloudflare for SaaS hostname registration.',
	});
});

brandingRoutes.post('/logo', async (c) => {
	const user = c.get('user');
	if (!user.orgId) return c.json({ error: 'No organization' }, 400);

	const contentType = (c.req.header('content-type') || '').split(';')[0].trim().toLowerCase();
	if (!ALLOWED_LOGO_TYPES.has(contentType)) {
		return c.json({ error: 'Unsupported media type — png, jpeg, svg only' }, 415);
	}

	const lengthHeader = c.req.header('content-length');
	const declaredLength = lengthHeader ? parseInt(lengthHeader, 10) : 0;
	if (declaredLength > MAX_LOGO_BYTES) {
		return c.json({ error: `Logo too large — max ${MAX_LOGO_BYTES} bytes` }, 413);
	}

	const body = await c.req.arrayBuffer();
	if (body.byteLength === 0) return c.json({ error: 'Empty body' }, 400);
	if (body.byteLength > MAX_LOGO_BYTES) {
		return c.json({ error: `Logo too large — max ${MAX_LOGO_BYTES} bytes` }, 413);
	}

	const ext = EXT_BY_MIME[contentType];
	const key = `branding/${user.orgId}/logo-${Date.now()}.${ext}`;

	await c.env.R2.put(key, body, {
		httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
	});

	const publicBase = c.env.R2_PUBLIC_BASE_URL || 'https://exports.tenantiq.app';
	const logoUrl = `${publicBase}/${key}`;

	const now = Date.now();
	const existing = await c.env.DB.prepare(
		'SELECT id FROM org_branding WHERE org_id = ? LIMIT 1',
	).bind(user.orgId).first().catch(() => null);

	if (existing) {
		await c.env.DB.prepare(
			'UPDATE org_branding SET logo_url = ?, updated_at = ? WHERE org_id = ?',
		).bind(logoUrl, now, user.orgId).run();
	} else {
		await c.env.DB.prepare(
			`INSERT INTO org_branding (id, org_id, logo_url, primary_color, secondary_color, company_name, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(crypto.randomUUID(), user.orgId, logoUrl, '#2563eb', '#7c3aed', '', now, now).run();
	}

	return c.json({ success: true, logoUrl, key, bytes: body.byteLength });
});
