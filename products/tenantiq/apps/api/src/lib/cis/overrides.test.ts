/**
 * Unit tests for CIS tenant override applier (Phase 2 / leverage-ScubaGear).
 */

import { describe, it, expect } from 'vitest';
import { applyOverrides, indexOverrides } from './overrides';
import type { ScanResult, ControlResult } from './scanner-types';
import type { CisTenantOverride } from '@tenantiq/shared';

const ctrl = (id: string, status: ControlResult['status'], section = 'identity'): ControlResult => ({
	controlId: id,
	section,
	title: id,
	status,
	severity: 'high',
	currentValue: '',
	expectedValue: '',
	remediationHint: '',
	autoRemediable: false,
});

const baseScan = (controls: ControlResult[]): ScanResult => ({
	overallScore: 0,
	passCount: controls.filter(c => c.status === 'pass').length,
	failCount: controls.filter(c => c.status === 'fail').length,
	partialCount: controls.filter(c => c.status === 'partial').length,
	errorCount: controls.filter(c => c.status === 'error').length,
	totalControls: controls.length,
	sectionScores: {},
	controls,
	scanDurationMs: 1,
});

const ov = (controlId: string, decision: 'accepted_risk' | 'omit', expiresAt: string | null = null): CisTenantOverride => ({
	id: `ov-${controlId}`,
	tenantId: 't1',
	controlId,
	decision,
	justification: 'documented compensating control',
	expiresAt,
	createdAt: '2026-04-27T00:00:00Z',
	createdBy: 'admin@example.com',
});

describe('applyOverrides — accepted_risk', () => {
	it('flips a failing control to pass and preserves originalStatus', () => {
		const scan = baseScan([ctrl('1.1', 'fail'), ctrl('1.2', 'pass')]);
		const overrides = indexOverrides([ov('1.1', 'accepted_risk')]);
		const out = applyOverrides(scan, overrides);

		const c1 = out.controls.find(c => c.controlId === '1.1')!;
		expect(c1.status).toBe('pass');
		expect(c1.overrideApplied).toEqual({
			decision: 'accepted_risk',
			justification: 'documented compensating control',
			originalStatus: 'fail',
		});
		expect(out.passCount).toBe(2);
		expect(out.failCount).toBe(0);
		expect(out.totalControls).toBe(2);
	});
});

describe('applyOverrides — omit', () => {
	it('removes the control from totals and pushes onto omittedControls', () => {
		const scan = baseScan([ctrl('1.1', 'fail'), ctrl('1.2', 'pass'), ctrl('1.3', 'fail')]);
		const overrides = indexOverrides([ov('1.1', 'omit')]);
		const out = applyOverrides(scan, overrides);

		expect(out.controls.find(c => c.controlId === '1.1')).toBeUndefined();
		expect(out.omittedControls).toHaveLength(1);
		expect(out.omittedControls?.[0].overrideApplied?.originalStatus).toBe('fail');
		expect(out.totalControls).toBe(2);
		expect(out.passCount).toBe(1);
		expect(out.failCount).toBe(1);
	});

	it('recomputes section scores after omit', () => {
		const scan = baseScan([ctrl('1.1', 'fail', 'identity'), ctrl('1.2', 'pass', 'identity')]);
		const overrides = indexOverrides([ov('1.1', 'omit')]);
		const out = applyOverrides(scan, overrides);
		expect(out.sectionScores.identity).toEqual({ pass: 1, fail: 0, total: 1, score: 100 });
	});
});

describe('indexOverrides — expiry', () => {
	it('drops overrides whose expiresAt has passed', () => {
		const now = new Date('2026-04-27T12:00:00Z');
		const map = indexOverrides([
			ov('1.1', 'accepted_risk', '2026-04-26T00:00:00Z'),
			ov('1.2', 'accepted_risk', '2026-05-01T00:00:00Z'),
		], now);
		expect(map.has('1.1')).toBe(false);
		expect(map.has('1.2')).toBe(true);
	});

	it('returns empty map for empty input', () => {
		expect(indexOverrides([])).toEqual(new Map());
	});
});

describe('applyOverrides — no-op', () => {
	it('returns the original scan when overrides map is empty', () => {
		const scan = baseScan([ctrl('1.1', 'pass')]);
		const out = applyOverrides(scan, new Map());
		expect(out).toBe(scan);
	});
});
