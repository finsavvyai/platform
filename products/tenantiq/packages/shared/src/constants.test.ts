import { describe, it, expect } from 'vitest';
import {
	SEVERITY_ORDER,
	SEVERITY_COLORS,
	CATEGORY_LABELS,
	RULE_IDS,
	REMEDIATION_ACTION_IDS,
	LICENSE_COSTS,
	SCAN_SCHEDULES,
	RATE_LIMITS
} from './constants';

describe('SEVERITY_ORDER', () => {
	it('should order critical as highest priority (0)', () => {
		expect(SEVERITY_ORDER.critical).toBe(0);
	});

	it('should order from critical to low', () => {
		expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.high);
		expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium);
		expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low);
	});

	it('should have all four severity levels', () => {
		expect(Object.keys(SEVERITY_ORDER)).toEqual([
			'critical', 'high', 'medium', 'low'
		]);
	});
});

describe('SEVERITY_COLORS', () => {
	it('should have valid hex colors for all severities', () => {
		const hexRegex = /^#[0-9a-fA-F]{6}$/;
		for (const color of Object.values(SEVERITY_COLORS)) {
			expect(color).toMatch(hexRegex);
		}
	});

	it('should have colors for all four severity levels', () => {
		expect(SEVERITY_COLORS.critical).toBeDefined();
		expect(SEVERITY_COLORS.high).toBeDefined();
		expect(SEVERITY_COLORS.medium).toBeDefined();
		expect(SEVERITY_COLORS.low).toBeDefined();
	});
});

describe('CATEGORY_LABELS', () => {
	it('should have human-readable labels for all categories', () => {
		expect(CATEGORY_LABELS.security).toBe('Security');
		expect(CATEGORY_LABELS.optimization).toBe('Optimization');
		expect(CATEGORY_LABELS.compliance).toBe('Compliance');
		expect(CATEGORY_LABELS.operational).toBe('Operational');
	});
});

describe('RULE_IDS', () => {
	it('should have unique rule IDs', () => {
		const values = Object.values(RULE_IDS);
		const unique = new Set(values);
		expect(unique.size).toBe(values.length);
	});

	it('should follow naming convention (PREFIX-NNN)', () => {
		for (const id of Object.values(RULE_IDS)) {
			expect(id).toMatch(/^[A-Z]+-\d{3}$/);
		}
	});

	it('should include security rules', () => {
		expect(RULE_IDS.SEC_001).toBe('SEC-001');
	});

	it('should include optimization rules', () => {
		expect(RULE_IDS.OPT_001).toBe('OPT-001');
	});
});

describe('REMEDIATION_ACTION_IDS', () => {
	it('should have unique action IDs', () => {
		const values = Object.values(REMEDIATION_ACTION_IDS);
		const unique = new Set(values);
		expect(unique.size).toBe(values.length);
	});

	it('should follow REM-NNN pattern', () => {
		for (const id of Object.values(REMEDIATION_ACTION_IDS)) {
			expect(id).toMatch(/^REM-\d{3}$/);
		}
	});
});

describe('LICENSE_COSTS', () => {
	it('should have positive costs for all licenses', () => {
		for (const cost of Object.values(LICENSE_COSTS)) {
			expect(cost).toBeGreaterThan(0);
		}
	});

	it('should include E5 license', () => {
		expect(LICENSE_COSTS['Microsoft 365 E5']).toBe(57.0);
	});

	it('should have E5 > E3 > E1 pricing order', () => {
		expect(LICENSE_COSTS['Microsoft 365 E5']).toBeGreaterThan(
			LICENSE_COSTS['Microsoft 365 E3']
		);
		expect(LICENSE_COSTS['Microsoft 365 E3']).toBeGreaterThan(
			LICENSE_COSTS['Microsoft 365 E1']
		);
	});
});

describe('RATE_LIMITS', () => {
	it('should have positive limits', () => {
		expect(RATE_LIMITS.AI_CHAT_PER_HOUR).toBeGreaterThan(0);
		expect(RATE_LIMITS.REMEDIATION_PER_MINUTE).toBeGreaterThan(0);
		expect(RATE_LIMITS.API_PER_MINUTE).toBeGreaterThan(0);
		expect(RATE_LIMITS.BATCH_OPERATION_MAX).toBeGreaterThan(0);
	});
});

describe('SCAN_SCHEDULES', () => {
	it('should have valid cron expressions', () => {
		const cronRegex = /^(\*|[\d*/,-]+)\s+(\*|[\d*/,-]+)\s+(\*|[\d*/,-]+)\s+(\*|[\d*/,-]+)\s+(\*|[\d*/,-]+)$/;
		for (const cron of Object.values(SCAN_SCHEDULES)) {
			expect(cron).toMatch(cronRegex);
		}
	});
});
