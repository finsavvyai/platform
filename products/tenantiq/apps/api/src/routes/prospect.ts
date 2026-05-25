/**
 * Prospect scan route — public, no auth required.
 *
 * Powers the "drop your domain → get a gap report" landing-page wedge.
 * Rate-limited per IP to keep the endpoint cheap-to-defend (DoH calls are
 * the main cost; 5 scans/hour/IP is generous for genuine prospects and
 * tight enough to discourage abuse).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { runProspectScan, isValidDomain } from '../lib/prospect/public-scan';
import { renderOgCard } from '../lib/prospect/og-card';
import { handleNarratedScan } from '../lib/prospect/narrated-scan';
import { logAgentAction } from '../lib/agent-actions';

export const prospectRoutes = new Hono<AppEnv>();

const scanSchema = z.object({
	domain: z.string().min(3).max(253),
	email: z.string().email().max(254).optional(),
});

const RATE_LIMIT = { perHour: 5, windowSeconds: 3600 };

async function rateLimited(env: AppEnv['Bindings'], ip: string): Promise<boolean> {
	const key = `prospect:rl:${ip}`;
	const raw = await env.KV.get(key);
	const count = raw ? parseInt(raw, 10) : 0;
	if (count >= RATE_LIMIT.perHour) return true;
	await env.KV.put(key, String(count + 1), { expirationTtl: RATE_LIMIT.windowSeconds });
	return false;
}

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
	return (
		c.req.header('cf-connecting-ip') ||
		c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
		'unknown'
	);
}

/**
 * POST /api/prospect/scan
 * Body: { domain: string, email?: string }
 *
 * Returns a ProspectScanResult — see lib/prospect/public-scan.ts.
 * If `email` is supplied, we capture it as a lead.
 */
prospectRoutes.post('/scan', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = scanSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0].message }, 422);
	}

	const { domain, email } = parsed.data;
	if (!isValidDomain(domain)) {
		return c.json({ error: 'Invalid domain format' }, 422);
	}

	const ip = clientIp(c);
	if (await rateLimited(c.env, ip)) {
		return c.json({ error: 'Rate limit exceeded — 5 scans per hour per IP. Sign up for unlimited scans.' }, 429);
	}

	try {
		const result = await runProspectScan(domain);

		await logAgentAction(c.env, {
			agent: 'public-scan', action: 'scan',
			severity: result.score >= 75 ? 'low' : result.score >= 50 ? 'medium' : 'high',
			metadata: { domain, score: result.score, findings: result.findings.length },
		});

		// Capture lead — best-effort, never block the response.
		if (email) {
			try {
				await c.env.DB.prepare(
					`INSERT INTO prospect_leads (id, domain, email, score, findings_count, scanned_at, ip_hash)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				).bind(
					crypto.randomUUID(),
					result.domain,
					email,
					result.score,
					result.findings.length,
					result.scannedAt,
					await sha256Hex(ip),
				).run();
			} catch {
				// Table may not exist yet in older deployments — don't break the scan.
			}
		}

		return c.json(result);
	} catch (err) {
		console.error('[prospect] scan failed:', err);
		return c.json({ error: 'Scan failed' }, 500);
	}
});

/**
 * GET /api/prospect/og.svg?domain=example.com
 * Public, cacheable. Renders an OG card SVG (1200x630) for /scan/:domain
 * social previews. Uses KV-cached scan when available; otherwise runs a
 * fresh scan (rate-limited via the same per-IP bucket).
 */
prospectRoutes.get('/og.svg', async (c) => {
	const domain = c.req.query('domain') ?? '';
	if (!domain || !isValidDomain(domain)) {
		return c.text('Invalid domain', 400);
	}

	const cacheKey = `prospect:og:${domain}`;
	const cached = await c.env.KV.get(cacheKey);
	if (cached) {
		return new Response(cached, {
			headers: {
				'content-type': 'image/svg+xml; charset=utf-8',
				'cache-control': 'public, max-age=86400',
			},
		});
	}

	try {
		const ip = clientIp(c);
		if (await rateLimited(c.env, ip)) {
			return c.text('Rate limit exceeded', 429);
		}
		const result = await runProspectScan(domain);
		const svg = renderOgCard(result);
		await c.env.KV.put(cacheKey, svg, { expirationTtl: 86400 });
		return new Response(svg, {
			headers: {
				'content-type': 'image/svg+xml; charset=utf-8',
				'cache-control': 'public, max-age=86400',
			},
		});
	} catch (err) {
		console.error('[prospect.og] render failed:', err);
		return c.text('Render failed', 500);
	}
});

/**
 * GET /api/prospect/scan/sse?domain=... — agent-narrated scan as SSE.
 * Each stage of the scan emits a `data: {...}` frame so the frontend can
 * render Claude-style narration as the user watches. Same rate limit as POST.
 */
prospectRoutes.get('/scan/sse', async (c) => handleNarratedScan(c));

async function sha256Hex(input: string): Promise<string> {
	const buf = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest('SHA-256', buf);
	return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
