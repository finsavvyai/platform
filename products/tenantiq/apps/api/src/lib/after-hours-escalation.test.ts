import { describe, expect, it } from 'vitest';
import {
	getAfterHoursContext,
	escalateSeverity,
	shouldEscalateRoute,
} from './after-hours-escalation';

describe('After-Hours Escalation', () => {
	const defaultConfig = {
		timezone: 'UTC',
		startHour: 8,
		endHour: 18,
		workDays: [1, 2, 3, 4, 5],
	};

	describe('getAfterHoursContext', () => {
		it('detects business hours correctly', () => {
			// Wednesday at 10:00 UTC
			const wednesday10am = new Date('2026-03-25T10:00:00Z');
			const ctx = getAfterHoursContext(wednesday10am, defaultConfig);
			expect(ctx.isAfterHours).toBe(false);
			expect(ctx.isWeekend).toBe(false);
		});

		it('detects after hours (evening)', () => {
			// Wednesday at 22:00 UTC
			const wednesday10pm = new Date('2026-03-25T22:00:00Z');
			const ctx = getAfterHoursContext(wednesday10pm, defaultConfig);
			expect(ctx.isAfterHours).toBe(true);
			expect(ctx.isWeekend).toBe(false);
		});

		it('detects weekend', () => {
			// Saturday at 10:00 UTC
			const saturday = new Date('2026-03-28T10:00:00Z');
			const ctx = getAfterHoursContext(saturday, defaultConfig);
			expect(ctx.isAfterHours).toBe(true);
			expect(ctx.isWeekend).toBe(true);
		});

		it('calculates hours since last business login', () => {
			const now = new Date('2026-03-25T22:00:00Z');
			const lastLogin = new Date('2026-03-24T10:00:00Z');
			const ctx = getAfterHoursContext(now, defaultConfig, lastLogin);
			expect(ctx.hoursSinceLastBusinessLogin).toBe(36);
		});

		it('returns null for no last login', () => {
			const ctx = getAfterHoursContext(new Date(), defaultConfig, null);
			expect(ctx.hoursSinceLastBusinessLogin).toBeNull();
		});
	});

	describe('escalateSeverity', () => {
		it('does not escalate during business hours', () => {
			const ctx = getAfterHoursContext(new Date('2026-03-25T10:00:00Z'), defaultConfig);
			const result = escalateSeverity('medium', ctx);
			expect(result).toBeNull();
		});

		it('escalates medium to high after hours', () => {
			const ctx = getAfterHoursContext(new Date('2026-03-25T22:00:00Z'), defaultConfig);
			const result = escalateSeverity('medium', ctx);
			expect(result).not.toBeNull();
			expect(result!.escalatedSeverity).toBe('high');
		});

		it('escalates high to critical on weekend', () => {
			const ctx = getAfterHoursContext(new Date('2026-03-28T10:00:00Z'), defaultConfig);
			const result = escalateSeverity('high', ctx);
			expect(result!.escalatedSeverity).toBe('critical');
			expect(result!.escalationReason).toContain('weekend');
		});

		it('keeps critical as critical', () => {
			const ctx = getAfterHoursContext(new Date('2026-03-28T10:00:00Z'), defaultConfig);
			const result = escalateSeverity('critical', ctx);
			expect(result!.escalatedSeverity).toBe('critical');
		});
	});

	describe('shouldEscalateRoute', () => {
		it('returns standard during business hours', () => {
			const ctx = getAfterHoursContext(new Date('2026-03-25T10:00:00Z'), defaultConfig);
			expect(shouldEscalateRoute(ctx).route).toBe('standard');
		});

		it('returns oncall on weekend', () => {
			const ctx = getAfterHoursContext(new Date('2026-03-28T10:00:00Z'), defaultConfig);
			expect(shouldEscalateRoute(ctx).route).toBe('oncall');
		});

		it('returns emergency when no login for 72+ hours', () => {
			const now = new Date('2026-03-28T10:00:00Z');
			const lastLogin = new Date('2026-03-24T10:00:00Z'); // 96 hours ago
			const ctx = getAfterHoursContext(now, defaultConfig, lastLogin);
			expect(shouldEscalateRoute(ctx).route).toBe('emergency');
		});
	});
});
