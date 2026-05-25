/**
 * Web Push client — subscribe / unsubscribe helpers.
 *
 * Flow:
 *   1. enablePush() requests Notification permission, fetches VAPID public key,
 *      subscribes via PushManager, posts subscription to backend.
 *   2. disablePush() unsubscribes locally and tells backend.
 *   3. isPushEnabled() reports current state for UI.
 */
import { toasts } from '$stores/toast';

const API_BASE = import.meta.env.PUBLIC_API_URL
	? `${import.meta.env.PUBLIC_API_URL}/api`
	: 'https://api.tenantiq.app/api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const padded = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(padded);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

export async function isPushSupported(): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function isPushEnabled(): Promise<boolean> {
	if (!await isPushSupported()) return false;
	if (Notification.permission !== 'granted') return false;
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.getSubscription();
	return sub !== null;
}

export async function enablePush(): Promise<boolean> {
	if (!await isPushSupported()) {
		toasts.warning('Push notifications not supported on this device');
		return false;
	}

	let perm = Notification.permission;
	if (perm === 'default') perm = await Notification.requestPermission();
	if (perm !== 'granted') {
		toasts.warning('Notifications blocked — enable in browser settings');
		return false;
	}

	const keyRes = await fetch(`${API_BASE}/push/vapid-key`, { credentials: 'include' });
	if (!keyRes.ok) {
		toasts.error('Push not configured on server');
		return false;
	}
	const { publicKey } = await keyRes.json() as { publicKey: string };

	const reg = await navigator.serviceWorker.ready;
	const keyBytes = urlBase64ToUint8Array(publicKey);
	const sub = await reg.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
	});

	const subJson = sub.toJSON();
	const subRes = await fetch(`${API_BASE}/push/subscribe`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
	});

	if (!subRes.ok) {
		await sub.unsubscribe();
		toasts.error('Failed to register for push');
		return false;
	}

	toasts.success('Push notifications enabled');
	return true;
}

export async function disablePush(): Promise<boolean> {
	if (!await isPushSupported()) return false;
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.getSubscription();
	if (!sub) return true;

	await fetch(`${API_BASE}/push/unsubscribe`, {
		method: 'DELETE',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: sub.endpoint }),
	}).catch(() => { /* best-effort */ });

	await sub.unsubscribe();
	toasts.info('Push notifications disabled');
	return true;
}
