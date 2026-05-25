import { describe, expect, it } from 'vitest';
import {
	categoryToSeverity,
	CRITICAL_CATEGORIES,
	WARNING_CATEGORIES,
} from './snapshot-types';

describe('Snapshot Types', () => {
	describe('categoryToSeverity', () => {
		it('returns critical for conditional_access', () => {
			expect(categoryToSeverity('conditional_access')).toBe('critical');
		});

		it('returns critical for authorization', () => {
			expect(categoryToSeverity('authorization')).toBe('critical');
		});

		it('returns critical for security_defaults', () => {
			expect(categoryToSeverity('security_defaults')).toBe('critical');
		});

		it('returns warning for auth_methods', () => {
			expect(categoryToSeverity('auth_methods')).toBe('warning');
		});

		it('returns warning for app_consent', () => {
			expect(categoryToSeverity('app_consent')).toBe('warning');
		});

		it('returns warning for cross_tenant', () => {
			expect(categoryToSeverity('cross_tenant')).toBe('warning');
		});

		it('returns info for unknown categories', () => {
			expect(categoryToSeverity('some_other_category')).toBe('info');
		});

		it('returns info for empty string', () => {
			expect(categoryToSeverity('')).toBe('info');
		});

		it('maps all CRITICAL_CATEGORIES correctly', () => {
			for (const cat of CRITICAL_CATEGORIES) {
				expect(categoryToSeverity(cat)).toBe('critical');
			}
		});

		it('maps all WARNING_CATEGORIES correctly', () => {
			for (const cat of WARNING_CATEGORIES) {
				expect(categoryToSeverity(cat)).toBe('warning');
			}
		});
	});
});
