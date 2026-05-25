/**
 * SSE (Server-Sent Events) connection manager for real-time dashboard updates.
 * Connects to Durable Object via the API endpoint.
 */

type SSEHandler = (event: MessageEvent) => void;

export function createSSEConnection(tenantId: string) {
	let eventSource: EventSource | null = null;
	const handlers = new Map<string, SSEHandler[]>();

	function connect() {
		if (eventSource) {
			eventSource.close();
		}

		const apiBase = import.meta.env.PUBLIC_API_URL || 'https://api.tenantiq.app';
		// Auth via HttpOnly session cookie (withCredentials for cross-origin)
		eventSource = new EventSource(
			`${apiBase}/api/tenants/${tenantId}/events/stream`,
			{ withCredentials: true },
		);

		eventSource.onopen = () => {
			// Connection established — no-op in production
		};

		eventSource.onerror = () => {
			// EventSource auto-retries on error — no-op
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				const eventHandlers = handlers.get(data.type) ?? [];
				for (const handler of eventHandlers) {
					handler(event);
				}
			} catch {
				// Ignore parse errors
			}
		};
	}

	function on(eventType: string, handler: SSEHandler) {
		const existing = handlers.get(eventType) ?? [];
		handlers.set(eventType, [...existing, handler]);
	}

	function disconnect() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		handlers.clear();
	}

	return { connect, on, disconnect };
}
