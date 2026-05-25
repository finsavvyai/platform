import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

// Mock external AI package
vi.mock('@tenantiq/ai/tools/anomaly-detection', () => ({
	detectLoginAnomalies: vi.fn(() => [{ severity: 'critical', category: 'login', description: 'Impossible travel' }]),
	detectActivityAnomalies: vi.fn(() => [{ severity: 'high', category: 'activity', description: 'Spike' }]),
	generateAnomalyReport: vi.fn((_tid, _name, anomalies) => ({
		tenantId: _tid,
		anomalies,
		totalAnomalies: anomalies.length,
		riskLevel: 'high',
	})),
}));

import anomalyDetection from './anomaly-detection';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = {
	DB: {} as any,
	KV: mockKV as any,
	JWT_SECRET,
	REMEDIATION_QUEUE: { send: vi.fn() } as any,
} as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

describe('Anomaly Detection Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/anomaly-detection', anomalyDetection);
		authToken = await createTestToken({
			sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/anomaly-detection/scan', () => {
		it('should run scan and return report', async () => {
			const res = await app.request('/api/anomaly-detection/scan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ loginEvents: [{ userId: 'u1', ip: '1.2.3.4' }] }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data).toBeDefined();
			expect(json.timestamp).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/anomaly-detection/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/anomaly-detection/login-check', () => {
		it('should check login events for anomalies', async () => {
			const res = await app.request('/api/anomaly-detection/login-check', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ events: [{ userId: 'u1', ip: '1.2.3.4' }] }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.anomalyCount).toBeDefined();
			expect(json.data.totalEvents).toBe(1);
		});

		it('should return 400 when no events provided', async () => {
			const res = await app.request('/api/anomaly-detection/login-check', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ events: [] }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('POST /api/anomaly-detection/activity-check', () => {
		it('should check activity metrics for anomalies', async () => {
			const res = await app.request('/api/anomaly-detection/activity-check', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: { loginCount: 100, emailsSent: 500 } }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.anomalyCount).toBeDefined();
		});

		it('should return 400 when no metrics provided', async () => {
			const res = await app.request('/api/anomaly-detection/activity-check', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/anomaly-detection/activity-check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: {} }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
