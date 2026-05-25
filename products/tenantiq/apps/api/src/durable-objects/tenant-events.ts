/**
 * TenantEvents Durable Object.
 * Manages SSE and WebSocket connections for real-time dashboard updates per tenant.
 * Each tenant gets its own Durable Object instance (keyed by tenant_id).
 */

export interface TenantEventMessage {
	type: 'alert' | 'sync_progress' | 'drift' | 'notification' | 'alerts_updated' | 'workflow_update' | 'connected';
	[key: string]: unknown;
}

export class TenantEvents {
	private state: DurableObjectState;
	private sseSessions: Set<WritableStreamDefaultWriter>;
	private wsSessions: Set<WebSocket>;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.sseSessions = new Set();
		this.wsSessions = new Set();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'POST' && url.pathname === '/broadcast') {
			const event = await request.json();
			await this.broadcast(event as TenantEventMessage);
			return new Response('OK');
		}

		// WebSocket upgrade
		if (request.headers.get('Upgrade') === 'websocket') {
			return this.handleWebSocket();
		}

		// SSE connection (backward compatible)
		return this.handleSSE(request);
	}

	private handleWebSocket(): Response {
		const pair = new WebSocketPair();
		const [client, server] = [pair[0], pair[1]];

		server.accept();
		this.wsSessions.add(server);

		server.send(JSON.stringify({ type: 'connected' }));

		server.addEventListener('message', (event) => {
			// Handle ping/pong for keepalive
			if (event.data === 'ping') {
				server.send('pong');
			}
		});

		server.addEventListener('close', () => {
			this.wsSessions.delete(server);
		});

		server.addEventListener('error', () => {
			this.wsSessions.delete(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private async handleSSE(request: Request): Promise<Response> {
		const { readable, writable } = new TransformStream();
		const writer = writable.getWriter();
		const encoder = new TextEncoder();

		await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));
		this.sseSessions.add(writer);

		const cleanup = () => {
			this.sseSessions.delete(writer);
			writer.close().catch(() => {});
		};

		request.signal.addEventListener('abort', cleanup);

		return new Response(readable, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	}

	private async broadcast(event: TenantEventMessage) {
		const jsonData = JSON.stringify(event);

		// Broadcast to WebSocket clients
		const deadWs: WebSocket[] = [];
		for (const ws of this.wsSessions) {
			try {
				ws.send(jsonData);
			} catch {
				deadWs.push(ws);
			}
		}
		for (const ws of deadWs) {
			this.wsSessions.delete(ws);
		}

		// Broadcast to SSE clients
		const encoder = new TextEncoder();
		const sseData = encoder.encode(`data: ${jsonData}\n\n`);
		const deadSse: WritableStreamDefaultWriter[] = [];

		for (const writer of this.sseSessions) {
			try {
				await writer.write(sseData);
			} catch {
				deadSse.push(writer);
			}
		}
		for (const writer of deadSse) {
			this.sseSessions.delete(writer);
		}
	}
}
