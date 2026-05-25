import { describe, it, expect, vi } from 'vitest';
import { syncTickets } from './ticket-sync';
import type { TicketSyncDeps, Alert } from './ticket-sync';

describe('syncTickets', () => {
	const baseAlert: Alert = {
		id: 'a1',
		title: 'MFA Disabled',
		description: 'User disabled MFA',
		severity: 'critical',
		status: 'active',
		tenantId: 't1',
		createdAt: '2026-04-01T00:00:00Z',
	};

	it('creates CW tickets for new alerts', async () => {
		const saveMapping = vi.fn();
		const createTicket = vi.fn().mockResolvedValue({ id: 'cw-100', summary: '[TenantIQ] MFA Disabled' });
		const deps: TicketSyncDeps = {
			client: { createTicket, addTicketNote: vi.fn() } as any,
			integrationId: 'int-1',
			alerts: [baseAlert],
			resolvedAlerts: [],
			tenantToCompany: new Map([['t1', '10']]),
			saveMapping,
		};

		const result = await syncTickets(deps);
		expect(result.created).toBe(1);
		expect(result.failed).toBe(0);
		expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({
			summary: '[TenantIQ] MFA Disabled',
			priority: 1,
			companyId: '10',
		}));
		expect(saveMapping).toHaveBeenCalledWith('a1', 'cw-100');
	});

	it('skips alerts without company mapping', async () => {
		const saveMapping = vi.fn();
		const deps: TicketSyncDeps = {
			client: { createTicket: vi.fn() } as any,
			integrationId: 'int-1',
			alerts: [baseAlert],
			resolvedAlerts: [],
			tenantToCompany: new Map(), // no mapping
			saveMapping,
		};

		const result = await syncTickets(deps);
		expect(result.failed).toBe(1);
		expect(result.errors[0]).toContain('not mapped');
	});

	it('closes CW tickets for resolved alerts', async () => {
		const updateTicket = vi.fn().mockResolvedValue({});
		const addTicketNote = vi.fn();
		const deps: TicketSyncDeps = {
			client: { createTicket: vi.fn(), updateTicket, addTicketNote } as any,
			integrationId: 'int-1',
			alerts: [],
			resolvedAlerts: [{ alertId: 'a1', ticketId: 'cw-100' }],
			tenantToCompany: new Map(),
			saveMapping: vi.fn(),
		};

		const result = await syncTickets(deps);
		expect(result.updated).toBe(1);
		expect(updateTicket).toHaveBeenCalledWith('cw-100', { status: 'Closed' });
		expect(addTicketNote).toHaveBeenCalledWith('cw-100', 'Resolved automatically by TenantIQ');
	});

	it('sets priority 2 for high severity', async () => {
		const createTicket = vi.fn().mockResolvedValue({ id: 'cw-200' });
		const deps: TicketSyncDeps = {
			client: { createTicket } as any,
			integrationId: 'int-1',
			alerts: [{ ...baseAlert, severity: 'high' }],
			resolvedAlerts: [],
			tenantToCompany: new Map([['t1', '10']]),
			saveMapping: vi.fn(),
		};

		await syncTickets(deps);
		expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ priority: 2 }));
	});
});
