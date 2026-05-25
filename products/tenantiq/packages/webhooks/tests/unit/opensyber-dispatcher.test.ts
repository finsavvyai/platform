/**
 * Unit tests for the OpenSyber outbound dispatcher.
 *
 * The receiver lives at:
 *   opensyber/apps/api/src/routes/integrations/tenantiq.ts
 * and validates:
 *   - X-TenantIQ-Signature: sha256=<hex(HMAC-SHA256(rawBody))>
 *   - body shape via the zod schema mirrored below
 *
 * We mirror a minimal copy of that zod schema here so a wire-format change
 * on either side breaks these tests immediately.
 */

import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';

import {
	buildTenantiqPayload,
	dispatchToOpenSyber,
	signOpenSyberPayload,
	type DispatchableCandidate,
	type TenantiqWirePayload,
} from '../../src/opensyber-dispatcher';

// --- Mirrored receiver schema (kept in lockstep with opensyber receiver) ---
// Plain validation — no extra deps. If the receiver's zod schema changes,
// update this checker so a contract drift breaks tests immediately.
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const CATEGORIES = new Set(['security', 'optimization', 'compliance', 'operational']);
const SOURCES = new Set(['intel-engine', 'remediation', 'compliance-scan', 'drift-detection']);

function validateReceiverShape(payload: unknown): { ok: true } | { ok: false; reason: string } {
	if (!payload || typeof payload !== 'object') return { ok: false, reason: 'not-object' };
	const p = payload as Record<string, unknown>;
	if (typeof p.tenant_id !== 'string') return { ok: false, reason: 'tenant_id' };
	if (typeof p.evaluated_at !== 'string') return { ok: false, reason: 'evaluated_at' };
	if (typeof p.connection_name !== 'string') return { ok: false, reason: 'connection_name' };
	if (typeof p.source !== 'string' || !SOURCES.has(p.source)) return { ok: false, reason: 'source' };
	if (!Array.isArray(p.alerts)) return { ok: false, reason: 'alerts' };
	for (const a of p.alerts as Record<string, unknown>[]) {
		if (typeof a.rule_id !== 'string') return { ok: false, reason: 'rule_id' };
		if (typeof a.severity !== 'string' || !SEVERITIES.has(a.severity)) return { ok: false, reason: 'severity' };
		if (typeof a.category !== 'string' || !CATEGORIES.has(a.category)) return { ok: false, reason: 'category' };
		if (typeof a.title !== 'string') return { ok: false, reason: 'title' };
		if (typeof a.description !== 'string') return { ok: false, reason: 'description' };
		if (a.business_impact !== null && typeof a.business_impact !== 'string') return { ok: false, reason: 'business_impact' };
		if (a.recommended_action !== null && typeof a.recommended_action !== 'string') return { ok: false, reason: 'recommended_action' };
		if (typeof a.affected_resources_count !== 'number' || !Number.isInteger(a.affected_resources_count) || a.affected_resources_count < 0) return { ok: false, reason: 'affected_resources_count' };
		if (typeof a.tenant_id !== 'string') return { ok: false, reason: 'alert.tenant_id' };
	}
	return { ok: true };
}

const sampleCandidate = (over: Partial<DispatchableCandidate> = {}): DispatchableCandidate => ({
	ruleId: 'SEC-001',
	severity: 'critical',
	category: 'security',
	title: 'Inactive Global Admin',
	description: 'Detected an inactive Global Admin account',
	businessImpact: 'High blast radius if compromised',
	recommendedAction: 'Disable account or enforce step-up auth',
	affectedResources: [{ id: 'u-1' }, { id: 'u-2' }],
	...over,
});

describe('buildTenantiqPayload', () => {
	it('produces snake_case payload that matches the receiver zod schema', () => {
		const payload = buildTenantiqPayload(
			[sampleCandidate(), sampleCandidate({ ruleId: 'CMP-001', severity: 'medium', category: 'compliance' })],
			'tenant-abc',
			'intel-engine',
			'prod-msp-1',
			'2026-04-26T20:00:00.000Z',
		);
		const parsed = validateReceiverShape(payload);
		expect(parsed.ok).toBe(true);
		expect(payload.alerts[0].rule_id).toBe('SEC-001');
		expect(payload.alerts[0].affected_resources_count).toBe(2);
		expect(payload.alerts[0].tenant_id).toBe('tenant-abc');
		expect(payload.connection_name).toBe('prod-msp-1');
		expect(payload.source).toBe('intel-engine');
	});

	it('defaults affected_resources_count to 0 when affectedResources missing', () => {
		const payload = buildTenantiqPayload(
			[sampleCandidate({ affectedResources: undefined })],
			't',
			'remediation',
			'c',
		);
		expect(payload.alerts[0].affected_resources_count).toBe(0);
		expect(validateReceiverShape(payload).ok).toBe(true);
	});
});

describe('signOpenSyberPayload', () => {
	it('produces sha256=<hex> matching node createHmac (receiver-compatible)', async () => {
		const secret = 'super-secret';
		const body = JSON.stringify({ hello: 'world' });
		const sig = await signOpenSyberPayload(secret, body);
		const expectedHex = createHmac('sha256', secret).update(body).digest('hex');
		expect(sig).toBe(`sha256=${expectedHex}`);
	});
});

function makeFetchMock(responses: Array<{ status: number; body?: string } | Error>) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		const idx = calls.length;
		calls.push({ url: String(url), init: init ?? {} });
		const r = responses[Math.min(idx, responses.length - 1)];
		if (r instanceof Error) throw r;
		return new Response(r.body ?? '', { status: r.status });
	});
	return { fetch: fn as unknown as typeof fetch, calls };
}

describe('dispatchToOpenSyber', () => {
	const baseConfig = {
		opensyber_url: 'https://api.opensyber.test',
		secret: 'shared-secret',
		connection_name: 'tenantiq-prod',
	};
	const samplePayload = (): TenantiqWirePayload =>
		buildTenantiqPayload([sampleCandidate()], 't1', 'intel-engine', 'tenantiq-prod', 'now');

	it('signs the body with the configured secret and sends to the findings endpoint', async () => {
		const { fetch, calls } = makeFetchMock([{ status: 202, body: '{"received":true}' }]);
		const payload = samplePayload();
		const res = await dispatchToOpenSyber(baseConfig, payload, { fetchImpl: fetch });
		expect(res.ok).toBe(true);
		expect(res.status).toBe(202);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://api.opensyber.test/api/integrations/tenantiq/findings');
		const headers = calls[0].init.headers as Record<string, string>;
		const expected =
			'sha256=' +
			createHmac('sha256', baseConfig.secret).update(JSON.stringify(payload)).digest('hex');
		expect(headers['X-TenantIQ-Signature']).toBe(expected);
		expect(headers['Content-Type']).toBe('application/json');
	});

	it('does not retry on 4xx (signature/payload errors will not change)', async () => {
		const { fetch, calls } = makeFetchMock([
			{ status: 401, body: '{"error":"Invalid signature"}' },
		]);
		const sleep = vi.fn(async () => {});
		const res = await dispatchToOpenSyber(baseConfig, samplePayload(), {
			fetchImpl: fetch,
			sleep,
			maxRetries: 3,
		});
		expect(res.ok).toBe(false);
		expect(res.status).toBe(401);
		expect(res.attempts).toBe(1);
		expect(calls).toHaveLength(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it('retries on 5xx with exponential backoff up to maxRetries', async () => {
		const { fetch, calls } = makeFetchMock([
			{ status: 500 },
			{ status: 502 },
			{ status: 202, body: 'ok' },
		]);
		const sleep = vi.fn(async () => {});
		const res = await dispatchToOpenSyber(baseConfig, samplePayload(), {
			fetchImpl: fetch,
			sleep,
			maxRetries: 3,
			baseDelayMs: 10,
		});
		expect(res.ok).toBe(true);
		expect(res.attempts).toBe(3);
		expect(calls).toHaveLength(3);
		expect(sleep).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenNthCalledWith(1, 10);
		expect(sleep).toHaveBeenNthCalledWith(2, 20);
	});

	it('gives up after maxRetries on persistent 5xx', async () => {
		const { fetch, calls } = makeFetchMock([{ status: 500 }, { status: 500 }, { status: 500 }]);
		const sleep = vi.fn(async () => {});
		const res = await dispatchToOpenSyber(baseConfig, samplePayload(), {
			fetchImpl: fetch,
			sleep,
			maxRetries: 3,
			baseDelayMs: 5,
		});
		expect(res.ok).toBe(false);
		expect(res.status).toBe(500);
		expect(res.attempts).toBe(3);
		expect(calls).toHaveLength(3);
	});

	it('retries on network/throw errors', async () => {
		const { fetch, calls } = makeFetchMock([
			new Error('network down'),
			{ status: 202, body: 'ok' },
		]);
		const sleep = vi.fn(async () => {});
		const res = await dispatchToOpenSyber(baseConfig, samplePayload(), {
			fetchImpl: fetch,
			sleep,
			maxRetries: 3,
			baseDelayMs: 1,
		});
		expect(res.ok).toBe(true);
		expect(res.attempts).toBe(2);
		expect(calls).toHaveLength(2);
	});
});
