/**
 * Real-time notification store.
 * Manages WebSocket connection lifecycle and dispatches incoming events
 * to relevant stores (alerts, sync progress, etc.).
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { createWebSocketClient, type WSMessage } from '$utils/websocket';
import { createSSEConnection } from '$utils/sse';
import { alerts } from './alerts';
import { toasts } from './toast';

interface NotificationState {
	connected: boolean;
	transport: 'websocket' | 'sse' | 'none';
	unreadCount: number;
	desktopPermission: NotificationPermission | 'default';
}

function createNotificationStore() {
	const { subscribe, set, update } = writable<NotificationState>({
		connected: false,
		transport: 'none',
		unreadCount: 0,
		desktopPermission: browser ? (Notification?.permission ?? 'default') : 'default'
	});

	let wsClient: ReturnType<typeof createWebSocketClient> | null = null;
	let sseClient: ReturnType<typeof createSSEConnection> | null = null;
	let wsFailCount = 0;
	const WS_MAX_FAILURES = 3;

	function handleMessage(message: WSMessage) {
		update((s) => ({ ...s, unreadCount: s.unreadCount + 1 }));

		switch (message.type) {
			case 'alerts_updated':
			case 'alert':
				handleAlertMessage(message);
				break;
			case 'sync_progress':
				handleSyncProgress(message);
				break;
			case 'drift':
				handleDriftAlert(message);
				break;
			case 'notification':
				handleGenericNotification(message);
				break;
			case 'workflow_update':
				handleWorkflowUpdate(message);
				break;
		}
	}

	function handleAlertMessage(msg: WSMessage) {
		const count = (msg.newAlerts as number) ?? 1;
		toasts.warning(`${count} new alert${count > 1 ? 's' : ''} detected`);
		showDesktopNotification('Security Alert', `${count} new alert${count > 1 ? 's' : ''} detected`, '/alerts');
	}

	function handleSyncProgress(msg: WSMessage) {
		// Sync progress events are consumed by SyncProgressBar via the wildcard handler
		if (msg.status === 'completed') {
			toasts.success('Tenant sync completed');
		}
	}

	function handleDriftAlert(msg: WSMessage) {
		const resource = (msg.resource as string) ?? 'configuration';
		toasts.warning(`Drift detected in ${resource}`);
		showDesktopNotification('Config Drift', `Drift detected in ${resource}`, '/config-drifts');
	}

	function handleGenericNotification(msg: WSMessage) {
		const text = (msg.message as string) ?? 'New notification';
		toasts.info(text);
	}

	function handleWorkflowUpdate(msg: WSMessage) {
		const status = msg.status as string;
		const name = (msg.workflowName as string) ?? 'Workflow';
		if (status === 'completed') {
			toasts.success(`${name} completed`);
		} else if (status === 'failed') {
			toasts.error(`${name} failed`);
		}
	}

	function showDesktopNotification(title: string, body: string, url?: string) {
		if (!browser || Notification?.permission !== 'granted') return;
		const n = new Notification(title, { body, icon: '/favicon.png', tag: title });
		if (url) {
			n.onclick = () => { window.focus(); window.location.href = url; };
		}
	}

	return {
		subscribe,

		connect(tenantId: string) {
			this.disconnect();

			// Try WebSocket first
			if (wsFailCount < WS_MAX_FAILURES) {
				wsClient = createWebSocketClient(tenantId);
				wsClient.on('*', handleMessage);
				wsClient.on('connected', () => {
					wsFailCount = 0;
					update((s) => ({ ...s, connected: true, transport: 'websocket' }));
				});
				wsClient.connect();

				// If WS fails quickly, fall back to SSE after a timeout
				setTimeout(() => {
					if (!wsClient?.isConnected()) {
						wsFailCount++;
						if (wsFailCount >= WS_MAX_FAILURES) {
							wsClient?.disconnect();
							wsClient = null;
							this.connectSSE(tenantId);
						}
					}
				}, 5000);
			} else {
				this.connectSSE(tenantId);
			}
		},

		connectSSE(tenantId: string) {
			sseClient = createSSEConnection(tenantId);
			const messageTypes = ['alert', 'alerts_updated', 'sync_progress', 'drift', 'notification', 'workflow_update'];
			for (const type of messageTypes) {
				sseClient.on(type, (event: MessageEvent) => {
					try {
						handleMessage(JSON.parse(event.data));
					} catch { /* ignore */ }
				});
			}
			sseClient.connect();
			update((s) => ({ ...s, connected: true, transport: 'sse' }));
		},

		disconnect() {
			wsClient?.disconnect();
			wsClient = null;
			sseClient?.disconnect();
			sseClient = null;
			update((s) => ({ ...s, connected: false, transport: 'none' }));
		},

		clearUnread() {
			update((s) => ({ ...s, unreadCount: 0 }));
		},

		async requestDesktopPermission() {
			if (!browser || !('Notification' in window)) return;
			const permission = await Notification.requestPermission();
			update((s) => ({ ...s, desktopPermission: permission }));
		}
	};
}

export const notifications = createNotificationStore();
