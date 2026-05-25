import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runScheduledRemediations } from './scheduled-remediation';

let queryResults: unknown[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn(() => ({})),
	lte: vi.fn(() => ({})),
}));
vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		remediations: {
			id: {}, status: {}, scheduledAt: {}, tenantId: {},
			alertId: {}, actionType: {}, initiatedBy: {},
		},
	},
}));

const mockQueueSend = vi.fn();

function makeEnv() {
	return {
		DB: {} as any,
		KV: {} as any,
		R2: {} as any,
		REMEDIATION_QUEUE: { send: mockQueueSend } as any,
		NOTIFICATION_QUEUE: {} as any,
		JWT_SECRET: 'test',
	} as any;
}

describe('runScheduledRemediations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		mockQueueSend.mockResolvedValue(undefined);
	});

	it('queues due remediations for execution', async () => {
		const dueRems = [
			{
				id: 'rem-1', tenantId: 't1', alertId: 'a1',
				actionType: 'disable_user', status: 'scheduled',
				scheduledAt: new Date(Date.now() - 60_000).toISOString(),
				initiatedBy: 'admin@test.com',
			},
			{
				id: 'rem-2', tenantId: 't1', alertId: 'a2',
				actionType: 'reset_password', status: 'scheduled',
				scheduledAt: new Date(Date.now() - 120_000).toISOString(),
				initiatedBy: 'admin@test.com',
			},
		];
		queryResults = [dueRems, undefined, undefined];

		const env = makeEnv();
		await runScheduledRemediations(env);

		expect(mockQueueSend).toHaveBeenCalledTimes(2);
		expect(mockQueueSend.mock.calls[0][0].remediationId).toBe('rem-1');
		expect(mockQueueSend.mock.calls[1][0].remediationId).toBe('rem-2');
	});

	it('updates status to pending after queuing', async () => {
		queryResults = [[{
			id: 'rem-1', tenantId: 't1', alertId: 'a1',
			actionType: 'disable_user', status: 'scheduled',
			scheduledAt: new Date(Date.now() - 60_000).toISOString(),
			initiatedBy: 'admin@test.com',
		}], undefined];

		const env = makeEnv();
		await runScheduledRemediations(env);

		expect(mockDbChain.update).toHaveBeenCalled();
		expect(mockDbChain.set).toHaveBeenCalledWith({ status: 'pending' });
	});

	it('handles no due remediations gracefully', async () => {
		queryResults = [[]];

		const env = makeEnv();
		await runScheduledRemediations(env);

		expect(mockQueueSend).not.toHaveBeenCalled();
	});

	it('continues processing remaining items when one fails', async () => {
		mockQueueSend.mockRejectedValueOnce(new Error('Queue full'));
		mockQueueSend.mockResolvedValueOnce(undefined);

		queryResults = [
			[
				{ id: 'rem-1', tenantId: 't1', alertId: 'a1', actionType: 'x', status: 'scheduled', scheduledAt: new Date().toISOString(), initiatedBy: 'a@t.com' },
				{ id: 'rem-2', tenantId: 't1', alertId: 'a2', actionType: 'y', status: 'scheduled', scheduledAt: new Date().toISOString(), initiatedBy: 'a@t.com' },
			],
			undefined,
		];

		const env = makeEnv();
		await expect(runScheduledRemediations(env)).resolves.toBeUndefined();
		expect(mockQueueSend).toHaveBeenCalledTimes(2);
	});
});
