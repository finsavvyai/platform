import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { userRoutes } from './users';

// ============================================================
// Mocks — aligned with the actual Graph API-based users.ts
// ============================================================

const mockGraphClient = {
	getUsers: vi.fn(),
	getUser: vi.fn(),
	assignLicense: vi.fn(),
	removeLicense: vi.fn(),
	getSubscribedSkus: vi.fn()
};

vi.mock('../lib/graph-client', () => ({
	createGraphClient: vi.fn(() => mockGraphClient)
}));

const mockKV = {
	get: vi.fn(),
	put: vi.fn()
};

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockEnv = {
	DB: {} as any,
	KV: mockKV as any,
	JWT_SECRET
};

// Sample data returned by Graph API
const graphUsers = [
	{ id: 'user-1', displayName: 'Active User', mail: 'active@test.com', assignedLicenses: [{ skuId: 'sku-1' }] },
	{ id: 'user-2', displayName: 'Inactive User', mail: 'inactive@test.com', assignedLicenses: [{ skuId: 'sku-2' }] },
	{ id: 'user-3', displayName: 'Guest User', mail: 'guest@external.com', assignedLicenses: [] }
];

const singleUser = {
	id: 'user-1',
	displayName: 'Active User',
	mail: 'active@test.com',
	assignedLicenses: [{ skuId: 'sku-1' }]
};

const subscribedSkus = [
	{ skuId: 'sku-1', skuPartNumber: 'O365_E3', prepaidUnits: { enabled: 100 }, consumedUnits: 85 },
	{ skuId: 'sku-2', skuPartNumber: 'O365_E5', prepaidUnits: { enabled: 50 }, consumedUnits: 48 }
];

// Helper to create auth token
async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return await new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

// ============================================================
// Tests — matching the actual routes in users.ts:
//   GET  /                    → { users, count }
//   GET  /:userId             → { user }
//   GET  /:userId/licenses    → { userId, licenses }
//   POST /:userId/licenses    → { message, userId, skuId }
//   DELETE /:userId/licenses/:skuId → { message, userId, skuId }
//   GET  /licenses/available  → { licenses, count }
// ============================================================

describe('Users Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/users', userRoutes);

		// Token must include tenantId (singular) for auth.middleware.ts
		authToken = await createTestToken({
			sub: 'user-1',
			email: 'admin@test.com',
			tenantId: 'tenant-1',
			role: 'admin'
		});

		// Rate limiter KV mock
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);

		// Default Graph API responses
		mockGraphClient.getUsers.mockResolvedValue(graphUsers);
		mockGraphClient.getUser.mockResolvedValue(singleUser);
		mockGraphClient.assignLicense.mockResolvedValue(undefined);
		mockGraphClient.removeLicense.mockResolvedValue(undefined);
		mockGraphClient.getSubscribedSkus.mockResolvedValue(subscribedSkus);
	});

	// ========================================
	// GET /api/users
	// ========================================
	describe('GET /api/users', () => {
		it('should return list of users from Graph API', async () => {
			const res = await app.request('/api/users', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.users).toHaveLength(3);
			expect(json.count).toBe(3);
		});

		it('should handle Graph API failure gracefully', async () => {
			mockGraphClient.getUsers.mockRejectedValue(new Error('Graph API unavailable'));

			const res = await app.request('/api/users', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(500);
			const json: any = await res.json();
			expect(json.error).toBe('Internal Server Error');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/users', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/users/:userId
	// ========================================
	describe('GET /api/users/:userId', () => {
		it('should return user details', async () => {
			const res = await app.request('/api/users/user-1', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.user).toHaveProperty('id', 'user-1');
			expect(json.user).toHaveProperty('displayName', 'Active User');
		});

		it('should return 404 for non-existent user', async () => {
			mockGraphClient.getUser.mockRejectedValue(new Error('User not found'));

			const res = await app.request('/api/users/non-existent', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(404);
			const json: any = await res.json();
			expect(json.error).toBe('Not Found');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/users/user-1', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/users/:userId/licenses
	// ========================================
	describe('GET /api/users/:userId/licenses', () => {
		it('should return user license assignments', async () => {
			const res = await app.request('/api/users/user-1/licenses', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.userId).toBe('user-1');
			expect(json.licenses).toBeDefined();
		});

		it('should return 404 when user not found', async () => {
			mockGraphClient.getUser.mockRejectedValue(new Error('Not found'));

			const res = await app.request('/api/users/non-existent/licenses', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(404);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/users/user-1/licenses', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// POST /api/users/:userId/licenses
	// ========================================
	describe('POST /api/users/:userId/licenses', () => {
		it('should assign a license to a user', async () => {
			const res = await app.request('/api/users/user-1/licenses', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ skuId: 'sku-1' })
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.message).toBe('License assigned successfully');
			expect(json.userId).toBe('user-1');
			expect(json.skuId).toBe('sku-1');
		});

		it('should reject request without skuId', async () => {
			const res = await app.request('/api/users/user-1/licenses', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({})
			}, mockEnv);

			expect(res.status).toBe(400);
			const json: any = await res.json();
			expect(json.error).toBe('Bad Request');
		});

		it('should require admin role', async () => {
			const viewerToken = await createTestToken({
				sub: 'user-2',
				email: 'viewer@test.com',
				tenantId: 'tenant-1',
				role: 'viewer'
			});

			const res = await app.request('/api/users/user-1/licenses', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${viewerToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ skuId: 'sku-1' })
			}, mockEnv);

			expect(res.status).toBe(403);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/users/user-1/licenses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ skuId: 'sku-1' })
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// DELETE /api/users/:userId/licenses/:skuId
	// ========================================
	describe('DELETE /api/users/:userId/licenses/:skuId', () => {
		it('should remove a license from a user', async () => {
			const res = await app.request('/api/users/user-1/licenses/sku-1', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.message).toBe('License removed successfully');
			expect(json.userId).toBe('user-1');
			expect(json.skuId).toBe('sku-1');
		});

		it('should handle Graph API failure', async () => {
			mockGraphClient.removeLicense.mockRejectedValue(new Error('Graph error'));

			const res = await app.request('/api/users/user-1/licenses/sku-1', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(500);
		});

		it('should require admin role', async () => {
			const viewerToken = await createTestToken({
				sub: 'user-2',
				email: 'viewer@test.com',
				tenantId: 'tenant-1',
				role: 'viewer'
			});

			const res = await app.request('/api/users/user-1/licenses/sku-1', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${viewerToken}` }
			}, mockEnv);

			expect(res.status).toBe(403);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/users/user-1/licenses/sku-1', {
				method: 'DELETE'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});

	// ========================================
	// GET /api/users/licenses/available
	// ========================================
	describe('GET /api/users/licenses/available', () => {
		it('should return available licenses for the tenant', async () => {
			const res = await app.request('/api/users/licenses/available', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.licenses).toHaveLength(2);
			expect(json.count).toBe(2);
		});

		it('should handle Graph API failure', async () => {
			mockGraphClient.getSubscribedSkus.mockRejectedValue(new Error('Graph error'));

			const res = await app.request('/api/users/licenses/available', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);

			expect(res.status).toBe(500);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/users/licenses/available', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});
});
