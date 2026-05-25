import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import onboardingTracking from './onboarding-tracking';

vi.mock('@tenantiq/ai/tools/onboarding-perception', () => ({
	generateOnboardingChecklist: vi.fn(() => ({
		day1: [{ task: 'Setup', estimatedTime: '30' }],
		week1: [{ task: 'Training', estimatedTime: '60' }],
		month1: [{ task: 'Review', estimatedTime: '45' }],
	})),
	generateStatusNotification: vi.fn(() => 'Status notification text'),
	generateWelcomeEmail: vi.fn(() => ({ subject: 'Welcome!', html: '<p>Hello</p>' })),
	calculateProgress: vi.fn((steps: any[]) => {
		const done = steps.filter((s: any) => s.status === 'completed').length;
		return steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
	}),
	estimateCompletion: vi.fn(() => '2026-04-01'),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Onboarding Tracking Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/onboarding', onboardingTracking);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/onboarding/templates', () => {
		it('returns role-based templates', async () => {
			const res = await app.request('/api/onboarding/templates', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.length).toBeGreaterThanOrEqual(4);
			const roles = json.data.map((t: any) => t.role);
			expect(roles).toContain('developer');
			expect(roles).toContain('marketing');
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/onboarding/templates', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/onboarding/welcome-email', () => {
		it('generates welcome email for valid request', async () => {
			const res = await app.request('/api/onboarding/welcome-email', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userName: 'Alice', email: 'alice@acme.com',
					role: 'developer', department: 'Engineering', startDate: '2026-04-01',
				}),
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data).toBeDefined();
		});

		it('returns 400 for missing fields', async () => {
			const res = await app.request('/api/onboarding/welcome-email', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ userName: 'Alice' }),
			}, mockEnv);

			expect(res.status).toBe(400);
		});
	});

	describe('POST /api/onboarding/checklist', () => {
		it('generates checklist with summary', async () => {
			const res = await app.request('/api/onboarding/checklist', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: 'developer', department: 'Engineering' }),
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.summary).toBeDefined();
			expect(json.data.summary.totalItems).toBeGreaterThan(0);
		});

		it('returns 400 for missing role/department', async () => {
			const res = await app.request('/api/onboarding/checklist', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: 'developer' }),
			}, mockEnv);

			expect(res.status).toBe(400);
		});
	});

	describe('POST /api/onboarding/status', () => {
		it('tracks onboarding progress', async () => {
			const res = await app.request('/api/onboarding/status', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					onboardingId: 'ob-1',
					employeeName: 'Alice', employeeEmail: 'alice@acme.com',
					role: 'developer', department: 'Engineering', startDate: '2026-04-01',
					steps: [
						{ name: 'Account', status: 'completed' },
						{ name: 'Training', status: 'in_progress' },
						{ name: 'Review', status: 'pending' },
					],
				}),
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.status).toBeDefined();
			expect(json.data.notifications).toBeDefined();
		});
	});

	describe('GET /api/onboarding/progress/:onboardingId', () => {
		it('returns cached progress when available', async () => {
			mockKV.get.mockImplementation((key: string) => {
				if (key === 'onboarding:ob-1') return Promise.resolve({ id: 'ob-1', progress: 50 });
				return Promise.resolve(null);
			});

			const res = await app.request('/api/onboarding/progress/ob-1', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('returns not_started for unknown onboarding', async () => {
			const res = await app.request('/api/onboarding/progress/unknown', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.data.status).toBe('not_started');
		});
	});
});
