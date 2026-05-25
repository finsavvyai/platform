/**
 * Native share via Web Share API, with clipboard fallback.
 *
 * On iOS Safari + Android Chrome: opens the OS share sheet (AirDrop, Messages,
 * email, Slack, etc). In Capacitor shells: same — Capacitor's WebView passes
 * navigator.share through to native.
 *
 * On desktop browsers without share API: copies the URL to clipboard + toast.
 */
import { toasts } from '$stores/toast';

export interface ShareData {
	title?: string;
	text?: string;
	url?: string;
}

export async function share(data: ShareData): Promise<boolean> {
	if (typeof navigator === 'undefined') return false;

	// Web Share API (mobile + some desktop)
	if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
		try {
			await navigator.share(data);
			return true;
		} catch (err) {
			// AbortError = user cancelled — silent. Other errors fall through to clipboard.
			if (err instanceof Error && err.name === 'AbortError') return false;
		}
	}

	// Fallback: copy URL or text to clipboard
	const fallbackText = data.url || data.text || data.title || '';
	if (!fallbackText) return false;

	try {
		await navigator.clipboard.writeText(fallbackText);
		toasts.success('Link copied to clipboard');
		return true;
	} catch {
		toasts.error('Could not copy — please copy the URL manually');
		return false;
	}
}

/** Convenience: share a TenantIQ alert. */
export async function shareAlert(alert: { id: string; title: string; severity: string; tenantId: string }): Promise<boolean> {
	const url = `${window.location.origin}/alerts?alert=${alert.id}`;
	return share({
		title: `[${alert.severity}] ${alert.title}`,
		text: `TenantIQ alert: ${alert.title}`,
		url,
	});
}

/** Returns true if the browser exposes Web Share API (so callers can hide the button on desktop without it). */
export function isShareSupported(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
