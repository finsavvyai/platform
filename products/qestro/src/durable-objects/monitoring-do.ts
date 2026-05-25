/**
 * Monitoring Durable Object
 * Provides real-time monitoring and alerting for the Questro platform
 */

export class MonitoringDO implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private metrics: Map<string, any> = new Map();
  private alerts: Array<any> = [];
  private subscribers: Set<WebSocket> = new Set();
  private storageTimer: any = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // WebSocket endpoint
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocket(request);
      }

      // API endpoints
      if (method === 'GET' && path === '/metrics') {
        return this.getMetrics();
      }

      if (method === 'GET' && path === '/alerts') {
        return this.getAlerts();
      }

      if (method === 'POST' && path === '/metrics') {
        const body = await request.json();
        return this.recordMetric(body);
      }

      if (method === 'POST' && path === '/alerts') {
        const body = await request.json();
        return this.createAlert(body);
      }

      if (method === 'DELETE' && path.startsWith('/alerts/')) {
        const alertId = path.split('/')[2];
        return this.clearAlert(alertId);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), { status: 500 });
    }
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    this.subscribers.add(server);

    server.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string);
        this.handleWebSocketMessage(server, message);
      } catch (error) {
        server.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    server.addEventListener('close', () => {
      this.subscribers.delete(server);
    });

    // Send initial state
    server.send(JSON.stringify({
      type: 'initial',
      metrics: Object.fromEntries(this.metrics),
      alerts: this.alerts
    }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, message: any): Promise<void> {
    switch (message.type) {
      case 'subscribe':
        // Client is already subscribed
        ws.send(JSON.stringify({
          type: 'subscribed',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'unsubscribe':
        this.subscribers.delete(ws);
        break;

      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;
    }
  }

  private async getMetrics(): Promise<Response> {
    const allMetrics = Object.fromEntries(this.metrics);
    return new Response(JSON.stringify({
      metrics: allMetrics,
      timestamp: new Date().toISOString(),
      count: Object.keys(allMetrics).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getAlerts(): Promise<Response> {
    return new Response(JSON.stringify({
      alerts: this.alerts,
      timestamp: new Date().toISOString(),
      count: this.alerts.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async recordMetric(data: any): Promise<Response> {
    const { name, value, type = 'gauge', tags = {}, timestamp = new Date().toISOString() } = data;

    if (!name || value === undefined) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: name, value'
      }), { status: 400 });
    }

    const metric = {
      name,
      value,
      type,
      tags,
      timestamp,
      history: this.metrics.get(name)?.history || []
    };

    // Keep only last 100 data points for history
    if (metric.history.length >= 100) {
      metric.history = metric.history.slice(-99);
    }
    metric.history.push({ value, timestamp });

    this.metrics.set(name, metric);

    // Broadcast to subscribers
    this.broadcast({
      type: 'metric_update',
      metric
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Metric recorded'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async createAlert(data: any): Promise<Response> {
    const { title, description, severity = 'medium', source = 'system', tags = {} } = data;

    if (!title) {
      return new Response(JSON.stringify({
        error: 'Missing required field: title'
      }), { status: 400 });
    }

    const alert = {
      id: this.generateId(),
      title,
      description,
      severity, // low, medium, high, critical
      source,
      tags,
      status: 'active',
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null
    };

    this.alerts.push(alert);

    // Broadcast to subscribers
    this.broadcast({
      type: 'alert_created',
      alert
    });

    // Store in persistent storage
    await this.persistAlerts();

    return new Response(JSON.stringify({
      success: true,
      alert
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async clearAlert(alertId: string): Promise<Response> {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);

    if (alertIndex === -1) {
      return new Response(JSON.stringify({
        error: 'Alert not found'
      }), { status: 404 });
    }

    const alert = this.alerts[alertIndex];
    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();

    // Broadcast to subscribers
    this.broadcast({
      type: 'alert_resolved',
      alert
    });

    await this.persistAlerts();

    return new Response(JSON.stringify({
      success: true,
      alert
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    });

    this.subscribers.forEach(ws => {
      try {
        ws.send(messageStr);
      } catch (error) {
        // Remove dead connections
        this.subscribers.delete(ws);
      }
    });
  }

  private async persistAlerts(): Promise<void> {
    try {
      await this.state.storage.put('alerts', this.alerts);
    } catch (error) {
      console.error('Failed to persist alerts:', error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const alerts = await this.state.storage.get('alerts');
      if (alerts) {
        this.alerts = alerts;
      }

      const metrics = await this.state.storage.get('metrics');
      if (metrics) {
        this.metrics = new Map(Object.entries(metrics));
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Automatic cleanup and maintenance
  private startMaintenanceTimer(): void {
    if (this.storageTimer) {
      clearInterval(this.storageTimer);
    }

    this.storageTimer = setInterval(async () => {
      await this.performMaintenance();
    }, 60000); // Every minute
  }

  private async performMaintenance(): Promise<void> {
    try {
      // Clean up old metrics (keep only last hour of data)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      for (const [name, metric] of this.metrics.entries()) {
        metric.history = metric.history.filter((point: any) => {
          return new Date(point.timestamp).getTime() > oneHourAgo;
        });

        if (metric.history.length === 0) {
          this.metrics.delete(name);
        }
      }

      // Clean up old resolved alerts (keep for 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.alerts = this.alerts.filter(alert => {
        if (alert.status === 'resolved' && alert.resolvedAt) {
          return new Date(alert.resolvedAt).getTime() > oneDayAgo;
        }
        return true;
      });

      // Persist changes
      await this.state.storage.put('metrics', Object.fromEntries(this.metrics));
      await this.persistAlerts();

    } catch (error) {
      console.error('Maintenance failed:', error);
    }
  }

  // Lifecycle methods
  async alarm(): Promise<void> {
    await this.performMaintenance();
  }
}
