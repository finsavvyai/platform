/**
 * Mobile platform detection + native bridge helpers.
 *
 * The same SvelteKit app runs in three modes:
 *   1. Browser (web)  — uses Web APIs (PushManager, WebAuthn, navigator.online)
 *   2. iOS Capacitor  — Capacitor.isNativePlatform() === true, getPlatform() === 'ios'
 *   3. Android Capacitor — same, getPlatform() === 'android'
 *
 * Most existing utilities (web-push-client, webauthn-client, sync-queue) work fine
 * inside the Capacitor WebView. This file is for the cases where we MUST use a
 * native plugin instead — primarily push (iOS Web Push doesn't work when app is
 * closed) and native biometric prompts (better UX than WebAuthn modals).
 */
import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'ios' | 'android';

export function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

export function getPlatform(): Platform {
	const p = Capacitor.getPlatform();
	if (p === 'ios') return 'ios';
	if (p === 'android') return 'android';
	return 'web';
}

/** Register for native push (APNs on iOS, FCM on Android). */
export async function registerNativePush(
	onTokenReceived: (token: string) => void | Promise<void>,
): Promise<void> {
	if (!isNative()) return;
	const { PushNotifications } = await import('@capacitor/push-notifications');

	const perm = await PushNotifications.requestPermissions();
	if (perm.receive !== 'granted') return;

	await PushNotifications.register();

	PushNotifications.addListener('registration', async (token) => {
		await onTokenReceived(token.value);
	});
}

/** Native biometric auth (TouchID / FaceID / Android Biometric). */
export async function authenticateBiometric(reason = 'Sign in to TenantIQ'): Promise<boolean> {
	if (!isNative()) return false;
	try {
		const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
		const result = await BiometricAuth.authenticate({ reason, cancelTitle: 'Cancel' });
		return result === undefined; // resolves on success, throws on cancel/fail
	} catch {
		return false;
	}
}

/** Native KV storage (survives app reinstall on Android, syncs to iCloud on iOS). */
export const nativeStorage = {
	async get(key: string): Promise<string | null> {
		if (!isNative()) return localStorage.getItem(key);
		const { Preferences } = await import('@capacitor/preferences');
		const { value } = await Preferences.get({ key });
		return value;
	},
	async set(key: string, value: string): Promise<void> {
		if (!isNative()) { localStorage.setItem(key, value); return; }
		const { Preferences } = await import('@capacitor/preferences');
		await Preferences.set({ key, value });
	},
	async remove(key: string): Promise<void> {
		if (!isNative()) { localStorage.removeItem(key); return; }
		const { Preferences } = await import('@capacitor/preferences');
		await Preferences.remove({ key });
	},
};

/** Network status — falls back to navigator.onLine on web. */
export async function onNetworkChange(handler: (online: boolean) => void): Promise<() => void> {
	if (!isNative()) {
		const onOnline = () => handler(true);
		const onOffline = () => handler(false);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	}
	const { Network } = await import('@capacitor/network');
	const sub = await Network.addListener('networkStatusChange', (status) => handler(status.connected));
	return () => sub.remove();
}
