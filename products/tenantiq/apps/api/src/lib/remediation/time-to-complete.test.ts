import { describe, it, expect } from 'vitest';
import { summarizeDurations } from './time-to-complete';

describe('summarizeDurations', () => {
	it('falls back to default when fewer than 5 samples', () => {
		const r = summarizeDurations([60, 120, 180], 'high');
		expect(r.source).toBe('default');
		expect(r.medianMinutes).toBeNull();
		expect(r.displayMinutes).toBe('10-20');
	});

	it('uses historical when 5+ samples', () => {
		// 5 runs at 60, 120, 180, 240, 300 seconds (1, 2, 3, 4, 5 min)
		const r = summarizeDurations([60, 120, 180, 240, 300], 'high');
		expect(r.source).toBe('historical');
		expect(r.medianMinutes).toBe(3);
		expect(r.p90Minutes).toBe(5);
		expect(r.displayMinutes).toBe('3-5');
	});

	it('shows single number when median equals p90 in minutes', () => {
		const r = summarizeDurations([180, 180, 180, 180, 180], 'high');
		expect(r.displayMinutes).toBe('3');
	});

	it('discards outliers >24h', () => {
		const r = summarizeDurations([60, 120, 180, 240, 300, 99 * 3600], 'medium');
		expect(r.historicalSamples).toBe(5);
	});

	it('discards zero/negative durations', () => {
		const r = summarizeDurations([0, -10, 60, 120, 180, 240, 300], 'high');
		expect(r.historicalSamples).toBe(5);
	});

	it('uses correct severity default', () => {
		expect(summarizeDurations([], 'critical').displayMinutes).toBe('5-10');
		expect(summarizeDurations([], 'low').displayMinutes).toBe('20-45');
	});
});
