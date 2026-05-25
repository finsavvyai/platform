import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import compliancePosture from './compliance-posture';

vi.mock('@tenantiq/ai/tools/compliance-posture', () => ({
	assessCompliancePosture: vi.fn().mockReturnValue({
		overallScore: 72,
		overallGrade: 'B',
		criticalGaps: [],
		auditReadiness: { ready: true },
		recommendations: ['Enable MFA'],
	}),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = {
	DB: { prepare: vi.fn() } as any,
	KV: mockKV as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Compliance Posture — /frameworks', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/compliance-posture', compliancePosture);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	it('requires auth', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
		}, mockEnv);
		expect(res.status).toBe(401);
	});

	it('returns all 4 frameworks (SOC 2 / HIPAA / GDPR / ISO 27001)', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.frameworks).toHaveLength(4);
	});

	it('includes SOC 2, HIPAA, GDPR, and ISO 27001 frameworks', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();
		const names = json.data.frameworks.map((f: any) => f.framework);
		expect(names).toContain('SOC 2');
		expect(names).toContain('HIPAA');
		expect(names).toContain('GDPR');
		expect(names).toContain('ISO 27001');
	});

	it('each framework has controls with pass/fail/partial', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();

		for (const fw of json.data.frameworks) {
			expect(fw.controls.length).toBeGreaterThan(0);
			expect(fw.score).toBeGreaterThanOrEqual(0);
			expect(fw.score).toBeLessThanOrEqual(100);
			expect(typeof fw.passCount).toBe('number');
			expect(typeof fw.failCount).toBe('number');
			expect(typeof fw.partialCount).toBe('number');

			for (const ctrl of fw.controls) {
				expect(['pass', 'fail', 'partial']).toContain(ctrl.status);
				expect(ctrl.id).toBeTruthy();
				expect(ctrl.name).toBeTruthy();
				expect(ctrl.evidence).toBeTruthy();
				expect(ctrl.framework).toBe(fw.framework);
			}
		}
	});

	it('uses cached security data from KV when available', async () => {
		const cachedData = {
			mfaRate: 1.0,
			caEnabled: 5,
			caTotal: 5,
			auditEnabled: true,
			dlpPolicies: 3,
			sensitivityLabels: 5,
			secureScore: 90,
			riskyUsers: 0,
			backupConfigured: true,
			encryptionEnabled: true,
		};
		mockKV.get.mockResolvedValue(cachedData);

		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();

		// With perfect data, scores should be high
		for (const fw of json.data.frameworks) {
			expect(fw.score).toBeGreaterThanOrEqual(80);
		}
	});

	it('returns timestamp in response', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();
		expect(json.timestamp).toBeDefined();
		expect(new Date(json.timestamp).getTime()).not.toBeNaN();
	});

	it('SOC 2 has 8 controls', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();
		const soc2 = json.data.frameworks.find((f: any) => f.framework === 'SOC 2');
		expect(soc2.controls).toHaveLength(8);
	});

	it('HIPAA has 11 controls', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();
		const hipaa = json.data.frameworks.find((f: any) => f.framework === 'HIPAA');
		expect(hipaa.controls).toHaveLength(11);
	});

	it('GDPR has 8 controls', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();
		const gdpr = json.data.frameworks.find((f: any) => f.framework === 'GDPR');
		expect(gdpr.controls).toHaveLength(8);
	});

	it('failing controls include remediation guidance', async () => {
		const res = await app.request('/api/compliance-posture/frameworks', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		const json: any = await res.json();

		for (const fw of json.data.frameworks) {
			const failing = fw.controls.filter((c: any) => c.status !== 'pass');
			for (const ctrl of failing) {
				expect(ctrl.remediation).toBeTruthy();
			}
		}
	});
});
