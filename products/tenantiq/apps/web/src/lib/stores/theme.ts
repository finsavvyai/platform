import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'tenantiq_theme';

function getInitial(): ThemeMode {
	if (!browser) return 'auto';
	return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'auto';
}

function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	const root = document.documentElement;

	if (mode === 'auto') {
		root.removeAttribute('data-theme');
	} else {
		root.setAttribute('data-theme', mode);
	}

	localStorage.setItem(STORAGE_KEY, mode);
}

function createThemeStore() {
	const initial = getInitial();
	const { subscribe, set } = writable<ThemeMode>(initial);

	if (browser) applyTheme(initial);

	return {
		subscribe,
		setTheme(mode: ThemeMode) {
			set(mode);
			applyTheme(mode);
		}
	};
}

export const theme = createThemeStore();
