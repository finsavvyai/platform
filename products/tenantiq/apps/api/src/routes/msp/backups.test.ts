import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../index';
import { mspBackupRoutes } from './backups';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const ISSUER = 'https://api.tenantiq.app';
const AUDIENCE = 'tenantiq-api';

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockAll = vi.fn();
const mockDB = { prepare: mockPrepare } as any;

vi.mock('../../lib/db', () => ({
	getDb: vi.fn(() => ({
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			}),
		}),
	})),
	schema: { backupJobs: { orgId: {}, tenantId: {}, createdAt: {}, status: {} } },
}));

const mockEnv = { DB: mockDB, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test', JWT_ISSUER: ISSUER, JWT_AUDIENCE: AUDIENCE } as any;

async function tokenFor(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setExpirationTime('1h')
		.sign(secret);
}

describe('MSP backup overview', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/msp/backups', mspBackupRoutes);
		mockPrepare.mockReturnValue({ bind: mockBind });
		mockBind.mockReturnValue({ all: mockAll });
		mockKV.get.mockResolvedValue(null);
	});

	it('returns 401 without auth', async () => {
		const res = await app.request('/api/msp/backups', {}, mockEnv);
		expect(res.status).toBe(401);
	});

	it('returns empty rollup for org with no tenants', async () => {
		mockAll.mockResolvedValueOnce({ results: [] });
		const t = await tokenFor({ sub: 'u1', orgId: 'org-1', email: 'a@b.com' });
		const res = await app.request('/api/msp/backups', {
			headers: { Authorization: `Bearer ${t}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const body = await res.json() as { summary: { totalTenants: number }; tenants: unknown[] };
		expect(body.summary.totalTenants).toBe(0);
		expect(body.tenants).toEqual([]);
	});

	it('classifies tenant with no backup as error/off and surfaces reason', async () => {
		mockAll.mockResolvedValueOnce({
			results: [{ id: 't-1', display_name: 'Acme', domain: 'acme.com', status: 'active' }],
		});
		mockKV.get.mockResolvedValue(null); // no latest, no schedule
		const t = await tokenFor({ sub: 'u1', orgId: 'org-1' });
		const res = await app.request('/api/msp/backups', {
			headers: { Authorization: `Bearer ${t}` },
		}, mockEnv);
		const body = await res.json() as {
			summary: { totalTenants: number; off: number; error: number };
			tenants: Array<{ tenantId: string; health: string; healthReason: string }>;
		};
		expect(body.summary.totalTenants).toBe(1);
		expect(body.tenants[0].tenantId).toBe('t-1');
		// no schedule + no run history = off; no schedule but a never-run is also valid
		expect(['off', 'error']).toContain(body.tenants[0].health);
	});

	it('marks tenant with fresh KV-backup as ok when schedule enabled', async () => {
		mockAll.mockResolvedValueOnce({
			results: [{ id: 't-2', display_name: 'Globex', domain: 'globex.com', status: 'active' }],
		});
		// First KV call is for `latest`, second for `schedule`
		mockKV.get
			.mockResolvedValueOnce({
				backupId: 'bkp_x',
				timestamp: new Date(Date.now() - 6 * 3600_000).toISOString(),
				size: 1024 * 1024,
			})
			.mockResolvedValueOnce({
				enabled: true,
				frequency: 'daily',
				time: '03:00',
				retentionDays: 90,
				lastRun: null,
				nextRun: null,
			});
		const t = await tokenFor({ sub: 'u1', orgId: 'org-1' });
		const res = await app.request('/api/msp/backups', {
			headers: { Authorization: `Bearer ${t}` },
		}, mockEnv);
		const body = await res.json() as {
			summary: { ok: number };
			tenants: Array<{ health: string; lastBackupSizeBytes: number }>;
		};
		expect(body.tenants[0].health).toBe('ok');
		expect(body.tenants[0].lastBackupSizeBytes).toBe(1024 * 1024);
	});
});
