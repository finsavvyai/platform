import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { formatCurrency, formatNumber, formatRelativeTime, formatPercentage } from './format';

describe('formatCurrency', () => {
	it('should format positive amounts', () => {
		expect(formatCurrency(1000)).toBe('$1,000');
		expect(formatCurrency(57)).toBe('$57');
		expect(formatCurrency(0)).toBe('$0');
	});

	it('should handle null/undefined as $0', () => {
		expect(formatCurrency(null)).toBe('$0');
		expect(formatCurrency(undefined)).toBe('$0');
	});

	it('should handle large numbers', () => {
		expect(formatCurrency(1234567)).toBe('$1,234,567');
	});
});

describe('formatNumber', () => {
	it('should format with locale separators', () => {
		expect(formatNumber(1000)).toBe('1,000');
		expect(formatNumber(42)).toBe('42');
		expect(formatNumber(0)).toBe('0');
	});

	it('should handle null/undefined as 0', () => {
		expect(formatNumber(null)).toBe('0');
		expect(formatNumber(undefined)).toBe('0');
	});

	it('should handle large numbers', () => {
		expect(formatNumber(1000000)).toBe('1,000,000');
	});
});

describe('formatRelativeTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-30T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return "Never" for null/undefined', () => {
		expect(formatRelativeTime(null)).toBe('Never');
		expect(formatRelativeTime(undefined)).toBe('Never');
	});

	it('should return "Never" for invalid date string', () => {
		expect(formatRelativeTime('not-a-date')).toBe('Never');
	});

	it('should return "just now" for very recent', () => {
		const now = new Date('2026-03-30T11:59:45Z');
		expect(formatRelativeTime(now)).toBe('just now');
	});

	it('should return minutes ago', () => {
		const date = new Date('2026-03-30T11:45:00Z');
		expect(formatRelativeTime(date)).toBe('15m ago');
	});

	it('should return hours ago', () => {
		const date = new Date('2026-03-30T09:00:00Z');
		expect(formatRelativeTime(date)).toBe('3h ago');
	});

	it('should return days ago', () => {
		const date = new Date('2026-03-25T12:00:00Z');
		expect(formatRelativeTime(date)).toBe('5d ago');
	});

	it('should return formatted date for 30+ days', () => {
		const date = new Date('2026-01-15T12:00:00Z');
		const result = formatRelativeTime(date);
		// Should be a locale date string, not relative
		expect(result).not.toContain('ago');
		expect(result).not.toBe('Never');
	});

	it('should handle ISO string input', () => {
		expect(formatRelativeTime('2026-03-30T11:30:00Z')).toBe('30m ago');
	});

	it('should handle unix timestamp (seconds)', () => {
		// 1 hour ago in seconds
		const ts = Math.floor(new Date('2026-03-30T11:00:00Z').getTime() / 1000);
		expect(formatRelativeTime(ts)).toBe('1h ago');
	});
});

describe('formatPercentage', () => {
	it('should calculate percentage', () => {
		expect(formatPercentage(50, 100)).toBe('50%');
		expect(formatPercentage(1, 3)).toBe('33%');
		expect(formatPercentage(2, 3)).toBe('67%');
	});

	it('should return 0% when total is 0 or null', () => {
		expect(formatPercentage(50, 0)).toBe('0%');
		expect(formatPercentage(50, null)).toBe('0%');
		expect(formatPercentage(50, undefined)).toBe('0%');
	});

	it('should handle null value as 0', () => {
		expect(formatPercentage(null, 100)).toBe('0%');
		expect(formatPercentage(undefined, 100)).toBe('0%');
	});

	it('should handle 100%', () => {
		expect(formatPercentage(100, 100)).toBe('100%');
	});
});
