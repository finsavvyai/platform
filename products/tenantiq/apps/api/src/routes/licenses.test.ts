import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { licenseRoutes } from './licenses';
import * as jose from 'jose';

// ============================================================
// Mocks
// ============================================================

function makeMockDb() {
	const chain = { bind: vi.fn(), first: vi.fn(), all: vi.fn(), run: vi.fn() };
	chain.bind.mockReturnValue(chain);
	chain.first.mockResolvedValue({ id: 'tenant-1' });
	chain.all.mockResolvedValue({ results: [] });
	chain.run.mockResolvedValue({ success: true });
	return { prepare: vi.fn(() => chain) };
}
const mockDb = makeMockDb();

const mockKV = {
	get: vi.fn()
};

const mockQueue = {
	send: vi.fn()
};

const mockEnv = {
	DB: mockDb as any,
	KV: mockKV as any,
	REMEDIATION_QUEUE: mockQueue as any,
	JWT_SECRET: 'test-jwt-secret-key-minimum-32-characters-long'
};

// Mock the db module
vi.mock('../lib/db', () => ({
	getDb: () => mockDb
}));

// Sample license data
const mockLicenses = [
	{
		id: 'lic-1',
		tenantId: 'tenant-1',
		skuId: 'O365_E3',
		skuName: 'Office 365 E3',
		total: 100,
		assigned: 85,
		costPerUnit: '20.00'
	},
	{
		id: 'lic-2',
		tenantId: 'tenant-1',
		skuId: 'O365_E5',
		skuName: 'Office 365 E5',
		total: 50,
		assigned: 48,
		costPerUnit: '35.00'
	},
	{
		id: 'lic-3',
		tenantId: 'tenant-1',
		skuId: 'TEAMS',
		skuName: 'Microsoft Teams',
		total: 200,
		assigned: 200,
		costPerUnit: '0.00'
	}
];

const mockWasteItems = [
	{
		skuId: 'O365_E3',
		skuName: 'Office 365 E3',
		unused: 15,
		monthlyCost: 300.00
	},
	{
		skuId: 'O365_E5',
		skuName: 'Office 365 E5',
		unused: 2,
		monthlyCost: 70.00
	}
];

// Mock db functions
vi.mock('@tenantiq/db', () => ({
	getLicensesByTenant: vi.fn((db, tenantId) => Promise.resolve(mockLicenses)),
	getLicenseWaste: vi.fn((db, tenantId) => Promise.resolve(mockWasteItems)),
	createAuditEntry: vi.fn((db, entry) => Promise.resolve())
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

describe('Licenses Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/tenants/:tenantId/licenses', licenseRoutes);

		// Create valid auth token
		authToken = await createTestToken({
			sub: 'user-1',
			email: 'admin@test.com',
			name: 'Admin User',
			orgId: 'org-1',
			tenantIds: ['tenant-1'],
			role: 'admin'
		});

		// Mock KV session storage
		mockKV.get.mockResolvedValue(authToken);
	});

	// ========================================
	// GET /api/tenants/:tenantId/licenses
	// ========================================
	describe('GET /api/tenants/:tenantId/licenses', () => {
		it('should return license summary with total spend', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.licenses).toHaveLength(3);
			expect(json).toHaveProperty('totalSpend');

			// Total spend = (85 * 20) + (48 * 35) + (200 * 0) = 1700 + 1680 = 3380
			expect(json.totalSpend).toBe(3380);
		});

		it('should include all license details', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();

			const license = json.licenses[0];
			expect(license).toHaveProperty('id');
			expect(license).toHaveProperty('skuId');
			expect(license).toHaveProperty('skuName');
			expect(license).toHaveProperty('total');
			expect(license).toHaveProperty('assigned');
			expect(license).toHaveProperty('costPerUnit');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});

		it('should deny access to unauthorized tenant', async () => {
			(mockEnv.DB.prepare('') as any).first.mockResolvedValueOnce(null);
			const res = await app.request('/api/tenants/unauthorized-tenant/licenses', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(403);
		});
	});

	// ========================================
	// GET /api/tenants/:tenantId/licenses/waste
	// ========================================
	describe('GET /api/tenants/:tenantId/licenses/waste', () => {
		it('should return waste analysis', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/waste', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.wasteItems).toHaveLength(2);
			expect(json).toHaveProperty('totalMonthlyWaste');

			// Total waste = 300 + 70 = 370
			expect(json.totalMonthlyWaste).toBe(370);
		});

		it('should include waste item details', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/waste', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();

			const wasteItem = json.wasteItems[0];
			expect(wasteItem).toHaveProperty('skuId');
			expect(wasteItem).toHaveProperty('skuName');
			expect(wasteItem).toHaveProperty('unused');
			expect(wasteItem).toHaveProperty('monthlyCost');
		});

		it('should round total waste to 2 decimal places', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/waste', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();

			// Verify the value is rounded to 2 decimals
			expect(json.totalMonthlyWaste).toBeCloseTo(370, 2);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/waste', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// POST /api/tenants/:tenantId/licenses/optimize
	// ========================================
	describe('POST /api/tenants/:tenantId/licenses/optimize', () => {
		it('should queue license optimization for users', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/optimize', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userIds: ['user-1', 'user-2', 'user-3'],
					action: 'downgrade',
					targetSku: 'O365_E3'
				})
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.queued).toBe(true);
			expect(json.message).toBe('License optimization queued for 3 users');

			// Verify queue message
			expect(mockQueue.send).toHaveBeenCalledWith({
				type: 'bulk_license_optimization',
				tenantId: 'tenant-1',
				userIds: ['user-1', 'user-2', 'user-3'],
				action: 'downgrade',
				targetSku: 'O365_E3',
				executedBy: 'admin@test.com'
			});
		});

		it('should create audit log entry', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/optimize', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userIds: ['user-1', 'user-2'],
					action: 'remove'
				})
			}, mockEnv);

			expect(res.status).toBe(200);

			// Verify audit entry
			const { createAuditEntry } = await import('@tenantiq/db');
			expect(createAuditEntry).toHaveBeenCalledWith(mockDb, expect.objectContaining({
				tenantId: 'tenant-1',
				actor: 'admin@test.com',
				action: 'license.optimization.queued',
				resourceType: 'license',
				details: { userCount: 2, action: 'remove' }
			}));
		});

		it('should handle remove action without targetSku', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/optimize', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userIds: ['user-1'],
					action: 'remove'
				})
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.queued).toBe(true);

			// Verify targetSku is undefined for remove action
			expect(mockQueue.send).toHaveBeenCalledWith(expect.objectContaining({
				action: 'remove',
				targetSku: undefined
			}));
		});

		it('should reject request without userIds', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/optimize', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'downgrade'
				})
			}, mockEnv);

			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toBe('userIds required');
		});

		it('should reject request with empty userIds array', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/optimize', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userIds: [],
					action: 'remove'
				})
			}, mockEnv);

			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toBe('userIds required');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/optimize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userIds: ['user-1'],
					action: 'remove'
				})
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/tenants/:tenantId/licenses/export
	// ========================================
	describe('GET /api/tenants/:tenantId/licenses/export', () => {
		it('should export licenses as CSV', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/export', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toBe('text/csv');
			expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="licenses-tenant-1.csv"');
		});

		it('should include CSV headers', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/export', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const csv = await res.text();
			const lines = csv.split('\n');

			expect(lines[0]).toBe('SKU Name,SKU ID,Total,Assigned,Unused,Cost Per Unit,Monthly Spend,Monthly Waste');
		});

		it('should include all license data in CSV', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/export', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const csv = await res.text();
			const lines = csv.split('\n');

			// Should have header + 3 license rows
			expect(lines).toHaveLength(4);

			// Check first data row (Office 365 E3)
			// unused = 100 - 85 = 15
			// monthly spend = 85 * 20 = 1700
			// monthly waste = 15 * 20 = 300
			expect(lines[1]).toBe('"Office 365 E3","O365_E3",100,85,15,20,1700,300');
		});

		it('should calculate unused, spend, and waste correctly', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/export', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const csv = await res.text();
			const lines = csv.split('\n');

			// Check second data row (Office 365 E5)
			// unused = 50 - 48 = 2
			// monthly spend = 48 * 35 = 1680
			// monthly waste = 2 * 35 = 70
			expect(lines[2]).toBe('"Office 365 E5","O365_E5",50,48,2,35,1680,70');
		});

		it('should handle zero-cost licenses correctly', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/export', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);
			const csv = await res.text();
			const lines = csv.split('\n');

			// Check third data row (Microsoft Teams - free)
			// unused = 200 - 200 = 0
			// monthly spend = 200 * 0 = 0
			// monthly waste = 0 * 0 = 0
			expect(lines[3]).toBe('"Microsoft Teams","TEAMS",200,200,0,0,0,0');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/licenses/export', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});
});
