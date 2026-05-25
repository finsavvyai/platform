import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PartnerCenterClient } from './graph-client';
import type { ClientEnv } from '../graph-types';

// We mock the underlying GraphClient by stubbing its `request` and `fetchAll`.
function makeClient(): { client: PartnerCenterClient; request: ReturnType<typeof vi.fn>; fetchAll: ReturnType<typeof vi.fn> } {
	const env = {
		KV: {
			get: vi.fn(async () => 'cached-token'),
			put: vi.fn(async () => undefined),
		},
	} as unknown as ClientEnv;
	const client = new PartnerCenterClient(env, 'partner-tenant-id');
	const request = vi.fn();
	const fetchAll = vi.fn();
	(client as unknown as { graph: { request: typeof request; fetchAll: typeof fetchAll; base: string } }).graph.request = request;
	(client as unknown as { graph: { request: typeof request; fetchAll: typeof fetchAll; base: string } }).graph.fetchAll = fetchAll;
	return { client, request, fetchAll };
}

describe('PartnerCenterClient.createRelationship', () => {
	it('POSTs the right body shape to delegatedAdminRelationships', async () => {
		const { client, request } = makeClient();
		request.mockResolvedValueOnce({
			id: 'rel-1', displayName: 'Acme Corp', status: 'created',
			duration: 'P180D', customer: { tenantId: 'cust-1' },
		});
		const r = await client.createRelationship({
			displayName: 'Acme Corp',
			customerTenantId: 'cust-1',
			durationInDays: 180,
			unifiedRoles: [{ roleDefinitionId: '62e90394-69f5-4237-9190-012177145e10' }],
		});
		expect(r.id).toBe('rel-1');
		expect(request).toHaveBeenCalledOnce();
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/tenantRelationships\/delegatedAdminRelationships$/);
		expect((init as { method: string }).method).toBe('POST');
		const body = JSON.parse((init as { body: string }).body);
		expect(body.displayName).toBe('Acme Corp');
		expect(body.duration).toBe('P180D');
		expect(body.customer.tenantId).toBe('cust-1');
		expect(body.accessDetails.unifiedRoles).toHaveLength(1);
	});
});

describe('PartnerCenterClient.sendInvitation', () => {
	it('POSTs lockForApproval action to /requests', async () => {
		const { client, request } = makeClient();
		request.mockResolvedValueOnce({ inviteUrl: 'https://admin.microsoft.com/AdminPortal/...' });
		const r = await client.sendInvitation('rel-1');
		expect(r.inviteUrl).toContain('admin.microsoft.com');
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/rel-1\/requests$/);
		expect(JSON.parse((init as { body: string }).body)).toEqual({ action: 'lockForApproval' });
	});
});

describe('PartnerCenterClient.createAccessAssignment', () => {
	it('binds a security group + roles to the relationship', async () => {
		const { client, request } = makeClient();
		request.mockResolvedValueOnce({
			id: 'aa-1', status: 'pending',
			accessContainer: { accessContainerId: 'sg-1', accessContainerType: 'securityGroup' },
			accessDetails: { unifiedRoles: [{ roleDefinitionId: 'role-1' }, { roleDefinitionId: 'role-2' }] },
		});
		const r = await client.createAccessAssignment('rel-1', 'sg-1', ['role-1', 'role-2']);
		expect(r.id).toBe('aa-1');
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/rel-1\/accessAssignments$/);
		const body = JSON.parse((init as { body: string }).body);
		expect(body.accessContainer.accessContainerType).toBe('securityGroup');
		expect(body.accessDetails.unifiedRoles).toHaveLength(2);
	});
});

describe('PartnerCenterClient.listRelationships', () => {
	it('uses fetchAll to paginate through delegated relationships', async () => {
		const { client, fetchAll } = makeClient();
		fetchAll.mockResolvedValueOnce([
			{ id: 'rel-1', displayName: 'Acme', status: 'active', duration: 'P180D' },
			{ id: 'rel-2', displayName: 'Globex', status: 'created', duration: 'P365D' },
		]);
		const list = await client.listRelationships();
		expect(list).toHaveLength(2);
		expect(list[0].id).toBe('rel-1');
	});
});

describe('PartnerCenterClient.terminateRelationship', () => {
	it('POSTs terminationRequested action', async () => {
		const { client, request } = makeClient();
		request.mockResolvedValueOnce(undefined);
		await client.terminateRelationship('rel-1');
		const [url, init] = request.mock.calls[0];
		expect(url).toMatch(/\/rel-1\/requests$/);
		expect(JSON.parse((init as { body: string }).body)).toEqual({ action: 'terminationRequested' });
	});
});

describe('PartnerCenterClient.getRelationship', () => {
	it('GETs the specific relationship', async () => {
		const { client, request } = makeClient();
		request.mockResolvedValueOnce({ id: 'rel-1', displayName: 'Acme', status: 'active', duration: 'P180D' });
		const r = await client.getRelationship('rel-1');
		expect(r.id).toBe('rel-1');
		const [url] = request.mock.calls[0];
		expect(url).toMatch(/\/rel-1$/);
	});
});

describe('PartnerCenterClient.listAccessAssignments', () => {
	it('uses fetchAll to paginate access assignments', async () => {
		const { client, fetchAll } = makeClient();
		fetchAll.mockResolvedValueOnce([{ id: 'aa-1', status: 'active', accessContainer: { accessContainerId: 'sg-1', accessContainerType: 'securityGroup' }, accessDetails: { unifiedRoles: [] } }]);
		const list = await client.listAccessAssignments('rel-1');
		expect(list).toHaveLength(1);
	});
});
