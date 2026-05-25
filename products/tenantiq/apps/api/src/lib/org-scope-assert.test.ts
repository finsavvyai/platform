import { describe, it, expect } from 'vitest';
import { assertOrgId } from './org-scope-assert';

// RED state: ./org-scope-assert.ts does not exist yet.
// vitest will fail with "Cannot find module './org-scope-assert'" until
// Wave 1 (plan 04-02) creates the implementation.

describe('assertOrgId', () => {
	it('throws on null', () => {
		expect(() => assertOrgId(null, 'TestCron')).toThrow('[TestCron]');
	});

	it('throws on undefined', () => {
		expect(() => assertOrgId(undefined, 'TestRoute')).toThrow('[TestRoute]');
	});

	it('throws on empty string', () => {
		expect(() => assertOrgId('', 'TestHandler')).toThrow('[TestHandler]');
	});

	it('does not throw for a valid org id', () => {
		expect(() => assertOrgId('org-abc', 'TestCtx')).not.toThrow();
	});

	it('thrown error message includes org_id scope required', () => {
		expect(() => assertOrgId(null, 'SomeCtx')).toThrow('org_id scope required');
	});

	it('thrown error message includes context name in brackets', () => {
		try {
			assertOrgId(undefined, 'MyContext');
			expect.fail('should have thrown');
		} catch (err) {
			expect((err as Error).message).toContain('[MyContext]');
		}
	});
});
