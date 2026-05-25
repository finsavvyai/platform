/**
 * SCIM filter parser. RFC 7644 §3.4.2.2.
 *
 * Supports the operators IdPs (Okta, Entra ID, OneLogin, Ping) actually emit:
 *   - eq, ne, co, sw, ew, pr (presence)
 *   - and, or (boolean composition, no parens)
 *
 * Stays narrow on attributes (allowlist) so a malicious filter can't probe
 * arbitrary user fields. Anything outside scope returns null → 400 with
 * scimType "invalidFilter" at the route layer.
 *
 * Inputs are URL-decoded query strings; we still trust nothing.
 */

export type ScimOp = 'eq' | 'ne' | 'co' | 'sw' | 'ew' | 'pr';

export interface ScimSimpleFilter {
	type: 'simple';
	attribute: string;
	operator: ScimOp;
	/** Absent only for `pr` (presence). */
	value?: string;
}

export interface ScimCompoundFilter {
	type: 'compound';
	logical: 'and' | 'or';
	clauses: ScimSimpleFilter[];
}

export type ScimFilter = ScimSimpleFilter | ScimCompoundFilter;

const ALLOWED_USER_ATTRS = new Set(['userName', 'externalId', 'emails.value', 'emails.type', 'id', 'active', 'name.familyName', 'name.givenName']);
const ALLOWED_GROUP_ATTRS = new Set(['displayName', 'externalId', 'id', 'members.value']);

const VALUE_OP_RE = /\s+(eq|ne|co|sw|ew)\s+"([^"\\]*(?:\\.[^"\\]*)*)"/i;
const PRESENCE_RE = /\s+pr$/i;
const ATTR_RE = /^[a-zA-Z][a-zA-Z0-9_$.]*/;

function unescape(s: string): string {
	return s.replace(/\\(.)/g, '$1');
}

function parseClause(input: string): ScimSimpleFilter | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	const attrMatch = trimmed.match(ATTR_RE);
	if (!attrMatch) return null;
	const attribute = attrMatch[0];
	const rest = trimmed.slice(attribute.length);

	if (PRESENCE_RE.test(rest)) {
		return { type: 'simple', attribute, operator: 'pr' };
	}

	const valMatch = rest.match(VALUE_OP_RE);
	if (!valMatch) return null;
	const operator = valMatch[1].toLowerCase() as ScimOp;
	const value = unescape(valMatch[2]);
	return { type: 'simple', attribute, operator, value };
}

/**
 * Top-level entry. Supports a single clause OR boolean composition with `and` /
 * `or`. Mixing `and`+`or` in one filter is rejected (no parens supported).
 */
export function parseFilter(raw: string | undefined): ScimFilter | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// Boolean composition. We split on ` and ` first, then ` or ` — but only
	// one logical operator is allowed per filter (no nesting / parens).
	const hasAnd = / and /i.test(trimmed);
	const hasOr = / or /i.test(trimmed);
	if (hasAnd && hasOr) return null;

	if (hasAnd || hasOr) {
		const sep = hasAnd ? / and /i : / or /i;
		const parts = trimmed.split(sep);
		if (parts.length < 2 || parts.length > 4) return null;
		const clauses: ScimSimpleFilter[] = [];
		for (const p of parts) {
			const c = parseClause(p);
			if (!c) return null;
			clauses.push(c);
		}
		return { type: 'compound', logical: hasAnd ? 'and' : 'or', clauses };
	}

	const clause = parseClause(trimmed);
	return clause;
}

export function isUserAttrAllowed(attr: string): boolean {
	return ALLOWED_USER_ATTRS.has(attr);
}

export function isGroupAttrAllowed(attr: string): boolean {
	return ALLOWED_GROUP_ATTRS.has(attr);
}

export function filterAttrsAllowed(filter: ScimFilter, kind: 'user' | 'group'): boolean {
	const check = kind === 'user' ? isUserAttrAllowed : isGroupAttrAllowed;
	if (filter.type === 'simple') return check(filter.attribute);
	return filter.clauses.every(c => check(c.attribute));
}

/** Map a filter to a SQL WHERE fragment + bind params. Caller pre-validates attrs. */
export function filterToSql(filter: ScimFilter, columnFor: (attr: string) => string): { where: string; params: unknown[] } {
	if (filter.type === 'simple') {
		return clauseToSql(filter, columnFor);
	}
	const clauses = filter.clauses.map(c => clauseToSql(c, columnFor));
	const op = filter.logical === 'and' ? ' AND ' : ' OR ';
	return {
		where: clauses.map(c => `(${c.where})`).join(op),
		params: clauses.flatMap(c => c.params),
	};
}

function clauseToSql(c: ScimSimpleFilter, columnFor: (attr: string) => string): { where: string; params: unknown[] } {
	const col = columnFor(c.attribute);
	switch (c.operator) {
		case 'eq': return { where: `${col} = ?`, params: [c.value ?? ''] };
		case 'ne': return { where: `${col} != ?`, params: [c.value ?? ''] };
		case 'co': return { where: `${col} LIKE ?`, params: [`%${escapeLike(c.value ?? '')}%`] };
		case 'sw': return { where: `${col} LIKE ?`, params: [`${escapeLike(c.value ?? '')}%`] };
		case 'ew': return { where: `${col} LIKE ?`, params: [`%${escapeLike(c.value ?? '')}`] };
		case 'pr': return { where: `${col} IS NOT NULL AND ${col} != ''`, params: [] };
	}
}

function escapeLike(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export interface PaginationParams {
	startIndex: number;
	count: number;
}

export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
	const startIndex = Math.max(1, Number(query.startIndex) || 1);
	const rawCount = Number(query.count);
	// count=0 is valid SCIM (metadata-only). Negative or NaN → default 100.
	const count = Number.isFinite(rawCount) && rawCount >= 0
		? Math.min(200, rawCount)
		: 100;
	return { startIndex, count };
}
