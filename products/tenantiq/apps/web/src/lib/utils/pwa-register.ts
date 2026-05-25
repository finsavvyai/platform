/**
 * Service worker registration + update flow + cross-tab message routing.
 * Handles:
 *  - First registration on mount
 *  - Auto-update: when new SW takes over, reload once so the page sees fresh assets
 *  - SYNC_REPLAY_QUEUE messages from the SW (Background Sync trigger)
 */
import { toasts } from '$stores/toast';

let refreshing = false;

export function registerServiceWorker(): void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

	navigator.serviceWorker.register('/sw.js').then((reg) => {
		// New SW found — let it install, then ask it to take over on next reload.
		reg.addEventListener('updatefound', () => {
			const newSW = reg.installing;
			if (!newSW) return;
			newSW.addEventListener('statechange', () => {
				if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
					toasts.info('New version available — reloading…');
					setTimeout(() => newSW.postMessage('SKIP_WAITING'), 1500);
				}
			});
		});
	}).catch(() => {
		// Silent — PWA install isn't required for app to work.
	});

	// When the new SW takes over, reload once so the page picks up new assets.
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (refreshing) return;
		refreshing = true;
		window.location.reload();
	});

	// Background Sync replay signal from SW.
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.type === 'SYNC_REPLAY_QUEUE') {
			// Lazy-import sync queue (created in P1.5 task — will resolve once added).
			import('./sync-queue').then((m) => m.replayQueue()).catch(() => {});
		}
	});
}
