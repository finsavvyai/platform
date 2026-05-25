import { describe, it, expect, vi } from 'vitest';
import { syncCompanies, findBestMatch } from './company-sync';
import type { CompanySyncDeps } from './company-sync';

describe('findBestMatch', () => {
	const companies = [
		{ id: '1', name: 'Acme Corp' },
		{ id: '2', name: 'Contoso Ltd' },
		{ id: '3', name: 'Fabrikam Inc' },
	];

	it('returns exact match with confidence 1.0', () => {
		const result = findBestMatch('Acme Corp', companies);
		expect(result).toEqual({ id: '1', name: 'Acme Corp', confidence: 1.0 });
	});

	it('returns case-insensitive exact match', () => {
		const result = findBestMatch('acme corp', companies);
		expect(result).toEqual({ id: '1', name: 'Acme Corp', confidence: 1.0 });
	});

	it('returns partial match with high confidence', () => {
		const result = findBestMatch('Contoso', companies);
		expect(result).not.toBeNull();
		expect(result!.id).toBe('2');
		expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
	});

	it('returns null for no match', () => {
		const result = findBestMatch('NonExistent', companies);
		expect(result).toBeNull();
	});

	it('returns null for low confidence match', () => {
		const result = findBestMatch('AB', companies);
		expect(result).toBeNull();
	});
});

describe('syncCompanies', () => {
	it('maps tenants to CW companies by name', async () => {
		const saveMapping = vi.fn();
		const deps: CompanySyncDeps = {
			client: {
				getCompanies: vi.fn().mockResolvedValue([
					{ id: '10', name: 'Acme Corp', identifier: 'acme' },
					{ id: '20', name: 'Contoso', identifier: 'contoso' },
				]),
			} as any,
			integrationId: 'int-1',
			tenants: [
				{ id: 't1', displayName: 'Acme Corp' },
				{ id: 't2', displayName: 'Unknown Tenant' },
			],
			existingMappings: new Map(),
			saveMapping,
		};

		const result = await syncCompanies(deps);
		expect(result.created).toBe(1);
		expect(result.failed).toBe(0);
		expect(saveMapping).toHaveBeenCalledWith('t1', '10', 'Acme Corp');
	});

	it('skips already mapped tenants', async () => {
		const saveMapping = vi.fn();
		const deps: CompanySyncDeps = {
			client: { getCompanies: vi.fn().mockResolvedValue([]) } as any,
			integrationId: 'int-1',
			tenants: [{ id: 't1', displayName: 'Acme Corp' }],
			existingMappings: new Map([['t1', '10']]),
			saveMapping,
		};

		const result = await syncCompanies(deps);
		expect(result.updated).toBe(1);
		expect(result.created).toBe(0);
		expect(saveMapping).not.toHaveBeenCalled();
	});
});
