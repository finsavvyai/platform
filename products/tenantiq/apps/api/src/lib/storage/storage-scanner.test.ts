import { describe, expect, it, vi } from 'vitest';
import { scanOneDriveUsage, scanSharePointUsage } from './storage-scanner';

const GB = 1024 ** 3;

describe('Storage Scanner', () => {
	describe('scanOneDriveUsage', () => {
		it('collects per-user OneDrive usage', async () => {
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/users?')) {
						return Promise.resolve({ value: [{ id: 'u1', displayName: 'Alice', mail: 'alice@t.com' }] });
					}
					if (path.startsWith('/users/u1/drive')) {
						return Promise.resolve({ quota: { used: 5 * GB, total: 100 * GB } });
					}
					return Promise.resolve({ value: [] });
				}),
			} as any;

			const users = await scanOneDriveUsage(graph);
			expect(users).toHaveLength(1);
			expect(users[0].usedGB).toBeCloseTo(5, 0);
			expect(users[0].allocatedGB).toBeCloseTo(100, 0);
			expect(users[0].displayName).toBe('Alice');
		});

		it('skips users without drive', async () => {
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/users?')) {
						return Promise.resolve({ value: [{ id: 'u1', displayName: 'Bob' }] });
					}
					return Promise.reject(new Error('No drive'));
				}),
			} as any;
			const users = await scanOneDriveUsage(graph);
			expect(users).toHaveLength(0);
		});

		it('sorts by usage descending', async () => {
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/users?')) {
						return Promise.resolve({ value: [
							{ id: 'u1', displayName: 'Low', mail: 'low@t.com' },
							{ id: 'u2', displayName: 'High', mail: 'high@t.com' },
						]});
					}
					if (path.includes('u1/drive')) return Promise.resolve({ quota: { used: 1 * GB, total: 10 * GB } });
					if (path.includes('u2/drive')) return Promise.resolve({ quota: { used: 50 * GB, total: 100 * GB } });
					return Promise.resolve({});
				}),
			} as any;
			const users = await scanOneDriveUsage(graph);
			expect(users[0].displayName).toBe('High');
		});

		it('processes 15 users across two chunks of 10', async () => {
			const fakeUsers = Array.from({ length: 15 }, (_, i) => ({
				id: `u${i}`, displayName: `User ${i}`, mail: `u${i}@t.com`, userPrincipalName: `u${i}@t.com`,
			}));
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/users?')) return Promise.resolve({ value: fakeUsers });
					return Promise.resolve({ quota: { used: 1 * GB, total: 10 * GB } });
				}),
			} as any;
			const users = await scanOneDriveUsage(graph);
			expect(users).toHaveLength(15);
			expect(users.some(u => u.displayName === 'User 14')).toBe(true);
		});

		it('skips rejected drive fetches without aborting sibling users in chunk', async () => {
			const fakeUsers = [
				{ id: 'u0', displayName: 'Alice', mail: 'a@t.com', userPrincipalName: 'a@t.com' },
				{ id: 'u1', displayName: 'Bob',   mail: 'b@t.com', userPrincipalName: 'b@t.com' },
				{ id: 'u2', displayName: 'Carol', mail: 'c@t.com', userPrincipalName: 'c@t.com' },
			];
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/users?')) return Promise.resolve({ value: fakeUsers });
					if (path.includes('u1/drive')) return Promise.reject(new Error('No drive'));
					return Promise.resolve({ quota: { used: 5 * GB, total: 10 * GB } });
				}),
			} as any;
			const users = await scanOneDriveUsage(graph);
			expect(users).toHaveLength(2);
			expect(users.some(u => u.displayName === 'Alice')).toBe(true);
			expect(users.some(u => u.displayName === 'Carol')).toBe(true);
		});

		it('removes hard-cap — returns all users when list has 150 entries', async () => {
			const fakeUsers = Array.from({ length: 150 }, (_, i) => ({
				id: `u${i}`, displayName: `User ${i}`, mail: `u${i}@t.com`, userPrincipalName: `u${i}@t.com`,
			}));
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/users?')) return Promise.resolve({ value: fakeUsers });
					return Promise.resolve({ quota: { used: 1 * GB, total: 10 * GB } });
				}),
			} as any;
			const users = await scanOneDriveUsage(graph);
			expect(users).toHaveLength(150);
		});
	});

	describe('scanSharePointUsage', () => {
		it('collects per-site SharePoint usage', async () => {
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/sites?')) {
						return Promise.resolve({ value: [{ id: 's1', displayName: 'Team', webUrl: 'https://sp/team' }] });
					}
					if (path.startsWith('/sites/s1/drive')) {
						return Promise.resolve({ quota: { used: 20 * GB, total: 50 * GB } });
					}
					return Promise.resolve({ value: [] });
				}),
			} as any;

			const sites = await scanSharePointUsage(graph);
			expect(sites).toHaveLength(1);
			expect(sites[0].usedGB).toBeCloseTo(20, 0);
			expect(sites[0].name).toBe('Team');
		});

		it('handles empty graph response', async () => {
			const graph = {
				fetch: vi.fn().mockResolvedValue({ value: [] }),
			} as any;
			const sites = await scanSharePointUsage(graph);
			expect(sites).toHaveLength(0);
		});

		it('processes 15 SharePoint sites across two chunks of 10', async () => {
			const fakeSites = Array.from({ length: 15 }, (_, i) => ({
				id: `s${i}`, displayName: `Site ${i}`, webUrl: `https://sp/s${i}`,
			}));
			const graph = {
				fetch: vi.fn().mockImplementation((path: string) => {
					if (path.startsWith('/sites?')) return Promise.resolve({ value: fakeSites });
					return Promise.resolve({ quota: { used: 2 * GB, total: 20 * GB } });
				}),
			} as any;
			const sites = await scanSharePointUsage(graph);
			expect(sites).toHaveLength(15);
			expect(sites.some(s => s.name === 'Site 14')).toBe(true);
		});
	});
});
