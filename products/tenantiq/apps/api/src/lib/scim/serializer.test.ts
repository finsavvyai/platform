import { describe, expect, it } from 'vitest';
import {
	serializeUser,
	serializeGroup,
	serializeList,
	scimError,
	type PlatformUserRow,
	type PlatformGroupRow,
} from './serializer';

const baseUrl = 'https://api.tenantiq.app/scim/v2';

const userRow: PlatformUserRow = {
	id: 'u-1',
	organization_id: 'org-1',
	email: 'alice@x.com',
	display_name: 'Alice Wonder',
	role: 'admin',
	status: 'active',
	last_login_at: 1714000000,
	created_at: 1700000000,
	external_id: 'okta-abc',
};

describe('serializeUser', () => {
	it('emits core SCIM User schema', () => {
		const u = serializeUser(userRow, baseUrl);
		expect(u.schemas).toEqual(['urn:ietf:params:scim:schemas:core:2.0:User']);
		expect(u.id).toBe('u-1');
		expect(u.userName).toBe('alice@x.com');
		expect(u.externalId).toBe('okta-abc');
		expect(u.active).toBe(true);
		expect(u.emails).toEqual([{ value: 'alice@x.com', type: 'work', primary: true }]);
	});

	it('splits display name into given/family', () => {
		const u = serializeUser(userRow, baseUrl);
		expect(u.name.givenName).toBe('Alice');
		expect(u.name.familyName).toBe('Wonder');
		expect(u.name.formatted).toBe('Alice Wonder');
	});

	it('handles single-word display name (givenName only)', () => {
		const u = serializeUser({ ...userRow, display_name: 'Alice' }, baseUrl);
		expect(u.name.givenName).toBe('Alice');
		expect(u.name.familyName).toBeUndefined();
	});

	it('handles missing display name', () => {
		const u = serializeUser({ ...userRow, display_name: null }, baseUrl);
		expect(u.name).toEqual({});
		expect(u.displayName).toBe('alice@x.com');
	});

	it('marks inactive when status not active', () => {
		const u = serializeUser({ ...userRow, status: 'inactive' }, baseUrl);
		expect(u.active).toBe(false);
	});

	it('builds meta.location URL', () => {
		const u = serializeUser(userRow, baseUrl);
		expect(u.meta.location).toBe(`${baseUrl}/Users/u-1`);
		expect(u.meta.resourceType).toBe('User');
	});

	it('attaches groups when provided', () => {
		const u = serializeUser(userRow, baseUrl, [{ id: 'g-1', display_name: 'Engineering' }]);
		expect(u.groups).toEqual([
			{ value: 'g-1', display: 'Engineering', $ref: `${baseUrl}/Groups/g-1` },
		]);
	});

	it('converts epoch seconds to ISO 8601', () => {
		const u = serializeUser(userRow, baseUrl);
		expect(u.meta.created).toMatch(/^2023-/);
		expect(u.meta.lastModified).toMatch(/Z$/);
	});
});

const groupRow: PlatformGroupRow = {
	id: 'g-1',
	org_id: 'org-1',
	display_name: 'Engineering',
	external_id: 'okta-grp-eng',
	created_at: 1700000000,
	updated_at: 1714000000,
};

describe('serializeGroup', () => {
	it('emits core SCIM Group schema', () => {
		const g = serializeGroup(groupRow, baseUrl, [{ id: 'u-1', email: 'alice@x.com' }]);
		expect(g.schemas).toEqual(['urn:ietf:params:scim:schemas:core:2.0:Group']);
		expect(g.displayName).toBe('Engineering');
		expect(g.externalId).toBe('okta-grp-eng');
		expect(g.members).toEqual([
			{ value: 'u-1', display: 'alice@x.com', $ref: `${baseUrl}/Users/u-1` },
		]);
	});

	it('handles empty members', () => {
		const g = serializeGroup(groupRow, baseUrl);
		expect(g.members).toEqual([]);
	});

	it('omits externalId when null', () => {
		const g = serializeGroup({ ...groupRow, external_id: null }, baseUrl);
		expect(g.externalId).toBeUndefined();
	});
});

describe('serializeList', () => {
	it('wraps resources in ListResponse envelope', () => {
		const list = serializeList([{ a: 1 }, { a: 2 }], 1, 100, 2);
		expect(list.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
		expect(list.totalResults).toBe(2);
		expect(list.startIndex).toBe(1);
		expect(list.itemsPerPage).toBe(100);
		expect(list.Resources).toHaveLength(2);
	});

	it('reports paging counts honestly when total > page', () => {
		const list = serializeList([{}, {}, {}], 11, 3, 100);
		expect(list.startIndex).toBe(11);
		expect(list.itemsPerPage).toBe(3);
		expect(list.totalResults).toBe(100);
	});
});

describe('scimError', () => {
	it('emits Error schema with status string', () => {
		const e = scimError(404, 'Not found');
		expect(e.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
		expect(e.status).toBe('404');
		expect(e.detail).toBe('Not found');
	});

	it('includes scimType when provided', () => {
		const e = scimError(400, 'bad', 'invalidFilter');
		expect(e.scimType).toBe('invalidFilter');
	});
});
