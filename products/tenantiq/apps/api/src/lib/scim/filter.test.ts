import { describe, expect, it } from 'vitest';
import {
	parseFilter,
	parsePagination,
	isUserAttrAllowed,
	isGroupAttrAllowed,
	filterAttrsAllowed,
	filterToSql,
	type ScimSimpleFilter,
} from './filter';

describe('parseFilter — simple clauses', () => {
	it('parses userName eq', () => {
		expect(parseFilter('userName eq "alice@x.com"')).toEqual({
			type: 'simple', attribute: 'userName', operator: 'eq', value: 'alice@x.com',
		});
	});

	it('parses externalId eq', () => {
		expect(parseFilter('externalId eq "okta-001"')).toEqual({
			type: 'simple', attribute: 'externalId', operator: 'eq', value: 'okta-001',
		});
	});

	it('parses dotted path emails.value eq', () => {
		expect(parseFilter('emails.value eq "x@y.com"')).toEqual({
			type: 'simple', attribute: 'emails.value', operator: 'eq', value: 'x@y.com',
		});
	});

	it('handles escaped quotes in value', () => {
		const r = parseFilter('userName eq "name\\"escape"') as ScimSimpleFilter;
		expect(r?.value).toBe('name"escape');
	});

	it('parses each new operator', () => {
		expect((parseFilter('userName co "ali"') as ScimSimpleFilter)?.operator).toBe('co');
		expect((parseFilter('userName sw "ali"') as ScimSimpleFilter)?.operator).toBe('sw');
		expect((parseFilter('userName ew "@x.com"') as ScimSimpleFilter)?.operator).toBe('ew');
		expect((parseFilter('userName ne "alice"') as ScimSimpleFilter)?.operator).toBe('ne');
	});

	it('parses presence (pr)', () => {
		expect(parseFilter('externalId pr')).toEqual({
			type: 'simple', attribute: 'externalId', operator: 'pr',
		});
	});

	it('returns null for empty/whitespace', () => {
		expect(parseFilter(undefined)).toBeNull();
		expect(parseFilter('')).toBeNull();
		expect(parseFilter('   ')).toBeNull();
	});

	it('returns null for malformed input', () => {
		expect(parseFilter('userName eq alice')).toBeNull();
		expect(parseFilter('"only quotes"')).toBeNull();
	});
});

describe('parseFilter — compound clauses', () => {
	it('parses and-composition', () => {
		const r = parseFilter('userName eq "a@x" and externalId eq "ext-1"');
		expect(r).toEqual({
			type: 'compound', logical: 'and',
			clauses: [
				{ type: 'simple', attribute: 'userName', operator: 'eq', value: 'a@x' },
				{ type: 'simple', attribute: 'externalId', operator: 'eq', value: 'ext-1' },
			],
		});
	});

	it('parses or-composition', () => {
		const r = parseFilter('userName eq "a@x" or userName eq "b@x"');
		expect(r?.type).toBe('compound');
	});

	it('rejects mixed and/or (no parens supported)', () => {
		expect(parseFilter('a eq "1" and b eq "2" or c eq "3"')).toBeNull();
	});

	it('rejects single-clause "and"', () => {
		expect(parseFilter('userName eq "alice"' /* no 'and' */)?.type).toBe('simple');
	});

	it('rejects too many clauses (>4)', () => {
		expect(parseFilter('a eq "1" and b eq "2" and c eq "3" and d eq "4" and e eq "5"')).toBeNull();
	});
});

describe('parsePagination', () => {
	it('uses defaults when missing', () => {
		expect(parsePagination({})).toEqual({ startIndex: 1, count: 100 });
	});

	it('respects provided values', () => {
		expect(parsePagination({ startIndex: '5', count: '20' })).toEqual({ startIndex: 5, count: 20 });
	});

	it('clamps startIndex to >=1', () => {
		expect(parsePagination({ startIndex: '0' }).startIndex).toBe(1);
		expect(parsePagination({ startIndex: '-5' }).startIndex).toBe(1);
	});

	it('clamps count to <=200', () => {
		expect(parsePagination({ count: '500' }).count).toBe(200);
	});

	it('clamps count to >=0', () => {
		expect(parsePagination({ count: '-1' }).count).toBe(100);
	});

	it('handles non-numeric input by defaulting', () => {
		expect(parsePagination({ count: 'foo' }).count).toBe(100);
	});
});

describe('attribute allowlists', () => {
	it('allows expected user attrs', () => {
		expect(isUserAttrAllowed('userName')).toBe(true);
		expect(isUserAttrAllowed('externalId')).toBe(true);
		expect(isUserAttrAllowed('emails.value')).toBe(true);
		expect(isUserAttrAllowed('id')).toBe(true);
		expect(isUserAttrAllowed('active')).toBe(true);
		expect(isUserAttrAllowed('name.givenName')).toBe(true);
		expect(isUserAttrAllowed('name.familyName')).toBe(true);
		expect(isUserAttrAllowed('emails.type')).toBe(true);
	});

	it('rejects unsupported user attrs', () => {
		expect(isUserAttrAllowed('password')).toBe(false);
		expect(isUserAttrAllowed('phoneNumbers.value')).toBe(false);
	});

	it('allows expected group attrs', () => {
		expect(isGroupAttrAllowed('displayName')).toBe(true);
		expect(isGroupAttrAllowed('externalId')).toBe(true);
		expect(isGroupAttrAllowed('members.value')).toBe(true);
	});
});

describe('filterAttrsAllowed', () => {
	it('checks every clause in compound filters', () => {
		const ok = parseFilter('userName eq "a" and externalId eq "b"');
		expect(filterAttrsAllowed(ok!, 'user')).toBe(true);

		const bad = parseFilter('userName eq "a" and password eq "b"');
		expect(filterAttrsAllowed(bad!, 'user')).toBe(false);
	});
});

describe('filterToSql', () => {
	const col = (a: string) => a === 'userName' ? 'user_principal_name' : a === 'externalId' ? 'external_id' : a;

	it('emits parameterized eq', () => {
		const f = parseFilter('userName eq "a@x"')!;
		expect(filterToSql(f, col)).toEqual({ where: 'user_principal_name = ?', params: ['a@x'] });
	});

	it('emits LIKE for co/sw/ew with escaped wildcards', () => {
		expect(filterToSql(parseFilter('userName co "a%b"')!, col)).toEqual({
			where: 'user_principal_name LIKE ?', params: ['%a\\%b%'],
		});
		expect(filterToSql(parseFilter('userName sw "a"')!, col).where).toBe('user_principal_name LIKE ?');
		expect(filterToSql(parseFilter('userName ew "@x.com"')!, col).params).toEqual(['%@x.com']);
	});

	it('emits IS NOT NULL for pr', () => {
		expect(filterToSql(parseFilter('externalId pr')!, col).where).toContain('IS NOT NULL');
	});

	it('joins compound clauses with AND/OR', () => {
		const r = filterToSql(parseFilter('userName eq "a" and externalId eq "b"')!, col);
		expect(r.where).toBe('(user_principal_name = ?) AND (external_id = ?)');
		expect(r.params).toEqual(['a', 'b']);
	});
});
