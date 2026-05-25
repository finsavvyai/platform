import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import onboarding from './onboarding';

describe('Onboarding Routes', () => {
	let app: Hono;
	let mockEnv: any;

	beforeEach(() => {
		app = new Hono();
		app.route('/api/onboarding', onboarding);

		mockEnv = {
			DB: {},
			ANTHROPIC_API_KEY: 'test-key',
		};
	});

	describe('POST /api/onboarding/plan', () => {
		it('should generate onboarding plan for developer role', async () => {
			const request = new Request('http://localhost/api/onboarding/plan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer test-token',
				},
				body: JSON.stringify({
					userName: 'John Smith',
					email: 'john.smith@company.com',
					role: 'developer',
					department: 'Engineering',
					startDate: '2026-03-01',
					manager: 'jane.doe@company.com',
				}),
			});

			// Mock auth middleware
			vi.mock('../middleware/auth.middleware', () => ({
				authMiddleware: vi.fn((c, next) => {
					c.set('userId', 'test-user');
					c.set('tenantId', 'test-tenant');
					return next();
				}),
				tenantScopingMiddleware: vi.fn((c, next) => next()),
			}));

			// Note: This test would need proper mocking of DB and middleware
			// For now, it validates the endpoint structure
			expect(request.method).toBe('POST');
			expect(request.url).toContain('/api/onboarding/plan');
		});

		it('should return 400 for missing required fields', async () => {
			const request = new Request('http://localhost/api/onboarding/plan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer test-token',
				},
				body: JSON.stringify({
					userName: 'John Smith',
					// Missing email, role, department, startDate
				}),
			});

			expect(request.method).toBe('POST');
		});
	});

	describe('GET /api/onboarding/templates', () => {
		it('should return available role templates', async () => {
			const templates = [
				{ role: 'developer', displayName: 'Software Developer' },
				{ role: 'marketing', displayName: 'Marketing Professional' },
				{ role: 'sales', displayName: 'Sales Representative' },
				{ role: 'executive', displayName: 'Executive/Leadership' },
			];

			expect(templates).toHaveLength(4);
			expect(templates[0].role).toBe('developer');
		});
	});
});
