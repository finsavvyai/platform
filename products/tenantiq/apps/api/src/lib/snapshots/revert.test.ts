import { describe, it, expect } from 'vitest';
import { planRevert, planBulkRevert, subPathToObject, SUPPORTED_CATEGORIES } from './revert';

describe('subPathToObject', () => {
	it('builds nested object from dotted path', () => {
		expect(subPathToObject('a.b.c', 42)).toEqual({ a: { b: { c: 42 } } });
	});
	it('handles single segment', () => {
		expect(subPathToObject('flag', true)).toEqual({ flag: true });
	});
	it('returns value as-is when path is empty', () => {
		expect(subPathToObject('', { x: 1 })).toEqual({ x: 1 });
	});
});

describe('planRevert — conditional_access', () => {
	it('issues DELETE when policy was added since baseline', () => {
		const r = planRevert({
			categoryId: 'conditional_access',
			path: 'pol-1',
			oldValue: null,
			newValue: { id: 'pol-1', state: 'enabled' },
		});
		expect(r.supported).toBe(true);
		if (r.supported) {
			expect(r.ops).toHaveLength(1);
			expect(r.ops[0]).toEqual({ method: 'DELETE', path: '/identity/conditionalAccess/policies/pol-1' });
		}
	});

	it('issues POST to recreate when policy was deleted since baseline', () => {
		const r = planRevert({
			categoryId: 'conditional_access',
			path: 'pol-1',
			oldValue: { id: 'pol-1', state: 'enabled' },
			newValue: null,
		});
		expect(r.supported).toBe(true);
		if (r.supported) expect(r.ops[0].method).toBe('POST');
	});

	it('issues PATCH for property change on existing policy', () => {
		const r = planRevert({
			categoryId: 'conditional_access',
			path: 'pol-1.state',
			oldValue: 'enabled',
			newValue: 'disabled',
		});
		expect(r.supported).toBe(true);
		if (r.supported) {
			expect(r.ops[0]).toEqual({
				method: 'PATCH',
				path: '/identity/conditionalAccess/policies/pol-1',
				body: { state: 'enabled' },
			});
		}
	});

	it('builds nested PATCH body for deep property paths', () => {
		const r = planRevert({
			categoryId: 'conditional_access',
			path: 'pol-1.conditions.users.includeUsers',
			oldValue: ['all'],
			newValue: ['xyz'],
		});
		expect(r.supported).toBe(true);
		if (r.supported) {
			expect(r.ops[0].body).toEqual({ conditions: { users: { includeUsers: ['all'] } } });
		}
	});
});

describe('planRevert — authorization', () => {
	it('PATCH-es authorizationPolicy with subpath body', () => {
		const r = planRevert({
			categoryId: 'authorization',
			path: 'allowInvitesFrom',
			oldValue: 'adminsAndGuestInviters',
			newValue: 'everyone',
		});
		expect(r.supported).toBe(true);
		if (r.supported) {
			expect(r.ops[0]).toEqual({
				method: 'PATCH',
				path: '/policies/authorizationPolicy',
				body: { allowInvitesFrom: 'adminsAndGuestInviters' },
			});
		}
	});
});

describe('planRevert — auth_methods', () => {
	it('PATCH-es authenticationMethodsPolicy with subpath body', () => {
		const r = planRevert({
			categoryId: 'auth_methods',
			path: 'authenticationMethodConfigurations.fido2.state',
			oldValue: 'enabled',
			newValue: 'disabled',
		});
		expect(r.supported).toBe(true);
		if (r.supported) {
			expect(r.ops[0].path).toBe('/policies/authenticationMethodsPolicy');
		}
	});
});

describe('planRevert — unsupported categories', () => {
	it('returns supported:false for sensitivity_labels', () => {
		const r = planRevert({
			categoryId: 'sensitivity_labels',
			path: 'lbl-1.priority',
			oldValue: 0, newValue: 1,
		});
		expect(r.supported).toBe(false);
		if (!r.supported) expect(r.reason).toMatch(/not yet revertable/i);
	});

	it('returns supported:false for unknown categories', () => {
		const r = planRevert({ categoryId: 'gibberish', path: 'x', oldValue: 0, newValue: 1 });
		expect(r.supported).toBe(false);
	});
});

describe('SUPPORTED_CATEGORIES', () => {
	it('starts with 3 categories', () => {
		expect(SUPPORTED_CATEGORIES.size).toBe(3);
		expect(SUPPORTED_CATEGORIES.has('conditional_access')).toBe(true);
		expect(SUPPORTED_CATEGORIES.has('authorization')).toBe(true);
		expect(SUPPORTED_CATEGORIES.has('auth_methods')).toBe(true);
	});
});

describe('planBulkRevert', () => {
	it('partitions supported and unsupported drifts', () => {
		const r = planBulkRevert([
			{ categoryId: 'conditional_access', path: 'a.state', oldValue: 'on', newValue: 'off' },
			{ categoryId: 'sensitivity_labels', path: 'l.priority', oldValue: 0, newValue: 1 },
			{ categoryId: 'authorization', path: 'allowInvitesFrom', oldValue: 'adminsOnly', newValue: 'everyone' },
		]);
		expect(r.supported).toHaveLength(2);
		expect(r.unsupported).toHaveLength(1);
		expect(r.unsupported[0].drift.categoryId).toBe('sensitivity_labels');
	});
});
