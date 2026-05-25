import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { theme } from '$stores/theme';

describe('ThemeToggle (store logic)', () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.removeAttribute('data-theme');
	});

	it('should default to auto theme', () => {
		expect(get(theme)).toBe('auto');
	});

	it('setTheme should update the store value', () => {
		theme.setTheme('dark');
		expect(get(theme)).toBe('dark');
	});

	it('setTheme light should set data-theme attribute', () => {
		theme.setTheme('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('setTheme dark should set data-theme attribute', () => {
		theme.setTheme('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});

	it('setTheme auto should remove data-theme attribute', () => {
		theme.setTheme('dark');
		theme.setTheme('auto');
		expect(document.documentElement.getAttribute('data-theme')).toBeNull();
	});

	it('should persist theme to localStorage', () => {
		theme.setTheme('dark');
		expect(localStorage.getItem('tenantiq_theme')).toBe('dark');
	});

	it('should cycle through all theme modes', () => {
		const modes = ['light', 'dark', 'auto'] as const;
		for (const mode of modes) {
			theme.setTheme(mode);
			expect(get(theme)).toBe(mode);
		}
	});
});
