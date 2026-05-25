import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { alertRoutes } from './alerts';

// ============================================================
// Mocks — aligned with the actual Drizzle-based alerts.ts
// ============================================================

// Query result queue: each await on the DB chain consumes the next entry
let queryResults: any[];

// Chainable DB mock (mirrors Drizzle select/update/insert chains)
const chainMethods = ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values'];
const mockDbChain: any = {};
for (const method of chainMethods) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
// Make the chain awaitable — resolves with next queued result
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: any) => resolve(queryResults.shift() ?? []);
	},
	configurable: true
});

const mockKV = {
	get: vi.fn(),
	put: vi.fn(),
	delete: vi.fn(),
};

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockEnv = {
	DB: {} as any,
	KV: mockKV as any,
	REMEDIATION_QUEUE: { send: vi.fn() } as any,
	JWT_SECRET
};

// Mock drizzle-orm operators (no-op; our chain ignores arguments)
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._args: any[]) => ({})),
	desc: vi.fn(() => ({}))
}));

// Mock db module — return chainable mock and stub schema references
vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		alerts: { tenantId: {}, severity: {}, type: {}, status: {}, id: {}, createdAt: {} },
		alertHistory: { alertId: {}, timestamp: {}, id: {}, status: {}, updatedBy: {}, notes: {} }
	}
}));

// Helper to create auth token
async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return await new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

// Sample alert data
const sampleAlerts = [
	{
		id: 'alert-1',
		tenantId: 'tenant-1',
		severity: 'high',
		type: 'optimization',
		title: 'Inactive user with licenses',
		status: 'active',
		createdAt: new Date().toISOString()
	},
	{
		id: 'alert-2',
		tenantId: 'tenant-1',
		severity: 'critical',
		type: 'security',
		title: 'MFA not enforced',
		status: 'active',
		createdAt: new Date().toISOString()
	}
];

// ============================================================
// Tests — matching the actual routes in alerts.ts:
//   GET  /           → { alerts, count }
//   GET  /:alertId   → { alert, history }
//   PATCH /:alertId  → { message, alertId, status }
// ============================================================

describe('Alerts Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/alerts', alertRoutes);

		// Token must include tenantId (singular) for auth.middleware.ts
		authToken = await createTestToken({
			sub: 'user-1',
			email: 'admin@test.com',
			tenantId: 'tenant-1',
			role: 'admin'
		});

		// Rate limiter reads KV counter
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	// ========================================
	// GET /api/alerts
	// ========================================
	describe('GET /api/alerts', () => {
		it('should return list of alerts with count', async () => {
			queryResults = [sampleAlerts];

			const res = await app.request('/api/alerts', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.alerts).toHaveLength(2);
			expect(json.count).toBe(2);
		});

		it('should accept severity filter', async () => {
			queryResults = [[sampleAlerts[1]]];

			const res = await app.request('/api/alerts?severity=critical', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.alerts).toBeDefined();
		});

		it('should accept status filter', async () => {
			queryResults = [sampleAlerts];

			const res = await app.request('/api/alerts?status=active', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
		});

		it('should accept type filter', async () => {
			queryResults = [[sampleAlerts[0]]];

			const res = await app.request('/api/alerts?type=optimization', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
		});

		it('should return empty array when no alerts match', async () => {
			queryResults = [[]];

			const res = await app.request('/api/alerts', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.alerts).toHaveLength(0);
			expect(json.count).toBe(0);
		});

		it('should return prioritized alerts when prioritize=true', async () => {
			queryResults = [[
				{
					...sampleAlerts[0],
					id: 'opt-low',
					severity: 'low',
					type: 'optimization',
					affectedUsers: 1,
					estimatedRiskScore: 20,
					metadata: null,
				},
				{
					...sampleAlerts[1],
					id: 'sec-critical',
					severity: 'critical',
					type: 'security',
					affectedUsers: 40,
					estimatedRiskScore: 95,
					metadata: JSON.stringify({
						exploitability: 'active',
						exposedToInternet: true,
						privilegeEscalationPath: true,
						secretsExposure: true,
						lateralMovementPathCount: 3,
						controlCoverageGap: 0.8,
					}),
				},
			]];

			const res = await app.request('/api/alerts?prioritize=true', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.prioritized).toBe(true);
			expect(json.alerts[0].id).toBe('sec-critical');
			expect(json.alerts[0].priorityScore).toBeGreaterThan(json.alerts[1].priorityScore);
			expect(Array.isArray(json.alerts[0].priorityRationale)).toBe(true);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/alerts', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/alerts/:alertId
	// ========================================
	describe('GET /api/alerts/:alertId', () => {
		it('should return alert details with history', async () => {
			queryResults = [
				[sampleAlerts[0]],
				[{ id: 'h1', alertId: 'alert-1', status: 'created', timestamp: new Date().toISOString() }]
			];

			const res = await app.request('/api/alerts/alert-1', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.alert).toHaveProperty('id', 'alert-1');
			expect(json.history).toBeDefined();
			expect(json.history).toHaveLength(1);
		});

		it('should return 404 for non-existent alert', async () => {
			queryResults = [[]];

			const res = await app.request('/api/alerts/non-existent', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(404);
			const json: any = await res.json();
			expect(json.error).toBe('Not Found');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/alerts/alert-1', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// PATCH /api/alerts/:alertId
	// ========================================
	describe('PATCH /api/alerts/:alertId', () => {
		it('should update alert status to acknowledged', async () => {
			queryResults = [[sampleAlerts[0]], undefined, undefined];

			const res = await app.request('/api/alerts/alert-1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'acknowledged' })
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.message).toBe('Alert updated successfully');
			expect(json.alertId).toBe('alert-1');
			expect(json.status).toBe('acknowledged');
		});

		it('should update alert status to resolved', async () => {
			queryResults = [[sampleAlerts[0]], undefined, undefined];

			const res = await app.request('/api/alerts/alert-1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'resolved' })
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.status).toBe('resolved');
		});

		it('should update alert status to dismissed', async () => {
			queryResults = [[sampleAlerts[0]], undefined, undefined];

			const res = await app.request('/api/alerts/alert-1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'dismissed' })
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.status).toBe('dismissed');
		});

		it('should reject invalid status', async () => {
			const res = await app.request('/api/alerts/alert-1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'invalid-status' })
			}, mockEnv);

			expect(res.status).toBe(400);
			const json: any = await res.json();
			expect(json.error).toBe('Bad Request');
		});

		it('should return 404 for non-existent alert', async () => {
			queryResults = [[]];

			const res = await app.request('/api/alerts/non-existent', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'acknowledged' })
			}, mockEnv);

			expect(res.status).toBe(404);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/alerts/alert-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'acknowledged' })
			}, mockEnv);

			expect(res.status).toBe(401);
		});

		it('should require operator role or above', async () => {
			const viewerToken = await createTestToken({
				sub: 'user-2',
				email: 'viewer@test.com',
				tenantId: 'tenant-1',
				role: 'viewer'
			});

			const res = await app.request('/api/alerts/alert-1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${viewerToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'acknowledged' })
			}, mockEnv);

			expect(res.status).toBe(403);
		});
	});
});
