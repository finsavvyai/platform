import { describe, it, expect } from 'vitest';
import { checkRequiredSku, buildUpsell, TASK_LICENSE_REQUIREMENTS } from './task-license-requirements';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

describe('checkRequiredSku', () => {
	it('returns null for actions that need no premium SKU', () => {
		expect(checkRequiredSku(REMEDIATION_ACTION_IDS.REM_001, [])).toBeNull();
		expect(checkRequiredSku(REMEDIATION_ACTION_IDS.REM_005, [])).toBeNull();
	});

	it('returns Entra P1 requirement when CA action and tenant lacks P1', () => {
		const r = checkRequiredSku(REMEDIATION_ACTION_IDS.REM_002, []);
		expect(r?.display).toBe('Entra ID P1');
	});

	it('returns null when tenant already has Entra P1', () => {
		const r = checkRequiredSku(REMEDIATION_ACTION_IDS.REM_002, [
			{ skuPartNumber: 'AAD_PREMIUM' },
		]);
		expect(r).toBeNull();
	});

	it('returns null when tenant has bundle that includes P1 (E3)', () => {
		const r = checkRequiredSku(REMEDIATION_ACTION_IDS.REM_002, [
			{ skuPartNumber: 'SPE_E3' },
		]);
		expect(r).toBeNull();
	});

	it('matches case-insensitively', () => {
		const r = checkRequiredSku(REMEDIATION_ACTION_IDS.REM_002, [
			{ skuPartNumber: 'aad_premium' },
		]);
		expect(r).toBeNull();
	});

	it('returns null for unknown action types', () => {
		expect(checkRequiredSku('UNKNOWN_ACTION', [])).toBeNull();
	});

	it('every defined remediation action has an explicit license entry', () => {
		for (const actionId of Object.values(REMEDIATION_ACTION_IDS)) {
			expect(actionId in TASK_LICENSE_REQUIREMENTS).toBe(true);
		}
	});
});

describe('buildUpsell', () => {
	it('multiplies seats by per-user price', () => {
		const required = { anyOf: ['X'], display: 'X', reason: 'x', priceUsdPerUserPerMonth: 6 };
		const u = buildUpsell(required, 10);
		expect(u.suggestedSeats).toBe(10);
		expect(u.estimatedMonthlyCostUsd).toBe(60);
	});

	it('floors seats at 1 even when affectedUsers is 0', () => {
		const required = { anyOf: ['X'], display: 'X', reason: 'x', priceUsdPerUserPerMonth: 6 };
		const u = buildUpsell(required, 0);
		expect(u.suggestedSeats).toBe(1);
		expect(u.estimatedMonthlyCostUsd).toBe(6);
	});
});
