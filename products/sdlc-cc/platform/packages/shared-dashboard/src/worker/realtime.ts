/**
 * Durable Object for real-time dashboard updates
 * Handles WebSocket connections and broadcasts updates to connected clients
 */

import type { Env } from './types';

/** Incoming WebSocket message from a client */
interface MessageData {
  type: string;
  productId?: string;
  [key: string]: unknown;
}

/** Data payload sent via the /broadcast HTTP endpoint */
interface BroadcastMessage {
  [key: string]: unknown;
}

/** Metrics data sent via the /metrics/update HTTP endpoint */
interface MetricsData {
  [key: string]: unknown;
}

/** Alert data sent via the /alert HTTP endpoint */
interface AlertData {
  severity?: string;
  message?: string;
  [key: string]: unknown;
}

/** Product status update payload */
interface ProductStatusData {
  [key: string]: unknown;
}

export class DashboardRealtime {
  private state: DurableObjectState;
  private sessions: Set<WebSocket>;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Handle HTTP requests for broadcasting
    if (request.method === 'POST') {
      const url = new URL(request.url);

      if (url.pathname === '/broadcast') {
        const data = (await request.json()) as BroadcastMessage;
        await this.broadcast(data);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/metrics/update') {
        const data = (await request.json()) as MetricsData;
        await this.broadcastMetricsUpdate(data);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/alert') {
        const data = (await request.json()) as AlertData;
        await this.broadcastAlert(data);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not found', { status: 404 });
  }

  async handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);

    // Send welcome message
    webSocket.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      connectedClients: this.sessions.size,
    }));

    // Handle incoming messages
    webSocket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleMessage(webSocket, data);
      } catch (error) {
        console.error('Error handling message:', error);
        webSocket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    // Handle close
    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });

    // Handle errors
    webSocket.addEventListener('error', () => {
      this.sessions.delete(webSocket);
    });
  }

  async handleMessage(webSocket: WebSocket, data: MessageData) {
    switch (data.type) {
      case 'ping':
        webSocket.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString(),
        }));
        break;

      case 'subscribe':
        // Subscribe to specific product updates
        webSocket.send(JSON.stringify({
          type: 'subscribed',
          productId: data.productId,
        }));
        break;

      case 'unsubscribe':
        // Unsubscribe from product updates
        webSocket.send(JSON.stringify({
          type: 'unsubscribed',
          productId: data.productId,
        }));
        break;

      default:
        webSocket.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type',
        }));
    }
  }

  async broadcast(message: BroadcastMessage) {
    const payload = JSON.stringify({
      type: 'broadcast',
      data: message,
      timestamp: new Date().toISOString(),
    });

    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (error) {
        // Remove dead sessions
        this.sessions.delete(session);
      }
    }
  }

  async broadcastMetricsUpdate(metrics: MetricsData) {
    const payload = JSON.stringify({
      type: 'metrics_update',
      data: metrics,
      timestamp: new Date().toISOString(),
    });

    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (error) {
        this.sessions.delete(session);
      }
    }
  }

  async broadcastAlert(alert: AlertData) {
    const payload = JSON.stringify({
      type: 'alert',
      data: alert,
      timestamp: new Date().toISOString(),
    });

    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (error) {
        this.sessions.delete(session);
      }
    }
  }

  async broadcastProductStatus(productId: string, status: ProductStatusData) {
    const payload = JSON.stringify({
      type: 'product_status',
      productId,
      data: status,
      timestamp: new Date().toISOString(),
    });

    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (error) {
        this.sessions.delete(session);
      }
    }
  }

  // Scheduled handler for periodic updates
  async alarm() {
    // Fetch latest metrics and broadcast to all connected clients
    await this.broadcastPeriodicUpdate();

    // Schedule next alarm (every 5 seconds)
    await this.state.storage.setAlarm(Date.now() + 5000);
  }

  async broadcastPeriodicUpdate() {
    // Broadcast current connection count
    const payload = JSON.stringify({
      type: 'heartbeat',
      connectedClients: this.sessions.size,
      timestamp: new Date().toISOString(),
    });

    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (error) {
        this.sessions.delete(session);
      }
    }
  }
}

export default DashboardRealtime;
