import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { executiveReportPdf } from './executive-report-pdf';

let queryResults: unknown[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({ getDb: () => mockDbChain }));

vi.mock('@tenantiq/db', () => ({
	getTenantById: vi.fn(async () => ({ id: 't1', displayName: 'Acme Corp', domain: 'acme.com' })),
	getUsersByTenant: vi.fn(async () => [
		{ id: 'u1', displayName: 'Alice', lastSignIn: new Date().toISOString() },
		{ id: 'u2', displayName: 'Bob', lastSignIn: null },
	]),
	getLicensesByTenant: vi.fn(async () => [
		{ skuPartNumber: 'E3', total: 100, assigned: 80, costPerUnit: '12' },
	]),
}));

vi.mock('../lib/pdf-generator', () => ({
	generateReportHTML: vi.fn((data: any) =>
		`<!DOCTYPE html><html><head></head><body><h1>TenantIQ</h1><p>${data.title}</p></body></html>`
	),
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

describe('Executive Report PDF Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/executive-report', executiveReportPdf);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/executive-report/pdf-preview', () => {
		it('returns text/html content-type', async () => {
			const res = await app.request('/api/executive-report/pdf-preview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toContain('text/html');
		});

		it('contains TenantIQ branding in response', async () => {
			const res = await app.request('/api/executive-report/pdf-preview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			const html = await res.text();
			expect(html).toContain('TenantIQ');
		});

		it('contains tenant name in report title', async () => {
			const res = await app.request('/api/executive-report/pdf-preview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			const html = await res.text();
			expect(html).toContain('Acme Corp');
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/executive-report/pdf-preview', {
				method: 'GET',
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});
});
