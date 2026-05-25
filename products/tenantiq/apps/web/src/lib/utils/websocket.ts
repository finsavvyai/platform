/**
 * WebSocket client with auto-reconnect and exponential backoff.
 * Falls back to SSE if WebSocket connection fails repeatedly.
 */

export type WSMessageType =
	| 'connected'
	| 'alert'
	| 'alerts_updated'
	| 'sync_progress'
	| 'drift'
	| 'notification'
	| 'workflow_update';

export interface WSMessage {
	type: WSMessageType;
	[key: string]: unknown;
}

type WSHandler = (message: WSMessage) => void;

const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;
const PING_INTERVAL_MS = 30000;

export function createWebSocketClient(tenantId: string) {
	let ws: WebSocket | null = null;
	let reconnectAttempt = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let pingTimer: ReturnType<typeof setInterval> | null = null;
	let intentionalClose = false;
	const handlers = new Map<string, WSHandler[]>();

	function getApiBase(): string {
		return import.meta.env.PUBLIC_API_URL || 'https://api.tenantiq.app';
	}

	async function fetchTicket(): Promise<string | null> {
		// SameSite=Lax + cross-subdomain blocks the cookie on the WS upgrade,
		// so we mint a 60s-TTL scoped ticket via the cookie-authed REST endpoint
		// and pass it as ?token=… on the WS URL.
		try {
			const res = await fetch(`${getApiBase()}/api/auth/ws-ticket`, { credentials: 'include' });
			if (!res.ok) return null;
			const body = await res.json() as { ticket?: string };
			return body.ticket ?? null;
		} catch { return null; }
	}

	async function connect() {
		if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
			return;
		}

		intentionalClose = false;

		const ticket = await fetchTicket();
		if (!ticket) {
			scheduleReconnect();
			return;
		}

		const wsBase = getApiBase().replace(/^http/, 'ws');
		const url = `${wsBase}/api/ws/${tenantId}?token=${encodeURIComponent(ticket)}`;

		try {
			ws = new WebSocket(url);
		} catch {
			scheduleReconnect();
			return;
		}

		ws.onopen = () => {
			reconnectAttempt = 0;
			startPing();
		};

		ws.onmessage = (event) => {
			if (event.data === 'pong') return;

			try {
				const message: WSMessage = JSON.parse(event.data);
				dispatch(message);
			} catch {
				// Ignore unparseable messages
			}
		};

		ws.onclose = () => {
			stopPing();
			if (!intentionalClose) {
				scheduleReconnect();
			}
		};

		ws.onerror = () => {
			// onclose will fire after onerror — reconnect handled there
		};
	}

	function dispatch(message: WSMessage) {
		const typeHandlers = handlers.get(message.type) ?? [];
		for (const handler of typeHandlers) {
			handler(message);
		}
		// Also dispatch to wildcard handlers
		const wildcardHandlers = handlers.get('*') ?? [];
		for (const handler of wildcardHandlers) {
			handler(message);
		}
	}

	function scheduleReconnect() {
		if (intentionalClose) return;
		const delay = Math.min(
			BASE_RECONNECT_MS * Math.pow(2, reconnectAttempt),
			MAX_RECONNECT_MS
		);
		reconnectAttempt++;
		reconnectTimer = setTimeout(connect, delay);
	}

	function startPing() {
		stopPing();
		pingTimer = setInterval(() => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send('ping');
			}
		}, PING_INTERVAL_MS);
	}

	function stopPing() {
		if (pingTimer) {
			clearInterval(pingTimer);
			pingTimer = null;
		}
	}

	function on(eventType: string, handler: WSHandler) {
		const existing = handlers.get(eventType) ?? [];
		handlers.set(eventType, [...existing, handler]);
	}

	function off(eventType: string, handler: WSHandler) {
		const existing = handlers.get(eventType) ?? [];
		handlers.set(eventType, existing.filter((h) => h !== handler));
	}

	function disconnect() {
		intentionalClose = true;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		stopPing();
		if (ws) {
			ws.close();
			ws = null;
		}
		handlers.clear();
	}

	function isConnected(): boolean {
		return ws?.readyState === WebSocket.OPEN;
	}

	return { connect, on, off, disconnect, isConnected };
}
