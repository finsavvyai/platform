import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportCsv, exportJson, copyToClipboard } from './export';

describe('exportCsv', () => {
	let createObjectURLSpy: ReturnType<typeof vi.fn>;
	let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
	let clickSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clickSpy = vi.fn();
		createObjectURLSpy = vi.fn().mockReturnValue('blob:test');
		revokeObjectURLSpy = vi.fn();
		globalThis.URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;
		globalThis.URL.revokeObjectURL = revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL;
		vi.spyOn(document, 'createElement').mockReturnValue({
			href: '',
			download: '',
			click: clickSpy
		} as unknown as HTMLAnchorElement);
	});

	it('should create a CSV blob and trigger download', () => {
		const rows = [
			{ name: 'Alice', age: 30 },
			{ name: 'Bob', age: 25 }
		];
		const columns = [
			{ key: 'name' as const, label: 'Name' },
			{ key: 'age' as const, label: 'Age' }
		];

		exportCsv(rows, columns, 'users');

		expect(createObjectURLSpy).toHaveBeenCalledOnce();
		const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
		expect(blob.type).toBe('text/csv;charset=utf-8;');
		expect(clickSpy).toHaveBeenCalledOnce();
		expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
	});

	it('should escape CSV values with commas and quotes', () => {
		const rows = [{ val: 'has, comma' }, { val: 'has "quotes"' }];
		const columns = [{ key: 'val' as const, label: 'Value' }];

		exportCsv(rows, columns, 'test');

		const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
		expect(blob).toBeInstanceOf(Blob);
	});
});

describe('exportJson', () => {
	let createObjectURLSpy: ReturnType<typeof vi.fn>;
	let clickSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clickSpy = vi.fn();
		createObjectURLSpy = vi.fn().mockReturnValue('blob:test');
		globalThis.URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;
		globalThis.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
		vi.spyOn(document, 'createElement').mockReturnValue({
			href: '',
			download: '',
			click: clickSpy
		} as unknown as HTMLAnchorElement);
	});

	it('should create a JSON blob with metadata wrapper', () => {
		const data = [{ id: 1, name: 'Test' }];
		exportJson(data, { type: 'alerts', tenant: 'acme.com' }, 'alerts');

		expect(createObjectURLSpy).toHaveBeenCalledOnce();
		const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
		expect(blob.type).toBe('application/json;charset=utf-8;');
		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('should include totalCount in metadata', () => {
		const data = [{ a: 1 }, { a: 2 }, { a: 3 }];
		exportJson(data, { type: 'test' }, 'test');
		expect(createObjectURLSpy).toHaveBeenCalledOnce();
	});
});

describe('copyToClipboard', () => {
	it('should return true on success', async () => {
		Object.assign(navigator, {
			clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
		});
		const result = await copyToClipboard('hello');
		expect(result).toBe(true);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
	});

	it('should return false on failure', async () => {
		Object.assign(navigator, {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
		});
		const result = await copyToClipboard('hello');
		expect(result).toBe(false);
	});
});
