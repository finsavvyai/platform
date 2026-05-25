import { beforeEach, describe, expect, it, vi } from 'vitest';

let queryResults: any[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._args: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../db', () => ({
	getDb: () => mockDbChain,
	schema: {
		backupJobs: {
			id: {}, orgId: {}, tenantId: {}, type: {}, status: {},
			itemsCount: {}, sizeBytes: {}, startedAt: {}, completedAt: {},
			error: {}, createdAt: {},
		},
	},
}));

import { startBackup, getJobStatus, listJobs } from './orchestrator';

const mockEnv = { DB: {} as any, KV: {} as any, R2: {} as any, JWT_SECRET: 'x' } as any;

describe('Backup Orchestrator', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
	});

	describe('startBackup', () => {
		it('should create a backup job record', async () => {
			queryResults = [[]]; // insert
			const job = await startBackup(mockEnv, 'org-1', 'tenant-1', 'exchange');
			expect(job.id).toMatch(/^bkp_/);
			expect(job.orgId).toBe('org-1');
			expect(job.tenantId).toBe('tenant-1');
			expect(job.type).toBe('exchange');
			expect(job.status).toBe('pending');
			expect(mockDbChain.insert).toHaveBeenCalled();
		});

		it('should set itemsCount and sizeBytes to 0', async () => {
			queryResults = [[]];
			const job = await startBackup(mockEnv, 'org-1', 'tenant-1', 'sharepoint');
			expect(job.itemsCount).toBe(0);
			expect(job.sizeBytes).toBe(0);
		});
	});

	describe('getJobStatus', () => {
		it('should return job when found', async () => {
			queryResults = [[{
				id: 'bkp_123', orgId: 'org-1', tenantId: 'tenant-1', type: 'teams',
				status: 'completed', itemsCount: 42, sizeBytes: 8192,
				startedAt: Date.now() - 60000, completedAt: Date.now(),
				error: null, createdAt: Date.now() - 120000,
			}]];
			const job = await getJobStatus(mockEnv, 'bkp_123', 'org-1');
			expect(job).not.toBeNull();
			expect(job!.type).toBe('teams');
			expect(job!.itemsCount).toBe(42);
		});

		it('should return null when not found', async () => {
			queryResults = [[]];
			const job = await getJobStatus(mockEnv, 'missing', 'org-1');
			expect(job).toBeNull();
		});
	});

	describe('listJobs', () => {
		it('should return jobs for a tenant', async () => {
			queryResults = [[
				{ id: 'bkp_1', orgId: 'org-1', tenantId: 'tenant-1', type: 'exchange', status: 'completed', itemsCount: 10, sizeBytes: 512, startedAt: Date.now(), completedAt: Date.now(), error: null, createdAt: Date.now() },
				{ id: 'bkp_2', orgId: 'org-1', tenantId: 'tenant-1', type: 'sharepoint', status: 'running', itemsCount: 0, sizeBytes: 0, startedAt: Date.now(), completedAt: null, error: null, createdAt: Date.now() },
			]];
			const result = await listJobs(mockEnv, 'org-1', 'tenant-1');
			expect(result.jobs).toHaveLength(2);
			expect(result.jobs[0].type).toBe('exchange');
		});

		it('should support type filter', async () => {
			queryResults = [[]];
			await listJobs(mockEnv, 'org-1', 'tenant-1', { type: 'teams' });
			expect(mockDbChain.where).toHaveBeenCalled();
		});
	});
});
