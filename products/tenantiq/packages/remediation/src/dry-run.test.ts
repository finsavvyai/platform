import { describe, expect, it } from 'vitest';
import { getDryRunResult } from './dry-run';

const actionIds = [
	'REM-001', 'REM-002', 'REM-003', 'REM-004', 'REM-005',
	'REM-006', 'REM-007', 'REM-008', 'REM-009',
];

describe('Dry Run Module', () => {
	it.each(actionIds)('%s returns non-empty changes', async (actionId) => {
		const result = await getDryRunResult(actionId, { name: 'Test User', licenseCount: 3 });
		expect(result.changes.length).toBeGreaterThan(0);
	});

	it.each(actionIds)('%s returns estimatedDuration', async (actionId) => {
		const result = await getDryRunResult(actionId, {});
		expect(result.estimatedDuration).toBeTruthy();
		expect(result.estimatedDuration).not.toBe('unknown');
	});

	it.each(actionIds)('%s returns reversible flag as boolean', async (actionId) => {
		const result = await getDryRunResult(actionId, {});
		expect(typeof result.reversible).toBe('boolean');
	});

	it.each(actionIds)('%s affectedResources matches changes length', async (actionId) => {
		const result = await getDryRunResult(actionId, {});
		expect(result.affectedResources).toBe(result.changes.length);
	});

	it('REM-001 includes account, sessions, and license changes', async () => {
		const result = await getDryRunResult('REM-001', { licenseCount: 5 });
		expect(result.changes).toHaveLength(3);
		const fields = result.changes.map((c) => c.field);
		expect(fields).toContain('accountEnabled');
		expect(fields).toContain('activeSessions');
		expect(fields).toContain('assignedLicenses');
	});

	it('REM-005 is not reversible (session revoke)', async () => {
		const result = await getDryRunResult('REM-005', { name: 'user@test.com' });
		expect(result.reversible).toBe(false);
	});

	it('REM-002 is reversible (MFA policy)', async () => {
		const result = await getDryRunResult('REM-002', {});
		expect(result.reversible).toBe(true);
	});

	it('unknown action type returns empty changes', async () => {
		const result = await getDryRunResult('UNKNOWN', {});
		expect(result.changes).toHaveLength(0);
		expect(result.estimatedDuration).toBe('unknown');
		expect(result.reversible).toBe(false);
		expect(result.affectedResources).toBe(0);
	});

	it('REM-004 uses param names in resource', async () => {
		const result = await getDryRunResult('REM-004', { name: 'John Doe', currentSkuId: 'E5', targetSkuId: 'E3' });
		const change = result.changes[0];
		expect(change.resource).toContain('John Doe');
		expect(change.currentValue).toContain('E5');
		expect(change.proposedValue).toContain('E3');
	});

	it('changes have all required fields', async () => {
		const result = await getDryRunResult('REM-003', { ip: '10.0.0.1' });
		for (const change of result.changes) {
			expect(change.resource).toBeTruthy();
			expect(change.field).toBeTruthy();
			expect(typeof change.currentValue).toBe('string');
			expect(typeof change.proposedValue).toBe('string');
		}
	});
});
