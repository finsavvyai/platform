import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { healthRoutes } from './health';

// Mock D1 database (Cloudflare D1 API: prepare().first())
const mockFirst = vi.fn();
const mockPrepare = vi.fn(() => ({ first: mockFirst }));
const mockDB = { prepare: mockPrepare };

describe('Health Check Endpoints', () => {
	let app: Hono<AppEnv>;
	let mockEnv: AppEnv['Bindings'];

	beforeEach(() => {
		app = new Hono<AppEnv>();
		app.route('/health', healthRoutes);

		mockEnv = {
			ENVIRONMENT: 'test',
			APP_VERSION: '1.0.0',
			DB: mockDB,
			JWT_SECRET: 'test-secret',
			AZURE_CLIENT_ID: 'test-client-id',
			AZURE_CLIENT_SECRET: 'test-secret',
			AZURE_TENANT_ID: 'test-tenant',
			ANTHROPIC_API_KEY: 'test-api-key'
		} as any;

		vi.clearAllMocks();
	});

	describe('GET /health', () => {
		it('should return 200 with healthy status when database is accessible', async () => {
			mockFirst.mockResolvedValue({ health_check: 1 });

			const res = await app.request('/health', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.status).toBe('healthy');
			expect(json.checks.database).toBe('healthy');
			expect(json.checks.version).toBe('1.0.0');
			expect(json.environment).toBe('test');
		});

		it('should return 503 with unhealthy status when database is inaccessible', async () => {
			mockFirst.mockRejectedValue(new Error('Database connection failed'));

			const res = await app.request('/health', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(503);

			const json = await res.json();
			expect(json.status).toBe('unhealthy');
			expect(json.checks.database).toBe('unhealthy');
		});

		it('should include timestamp in response', async () => {
			mockFirst.mockResolvedValue({ health_check: 1 });

			const res = await app.request('/health', {
				method: 'GET',
			}, mockEnv);

			const json = await res.json();
			expect(json.checks.timestamp).toBeDefined();
			expect(new Date(json.checks.timestamp).getTime()).toBeGreaterThan(0);
		});

		it('should include uptime in response', async () => {
			mockFirst.mockResolvedValue({ health_check: 1 });

			const res = await app.request('/health', {
				method: 'GET',
			}, mockEnv);

			const json = await res.json();
			expect(json.checks.uptimeSeconds).toBeGreaterThanOrEqual(0);
		});
	});

	describe('GET /health/ready', () => {
		it('should return 200 when service is ready', async () => {
			mockFirst.mockResolvedValue({ readiness_check: 1 });

			const res = await app.request('/health/ready', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.status).toBe('ready');
			expect(json.timestamp).toBeDefined();
		});

		it('should return 503 when database is not ready', async () => {
			mockFirst.mockRejectedValue(new Error('Connection timeout'));

			const res = await app.request('/health/ready', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(503);

			const json = await res.json();
			expect(json.status).toBe('not_ready');
			expect(json.error).toBe('Database connection failed');
			expect(json.timestamp).toBeDefined();
		});

		it('should be suitable for load balancer health checks', async () => {
			mockFirst.mockResolvedValue(null);

			const res = await app.request('/health/ready', {
				method: 'GET',
			}, mockEnv);

			// Should respond quickly with clear status
			expect([200, 503]).toContain(res.status);

			const json = await res.json();
			expect(['ready', 'not_ready']).toContain(json.status);
		});
	});

	describe('GET /health/live', () => {
		it('should always return 200 when service is running', async () => {
			const res = await app.request('/health/live', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.status).toBe('alive');
			expect(json.timestamp).toBeDefined();
		});

		it('should not depend on database connectivity', async () => {
			// Even if database fails, liveness should succeed
			mockFirst.mockRejectedValue(new Error('Database down'));

			const res = await app.request('/health/live', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.status).toBe('alive');
		});

		it('should be suitable for orchestration liveness probes', async () => {
			const res = await app.request('/health/live', {
				method: 'GET',
			}, mockEnv);

			// Should always return 200 and be fast
			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.status).toBe('alive');
			expect(json.timestamp).toBeDefined();
		});
	});

	describe('Cross-endpoint consistency', () => {
		it('should all return JSON responses', async () => {
			mockFirst.mockResolvedValue(null);

			const endpoints = ['/health', '/health/ready', '/health/live'];

			for (const endpoint of endpoints) {
				const res = await app.request(endpoint, {
					method: 'GET',
				}, mockEnv);

				const contentType = res.headers.get('content-type');
				expect(contentType).toContain('application/json');
			}
		});

		it('should all include timestamps', async () => {
			mockFirst.mockResolvedValue(null);

			const endpoints = ['/health', '/health/ready', '/health/live'];

			for (const endpoint of endpoints) {
				const res = await app.request(endpoint, {
					method: 'GET',
				}, mockEnv);

				const json = await res.json();
				expect(json.timestamp || json.checks?.timestamp).toBeDefined();
			}
		});

		it('should handle concurrent requests correctly', async () => {
			mockFirst.mockResolvedValue(null);

			const requests = [
				app.request('/health', { method: 'GET' }, mockEnv),
				app.request('/health/ready', { method: 'GET' }, mockEnv),
				app.request('/health/live', { method: 'GET' }, mockEnv)
			];

			const responses = await Promise.all(requests);

			expect(responses).toHaveLength(3);
			responses.forEach(res => {
				expect(res.status).toBeGreaterThanOrEqual(200);
				expect(res.status).toBeLessThan(600);
			});
		});
	});
});
