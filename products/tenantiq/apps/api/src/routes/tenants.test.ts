import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { tenantRoutes } from './tenants';
import * as jose from 'jose';
import { AppError } from '../lib/errors';

// ============================================================
// Mocks
// ============================================================

function createMockD1() {
	const chainable = {
		bind: vi.fn(function (this: any) { return this; }),
		all: vi.fn(() => Promise.resolve({ results: [] })),
		first: vi.fn(() => Promise.resolve(null)),
		run: vi.fn(() => Promise.resolve({ success: true })),
	};
	// Each prepare() call returns a fresh chainable so mocks don't collide
	const prepare = vi.fn(() => ({
		bind: vi.fn(function (this: any) { return this; }),
		all: vi.fn(() => Promise.resolve({ results: [] })),
		first: vi.fn(() => Promise.resolve(null)),
		run: vi.fn(() => Promise.resolve({ success: true })),
	}));
	return { prepare, _defaultChain: chainable };
}

const mockKV = {
	get: vi.fn(),
	put: vi.fn(),
	delete: vi.fn()
};

const mockQueue = {
	send: vi.fn()
};

const mockDurableObject = {
	fetch: vi.fn(() => new Response('SSE stream', {
		headers: { 'Content-Type': 'text/event-stream' }
	}))
};

const mockDurableObjectNamespace = {
	idFromName: vi.fn(() => 'durable-id-123'),
	get: vi.fn(() => mockDurableObject)
};

let mockD1: ReturnType<typeof createMockD1>;

const mockEnv = {
	DB: null as any,
	KV: mockKV as any,
	SCAN_QUEUE: mockQueue as any,
	TENANT_EVENTS: mockDurableObjectNamespace as any,
	JWT_SECRET: 'test-jwt-secret-key-minimum-32-characters-long'
};

// Mock the db module (used by getDb for Drizzle-wrapped routes)
const mockDrizzleDb = {
	select: vi.fn(() => ({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(() => Promise.resolve([]))
			})),
			leftJoin: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve([]))
			}))
		}))
	})),
	insert: vi.fn(() => ({
		values: vi.fn(() => ({
			returning: vi.fn(() => Promise.resolve([]))
		}))
	})),
	update: vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn(() => Promise.resolve())
		}))
	}))
};

vi.mock('../lib/db', () => ({
	getDb: () => mockDrizzleDb
}));

// Mock db functions
vi.mock('@tenantiq/db', () => ({
	getTenantsByOrganization: vi.fn((_db, orgId) => Promise.resolve([
		{
			id: 'tenant-1',
			azureTenantId: 'azure-tenant-1',
			displayName: 'Test Tenant 1',
			domain: 'test1.com',
			status: 'active',
			organizationId: orgId,
			lastSyncAt: new Date(),
			createdAt: new Date()
		},
		{
			id: 'tenant-2',
			azureTenantId: 'azure-tenant-2',
			displayName: 'Test Tenant 2',
			domain: 'test2.com',
			status: 'active',
			organizationId: orgId,
			lastSyncAt: new Date(),
			createdAt: new Date()
		}
	])),
	getTenantById: vi.fn((_db, id) => {
		if (id === 'tenant-1') {
			return Promise.resolve({
				id: 'tenant-1',
				azureTenantId: 'azure-tenant-1',
				displayName: 'Test Tenant 1',
				domain: 'test1.com',
				status: 'active',
				organizationId: 'org-1',
				lastSyncAt: new Date(),
				createdAt: new Date()
			});
		}
		return Promise.resolve(null);
	}),
	createTenant: vi.fn((_db, data) => Promise.resolve({
		id: 'new-tenant-id',
		azureTenantId: data.azureTenantId,
		displayName: data.displayName,
		domain: data.domain,
		status: data.status,
		organizationId: data.organizationId,
		createdAt: new Date()
	})),
	disconnectTenant: vi.fn(() => Promise.resolve()),
	updateTenantSyncTime: vi.fn(() => Promise.resolve()),
	getAlertCountsByTenant: vi.fn(() => Promise.resolve({
		critical: 5,
		high: 12,
		medium: 23,
		low: 8
	})),
	getUsersByTenant: vi.fn(() => Promise.resolve([
		{ id: 'u1', displayName: 'User 1', email: 'user1@test.com', accountEnabled: true },
		{ id: 'u2', displayName: 'User 2', email: 'user2@test.com', accountEnabled: true },
		{ id: 'u3', displayName: 'User 3', email: 'user3@test.com', accountEnabled: false }
	])),
	getLicensesByTenant: vi.fn(() => Promise.resolve([
		{ id: 'l1', skuName: 'Office 365 E3', total: 100, assigned: 85, costPerUnit: '20.00' },
		{ id: 'l2', skuName: 'Office 365 E5', total: 50, assigned: 48, costPerUnit: '35.00' }
	])),
	getLicenseWaste: vi.fn(() => Promise.resolve([
		{ skuName: 'Office 365 E3', unused: 15, monthlyCost: 300 },
		{ skuName: 'Office 365 E5', unused: 2, monthlyCost: 70 }
	]))
}));

// Mock graph-sync for sync endpoint
vi.mock('../lib/graph-sync', () => ({
	syncTenantData: vi.fn(() => Promise.resolve({
		users: 10,
		licenses: 5,
		errors: []
	}))
}));

// Mock graph-client for sync endpoint
vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn(() => ({
		fetch: vi.fn()
	}))
}));

// Mock workspace-sync for sync endpoint
vi.mock('../lib/governance/workspace-sync', () => ({
	syncWorkspaces: vi.fn(() => Promise.resolve({ count: 3, errors: [] }))
}));

// Mock remediation-helpers
vi.mock('../lib/remediation-helpers', () => ({
	generateImpactExplanation: vi.fn(() => 'impact'),
	generateAffectedResources: vi.fn(() => []),
	generateRemediationSteps: vi.fn(() => []),
	generatePositiveOutcomes: vi.fn(() => []),
	generateNegativeOutcomes: vi.fn(() => []),
	generateUserEffects: vi.fn(() => []),
}));

// Mock backup module
vi.mock('../lib/backup', () => ({
	createTenantBackup: vi.fn(),
	restoreTenantBackup: vi.fn(),
	listTenantBackups: vi.fn(() => Promise.resolve([])),
	cleanupOldBackups: vi.fn(),
}));

// Helper to create auth token
async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
	return await new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

// ============================================================
// Tests
// ============================================================

describe('Tenants Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockD1 = createMockD1();
		mockEnv.DB = mockD1 as any;
		app = new Hono<AppEnv>();
		app.route('/api/tenants', tenantRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});

		// Create valid auth token
		authToken = await createTestToken({
			sub: 'user-1',
			email: 'admin@test.com',
			name: 'Admin User',
			orgId: 'org-1',
			tenantIds: ['tenant-1', 'tenant-2'],
			role: 'admin'
		});

		// Mock KV session storage
		mockKV.get.mockResolvedValue(authToken);
	});

	// ========================================
	// GET /api/tenants - List tenants
	// ========================================
	describe('GET /api/tenants', () => {
		it('should return list of tenants for organization', async () => {
			// The route uses raw D1: db.prepare('SELECT * FROM tenants WHERE organization_id = ?')
			const prepareResult = {
				bind: vi.fn(() => prepareResult),
				all: vi.fn(() => Promise.resolve({
					results: [
						{ id: 'tenant-1', organization_id: 'org-1', azure_tenant_id: 'at-1', display_name: 'Test Tenant 1', domain: 'test1.com', status: 'active', last_sync_at: null, created_at: Date.now() },
						{ id: 'tenant-2', organization_id: 'org-1', azure_tenant_id: 'at-2', display_name: 'Test Tenant 2', domain: 'test2.com', status: 'active', last_sync_at: null, created_at: Date.now() },
					]
				})),
				first: vi.fn(),
				run: vi.fn(),
			};
			mockD1.prepare.mockReturnValueOnce(prepareResult as any);

			const res = await app.request('/api/tenants', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.tenants).toHaveLength(2);
			expect(json.tenants[0]).toHaveProperty('id', 'tenant-1');
			expect(json.tenants[0]).toHaveProperty('displayName', 'Test Tenant 1');
			expect(json.tenants[1]).toHaveProperty('id', 'tenant-2');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});

		it('should reject invalid token', async () => {
			const res = await app.request('/api/tenants', {
				method: 'GET',
				headers: {
					Authorization: 'Bearer invalid-token'
				}
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// POST /api/tenants - Onboard tenant
	// ========================================
	describe('POST /api/tenants', () => {
		it('should onboard new tenant with valid data', async () => {
			const newTenant = {
				azureTenantId: 'new-azure-tenant-id',
				displayName: 'New Tenant Corp',
				domain: 'newtenant.com'
			};

			const res = await app.request('/api/tenants', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(newTenant)
			}, mockEnv);

			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.tenant).toHaveProperty('displayName', 'New Tenant Corp');
			expect(json).toHaveProperty('token');

			// Verify token was stored in KV
			expect(mockKV.put).toHaveBeenCalledWith(
				'session:user-1',
				expect.any(String),
				{ expirationTtl: 86400 }
			);

			// Verify new token includes new tenant ID
			const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
			const { payload } = await jose.jwtVerify(json.token, secret);
			expect(payload.tenantIds).toContain('tenant-1');
			expect(payload.tenantIds).toContain('tenant-2');
		});

		it('should reject invalid request body', async () => {
			const res = await app.request('/api/tenants', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					displayName: 'Missing Required Fields'
					// Missing azureTenantId
				})
			}, mockEnv);

			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toBe('Invalid request body');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					azureTenantId: 'test',
					displayName: 'Test',
					domain: 'test.com'
				})
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/tenants/:id - Get tenant details
	// ========================================
	describe('GET /api/tenants/:id', () => {
		it('should return tenant details by ID', async () => {
			const res = await app.request('/api/tenants/tenant-1', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.tenant).toHaveProperty('id', 'tenant-1');
			expect(json.tenant).toHaveProperty('displayName', 'Test Tenant 1');
			expect(json.tenant).toHaveProperty('domain', 'test1.com');
		});

		it('should return 403 for tenant not in user access list', async () => {
			const res = await app.request('/api/tenants/non-existent', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(403);
			const json: any = await res.json();
			expect(json.error.message).toBe('You do not have access to this tenant');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});

		it('grants access when JWT is stale but DB confirms tenant belongs to org', async () => {
			// JWT minted before tenant was provisioned (e.g., admin-consent or marketplace
			// activation happened after sign-in). tenantIds in JWT is empty/short, but DB
			// shows the tenant is owned by the user's org → fallback should permit.
			const staleToken = await createTestToken({
				sub: 'user-1', email: 'admin@test.com', name: 'Admin User',
				orgId: 'org-1', tenantIds: [], role: 'admin', // empty tenantIds
			});

			// First query: fallback ownership check returns the tenant row
			const fallback = {
				bind: vi.fn(function (this: any) { return this; }),
				all: vi.fn(() => Promise.resolve({ results: [] })),
				first: vi.fn(() => Promise.resolve({ id: 'tenant-1' })), // DB confirms
				run: vi.fn(() => Promise.resolve({ success: true })),
			};
			mockD1.prepare.mockReturnValueOnce(fallback as any);

			const res = await app.request('/api/tenants/tenant-1', {
				method: 'GET', headers: { Authorization: `Bearer ${staleToken}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			// Signals to the frontend that it should call /auth/refresh in the background.
			expect(res.headers.get('X-Refresh-Session')).toBe('1');
		});

		it('denies access when JWT is stale AND DB shows tenant does not belong to org', async () => {
			const staleToken = await createTestToken({
				sub: 'user-1', email: 'admin@test.com', name: 'Admin User',
				orgId: 'org-1', tenantIds: [], role: 'admin',
			});

			// DB fallback returns null — tenant doesn't belong to this org
			const fallback = {
				bind: vi.fn(function (this: any) { return this; }),
				all: vi.fn(() => Promise.resolve({ results: [] })),
				first: vi.fn(() => Promise.resolve(null)),
				run: vi.fn(() => Promise.resolve({ success: true })),
			};
			mockD1.prepare.mockReturnValueOnce(fallback as any);

			const res = await app.request('/api/tenants/some-other-org-tenant', {
				method: 'GET', headers: { Authorization: `Bearer ${staleToken}` },
			}, mockEnv);

			expect(res.status).toBe(403);
		});
	});

	// ========================================
	// DELETE /api/tenants/:id - Disconnect tenant
	// ========================================
	describe('DELETE /api/tenants/:id', () => {
		it('should disconnect tenant successfully', async () => {
			const res = await app.request('/api/tenants/tenant-1', {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.success).toBe(true);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1', {
				method: 'DELETE'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// POST /api/tenants/:id/sync - Force sync
	// ========================================
	describe('POST /api/tenants/:id/sync', () => {
		it('should run sync for tenant', async () => {
			// Mock DB: tenant lookup returns azure_tenant_id
			const prepareResult = {
				bind: vi.fn(() => prepareResult),
				first: vi.fn(() => Promise.resolve({ azure_tenant_id: 'azure-tenant-1' })),
				all: vi.fn(),
				run: vi.fn(),
			};
			mockD1.prepare.mockReturnValueOnce(prepareResult as any);

			// Mock KV: Graph token exists
			mockKV.get.mockImplementation((key: string) => {
				if (key === 'graph:azure-tenant-1:access_token') return Promise.resolve('token-value');
				if (key.startsWith('session:')) return Promise.resolve(authToken);
				return Promise.resolve(null);
			});

			const res = await app.request('/api/tenants/tenant-1/sync', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.queued).toBe(true);
			expect(json.message).toBe('Sync completed');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/sync', {
				method: 'POST'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/tenants/:id/dashboard - Dashboard metrics
	// ========================================
	describe('GET /api/tenants/:id/dashboard', () => {
		it('should return aggregated dashboard metrics', async () => {
			// The dashboard endpoint fires 7 parallel D1 queries via Promise.all.
			// We mock prepare() to return appropriate data for each call.
			const alertChain = {
				bind: vi.fn(() => alertChain),
				all: vi.fn(() => Promise.resolve({
					results: [
						{ severity: 'critical', count: 5 },
						{ severity: 'high', count: 12 },
						{ severity: 'medium', count: 23 },
						{ severity: 'low', count: 8 },
					]
				})),
				first: vi.fn(),
				run: vi.fn(),
			};
			const userStatsChain = {
				bind: vi.fn(() => userStatsChain),
				first: vi.fn(() => Promise.resolve({ total: 3, active: 2, disabled: 1, inactive: 0 })),
				all: vi.fn(),
				run: vi.fn(),
			};
			const riskyUsersChain = {
				bind: vi.fn(() => riskyUsersChain),
				all: vi.fn(() => Promise.resolve({ results: [] })),
				first: vi.fn(),
				run: vi.fn(),
			};
			const licenseChain = {
				bind: vi.fn(() => licenseChain),
				all: vi.fn(() => Promise.resolve({
					results: [
						{ sku_id: 'sku1', sku_part_number: 'ENTERPRISEPACK', enabled_units: 100, consumed_units: 85 },
						{ sku_id: 'sku2', sku_part_number: 'ENTERPRISEPREMIUM', enabled_units: 50, consumed_units: 48 },
					]
				})),
				first: vi.fn(),
				run: vi.fn(),
			};
			const recentAlertsChain = {
				bind: vi.fn(() => recentAlertsChain),
				all: vi.fn(() => Promise.resolve({ results: [] })),
				first: vi.fn(),
				run: vi.fn(),
			};
			const tenantRowChain = {
				bind: vi.fn(() => tenantRowChain),
				first: vi.fn(() => Promise.resolve({ last_sync_at: Date.now() })),
				all: vi.fn(),
				run: vi.fn(),
			};

			// Return the 6 chains in order of the Promise.all calls
			mockD1.prepare
				.mockReturnValueOnce(alertChain as any)
				.mockReturnValueOnce(userStatsChain as any)
				.mockReturnValueOnce(riskyUsersChain as any)
				.mockReturnValueOnce(licenseChain as any)
				.mockReturnValueOnce(recentAlertsChain as any)
				.mockReturnValueOnce(tenantRowChain as any);

			// Mock KV for secure score cache
			mockKV.get.mockImplementation((key: string, type?: string) => {
				if (key === 'securescore:tenant-1') return Promise.resolve(null);
				if (key.startsWith('session:')) return Promise.resolve(authToken);
				return Promise.resolve(null);
			});

			const res = await app.request('/api/tenants/tenant-1/dashboard', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();

			// Verify structure
			expect(json).toHaveProperty('activeAlerts');
			expect(json.activeAlerts).toEqual({
				critical: 5,
				high: 12,
				medium: 23,
				low: 8
			});

			expect(json.totalUsers).toBe(3);
			expect(json.activeUsers).toBe(2);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/dashboard', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/tenants/:id/secure-score - Secure Score
	// ========================================
	describe('GET /api/tenants/:id/secure-score', () => {
		it('should return cached secure score data', async () => {
			const cachedScore = {
				current: 75,
				maxScore: 100,
				trend: [
					{ date: '2024-01-01', score: 70 },
					{ date: '2024-01-02', score: 72 },
					{ date: '2024-01-03', score: 75 }
				]
			};
			mockKV.get.mockImplementation((key: string) => {
				if (key === 'securescore:tenant-1') return Promise.resolve(cachedScore);
				if (key.startsWith('session:')) return Promise.resolve(authToken);
				return Promise.resolve(null);
			});

			const res = await app.request('/api/tenants/tenant-1/secure-score', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json).toEqual(cachedScore);

			// Verify KV was queried
			expect(mockKV.get).toHaveBeenCalledWith('securescore:tenant-1', 'json');
		});

		it('should return null when no cached data and no users', async () => {
			mockKV.get.mockImplementation((key: string) => {
				if (key === 'securescore:tenant-1') return Promise.resolve(null);
				if (key.startsWith('session:')) return Promise.resolve(authToken);
				return Promise.resolve(null);
			});

			// Mock D1 queries: user count returns 0 total
			const userChain = {
				bind: vi.fn(() => userChain),
				first: vi.fn(() => Promise.resolve({ total: 0, active: 0 })),
				all: vi.fn(),
				run: vi.fn(),
			};
			const alertChain = {
				bind: vi.fn(() => alertChain),
				first: vi.fn(() => Promise.resolve({ count: 0 })),
				all: vi.fn(),
				run: vi.fn(),
			};
			mockD1.prepare
				.mockReturnValueOnce(userChain as any)
				.mockReturnValueOnce(alertChain as any);

			const res = await app.request('/api/tenants/tenant-1/secure-score', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json).toEqual({ current: null, trend: [] });
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/secure-score', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/tenants/:id/events/stream - SSE
	// ========================================
	describe('GET /api/tenants/:id/events/stream', () => {
		it('should accept Bearer token in Authorization header', async () => {
			const res = await app.request('/api/tenants/tenant-1/events/stream', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toBe('text/event-stream');

			// Verify Durable Object was called
			expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith('tenant-1');
			expect(mockDurableObjectNamespace.get).toHaveBeenCalled();
		});

		it('should accept token in query parameter for EventSource compatibility', async () => {
			const res = await app.request(`/api/tenants/tenant-1/events/stream?token=${authToken}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toBe('text/event-stream');
		});

		it('should reject request without token', async () => {
			const res = await app.request('/api/tenants/tenant-1/events/stream', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
			const json: any = await res.json();
			// authMiddleware returns structured { error: { code, message } }
			expect(json.error.message).toBe('Missing authorization');
		});

		it('should reject invalid token', async () => {
			const res = await app.request('/api/tenants/tenant-1/events/stream', {
				method: 'GET',
				headers: {
					Authorization: 'Bearer invalid-token'
				}
			}, mockEnv);

			expect(res.status).toBe(401);
			const json: any = await res.json();
			expect(json.error.message).toBe('Invalid or expired token');
		});
	});
});
