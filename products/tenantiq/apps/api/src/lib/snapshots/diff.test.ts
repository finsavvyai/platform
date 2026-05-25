import { describe, expect, it } from 'vitest';
import { diffSnapshots, type CategoryDiff } from './diff';

describe('Config Diff Engine', () => {
	it('returns empty when snapshots are identical', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { enabled: true } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { enabled: true } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(0);
	});

	it('detects changed values', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { enabled: true } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { enabled: false } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].type).toBe('changed');
		expect(result[0].changes[0].path).toBe('enabled');
	});

	it('detects added properties', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { a: 1 } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { a: 1, b: 2 } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].type).toBe('added');
	});

	it('detects removed properties', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { a: 1, b: 2 } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { a: 1 } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].type).toBe('removed');
	});

	it('detects removed categories', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { x: 1 } }];
		const newCats: typeof old = [];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].categoryId).toBe('ca');
		expect(result[0].changes[0].type).toBe('removed');
	});

	it('detects new category from null old', () => {
		const old: any[] = [];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { enabled: true } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].type).toBe('added');
	});

	it('handles nested object diffs', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { policy: { mfa: true, geo: false } } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { policy: { mfa: false, geo: false } } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].path).toBe('policy.mfa');
	});

	it('handles type changes', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { val: 'string' } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { val: 42 } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].type).toBe('changed');
	});

	it('detects array changes', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { list: [1, 2] } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { list: [1, 2, 3] } }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(1);
		expect(result[0].changes[0].type).toBe('changed');
	});

	it('returns correct changeCount', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: { a: 1, b: 2 } }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: { a: 99, b: 88 } }];
		const result = diffSnapshots(old, newCats);
		expect(result[0].changeCount).toBe(2);
	});

	it('handles both null data gracefully', () => {
		const old = [{ categoryId: 'ca', name: 'CA', data: null }];
		const newCats = [{ categoryId: 'ca', name: 'CA', data: null }];
		const result = diffSnapshots(old, newCats);
		expect(result).toHaveLength(0);
	});
});
