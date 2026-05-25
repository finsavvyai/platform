/**
 * TokenForge webhook receiver.
 *
 * Configure in TokenForge cloud dashboard at:
 *   Endpoint URL: https://api.tenantiq.app/webhooks/tokenforge
 *   Events: session.bound / session.verified / session.revoked /
 *           trust_score.degraded / trust_score.critical / session.hijack_attempt
 *
 * Stores each event in `tf_webhook_events` for display on /security/sessions.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

export const tfWebhookRoutes = new Hono<AppEnv>();

interface TfEventPayload {
	id?: string;
	type?: string;
	event?: string;
	userId?: string;
	sessionId?: string;
	deviceId?: string;
	trustScore?: number;
	ipAddress?: string;
	countryCode?: string;
	userAgent?: string;
	reason?: string;
	[k: string]: unknown;
}

tfWebhookRoutes.post('/tokenforge', async (c) => {
	const env = c.env as { TOKENFORGE_WEBHOOK_SECRET?: string; TOKENFORGE_WEBHOOK_SECRET_PREVIOUS?: string };
	const expectedSecret = env.TOKENFORGE_WEBHOOK_SECRET;
	// Accept canonical `X-TF-Signature` (opensyber dispatcher) + legacy aliases.
	const signature = c.req.header('X-TF-Signature')
		?? c.req.header('X-TokenForge-Signature')
		?? c.req.header('X-Webhook-Signature');
	const timestamp = c.req.header('X-TF-Timestamp');
	const rawBody = await c.req.text();

	if (expectedSecret) {
		if (!signature) return c.json({ error: 'missing_signature' }, 401);

		// Freshness window (5 min) — blocks replay of captured deliveries.
		if (timestamp) {
			const ts = Date.parse(timestamp);
			if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) {
				return c.json({ error: 'stale_timestamp' }, 401);
			}
		}

		const signedString = timestamp ? `${timestamp}.${rawBody}` : rawBody;
		const secretsToTry = [expectedSecret, env.TOKENFORGE_WEBHOOK_SECRET_PREVIOUS].filter((s): s is string => !!s);

		let valid = false;
		for (const secret of secretsToTry) {
			const expected = await hmacHex(secret, signedString);
			if (signatureMatches(signature, expected)) { valid = true; break; }
		}
		if (!valid) return c.json({ error: 'bad_signature' }, 401);
	}

	interface DispatcherEnvelope { event?: string; type?: string; tenantId?: string; deliveryId?: string; data?: TfEventPayload }
	let body: DispatcherEnvelope & TfEventPayload;
	try { body = JSON.parse(rawBody); } catch { return c.json({ error: 'bad_json' }, 400); }

	// opensyber dispatcher nests entity fields under `data`; legacy callers put them at top level.
	const d = body.data ?? {};
	const eventType = body.event ?? body.type ?? 'unknown';
	const id = body.deliveryId ?? body.id ?? crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);

	const pick = <K extends keyof TfEventPayload>(k: K): TfEventPayload[K] | undefined => (d[k] ?? body[k]);

	await c.env.DB
		.prepare(
			`INSERT OR IGNORE INTO tf_webhook_events
			 (id, event_type, user_id, session_id, device_id, trust_score, ip_address, country_code, user_agent, reason, payload, received_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			eventType,
			pick('userId') ?? null,
			pick('sessionId') ?? null,
			pick('deviceId') ?? null,
			pick('trustScore') ?? null,
			pick('ipAddress') ?? null,
			pick('countryCode') ?? null,
			pick('userAgent') ?? null,
			pick('reason') ?? null,
			rawBody,
			now,
		)
		.run();

	return c.json({ received: true, id });
});

async function hmacHex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function signatureMatches(header: string, expected: string): boolean {
	// Dispatcher sends one or more `v1,<hex>` entries (space-separated) during
	// rotation. Legacy callers may send bare hex. Accept any match.
	const entries = header.split(/\s+/).filter(Boolean);
	for (const entry of entries) {
		const [v, hex] = entry.includes(',') ? entry.split(',') : ['v1', entry];
		if (v === 'v1' && hex && hex.toLowerCase() === expected) return true;
	}
	return false;
}

/** GET /webhooks/tokenforge/events — list recent events for the current user's org. */
tfWebhookRoutes.get('/tokenforge/events', async (c) => {
	const user = c.get('user');
	if (!user) return c.json({ events: [] });
	const result = await c.env.DB
		.prepare(
			`SELECT id, event_type, user_id, session_id, device_id, trust_score,
			        ip_address, country_code, reason, received_at
			 FROM tf_webhook_events
			 WHERE user_id IN (SELECT azure_oid FROM platform_users WHERE organization_id = ?)
			    OR user_id = ?
			 ORDER BY received_at DESC LIMIT 100`,
		)
		.bind(user.orgId, user.sub)
		.all()
		.catch(() => ({ results: [] as any[] }));
	return c.json({ events: result.results });
});
