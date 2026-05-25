/**
 * SCIM 2.0 serializer — pure functions mapping internal types to RFC 7643 / 7644
 * resource representations. No DB access; callers fetch rows then serialize.
 *
 * Scope: Users (platform_users) and Groups (platform_groups + members).
 */

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_CONTENT_TYPE = 'application/scim+json';

export interface PlatformUserRow {
	id: string;
	organization_id: string;
	email: string;
	display_name: string | null;
	role: string;
	status: string | null;
	last_login_at: number | null;
	created_at: number;
	external_id?: string | null;
}

export interface PlatformGroupRow {
	id: string;
	org_id: string;
	display_name: string;
	external_id: string | null;
	created_at: number;
	updated_at: number;
}

export interface ScimUser {
	schemas: string[];
	id: string;
	externalId?: string;
	userName: string;
	name: { formatted?: string; givenName?: string; familyName?: string };
	displayName?: string;
	emails: Array<{ value: string; type: string; primary: boolean }>;
	active: boolean;
	groups?: Array<{ value: string; display?: string; $ref?: string }>;
	meta: ScimMeta;
}

export interface ScimGroup {
	schemas: string[];
	id: string;
	externalId?: string;
	displayName: string;
	members: Array<{ value: string; display?: string; $ref?: string }>;
	meta: ScimMeta;
}

export interface ScimMeta {
	resourceType: 'User' | 'Group';
	created: string;
	lastModified: string;
	location: string;
	version?: string;
}

export interface ScimListResponse<T> {
	schemas: string[];
	totalResults: number;
	startIndex: number;
	itemsPerPage: number;
	Resources: T[];
}

export interface ScimError {
	schemas: string[];
	status: string;
	scimType?: string;
	detail: string;
}

function epochToIso(seconds: number | null | undefined): string {
	if (!seconds || !Number.isFinite(seconds)) return new Date(0).toISOString();
	return new Date(seconds * 1000).toISOString();
}

function splitName(displayName: string | null): { given?: string; family?: string; formatted?: string } {
	if (!displayName) return {};
	const trimmed = displayName.trim();
	if (!trimmed) return {};
	const parts = trimmed.split(/\s+/);
	if (parts.length === 1) return { given: parts[0], formatted: trimmed };
	return {
		given: parts[0],
		family: parts.slice(1).join(' '),
		formatted: trimmed,
	};
}

export function serializeUser(
	row: PlatformUserRow,
	baseUrl: string,
	groups?: Array<{ id: string; display_name: string }>,
): ScimUser {
	const { given, family, formatted } = splitName(row.display_name);
	const created = epochToIso(row.created_at);
	const updated = epochToIso(row.last_login_at ?? row.created_at);
	return {
		schemas: [USER_SCHEMA],
		id: row.id,
		externalId: row.external_id ?? undefined,
		userName: row.email,
		name: { formatted, givenName: given, familyName: family },
		displayName: row.display_name ?? row.email,
		emails: [{ value: row.email, type: 'work', primary: true }],
		active: (row.status ?? 'active') === 'active',
		groups: groups?.map((g) => ({
			value: g.id,
			display: g.display_name,
			$ref: `${baseUrl}/Groups/${g.id}`,
		})),
		meta: {
			resourceType: 'User',
			created,
			lastModified: updated,
			location: `${baseUrl}/Users/${row.id}`,
		},
	};
}

export function serializeGroup(
	row: PlatformGroupRow,
	baseUrl: string,
	members: Array<{ id: string; email: string }> = [],
): ScimGroup {
	return {
		schemas: [GROUP_SCHEMA],
		id: row.id,
		externalId: row.external_id ?? undefined,
		displayName: row.display_name,
		members: members.map((m) => ({
			value: m.id,
			display: m.email,
			$ref: `${baseUrl}/Users/${m.id}`,
		})),
		meta: {
			resourceType: 'Group',
			created: epochToIso(row.created_at),
			lastModified: epochToIso(row.updated_at),
			location: `${baseUrl}/Groups/${row.id}`,
		},
	};
}

export function serializeList<T>(
	resources: T[],
	startIndex: number,
	itemsPerPage: number,
	totalResults: number,
): ScimListResponse<T> {
	return {
		schemas: [LIST_SCHEMA],
		totalResults,
		startIndex,
		itemsPerPage,
		Resources: resources,
	};
}

export function scimError(status: number, detail: string, scimType?: string): ScimError {
	return {
		schemas: [ERROR_SCHEMA],
		status: String(status),
		scimType,
		detail,
	};
}
