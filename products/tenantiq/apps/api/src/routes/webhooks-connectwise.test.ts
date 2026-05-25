import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { connectwiseWebhookRoutes } from './webhooks-connectwise';

const mockRun = vi.fn().mockResolvedValue({ success: true });
const mockFirst = vi.fn();
const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

function makeEnv() {
	return { DB: { prepare: mockPrepare } } as any;
}

function makeApp() {
	const app = new Hono<AppEnv>();
	app.route('/webhooks/connectwise', connectwiseWebhookRoutes);
	return app;
}

describe('ConnectWise Webhook Receiver', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects invalid payload', async () => {
		const app = makeApp();
		const res = await app.request('/webhooks/connectwise', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		}, makeEnv());
		expect(res.status).toBe(400);
	});

	it('ignores non-ticket callbacks', async () => {
		const app = makeApp();
		const res = await app.request('/webhooks/connectwise', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ID: 1, Action: 'added', Type: 'company' }),
		}, makeEnv());
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.processed).toBe(false);
	});

	it('updates alert status when ticket is closed', async () => {
		mockFirst.mockResolvedValueOnce({ local_id: 'alert-1' });
		const app = makeApp();
		const res = await app.request('/webhooks/connectwise', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ID: 1,
				Action: 'updated',
				Type: 'ticket',
				Entity: { id: 500, status: { name: 'Closed' } },
			}),
		}, makeEnv());

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.processed).toBe(true);
		expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE alerts'));
	});

	it('does not update alert if no mapping found', async () => {
		mockFirst.mockResolvedValueOnce(null);
		const app = makeApp();
		const res = await app.request('/webhooks/connectwise', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ID: 1,
				Action: 'updated',
				Type: 'ticket',
				Entity: { id: 999, status: { name: 'Resolved' } },
			}),
		}, makeEnv());

		expect(res.status).toBe(200);
	});
});
