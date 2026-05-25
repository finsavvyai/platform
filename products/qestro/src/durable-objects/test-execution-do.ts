/**
 * Test Execution Durable Object
 *
 * Provides real-time test execution monitoring with WebSocket connections.
 * Handles test orchestration, progress tracking, and live event broadcasting.
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import * as schema from "../db/schema";

interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId?: string;
  lastPing: number;
  subscribedEvents: string[];
  metadata: Record<string, any>;
}

interface ExecutionState {
  id: string;
  projectId: string;
  status:
    | "queued"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  progress: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    percentage: number;
  };
  startTime?: number;
  endTime?: number;
  currentTest?: {
    id: string;
    name: string;
    status: string;
    startTime: number;
    step?: string;
  };
  devices: Array<{
    id: string;
    name: string;
    platform: string;
    status: string;
    battery?: number;
    memory?: number;
    cpu?: number;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    name: string;
    size: number;
    timestamp: number;
  }>;
  metrics: {
    totalDuration: number;
    averageTestDuration: number;
    successRate: number;
    throughput: number;
    resourceUtilization: {
      cpu: number;
      memory: number;
      network: number;
      disk: number;
    };
  };
  logs: Array<{
    id: string;
    timestamp: number;
    level: "info" | "warn" | "error" | "debug";
    message: string;
    testId?: string;
    deviceId?: string;
    metadata?: Record<string, any>;
  }>;
  events: Array<{
    id: string;
    timestamp: number;
    type: string;
    data: any;
    source: string;
  }>;
}

export class TestExecutionDO {
  private state: DurableObjectState;
  private env: any;
  private db: any;
  private connections: Map<string, WebSocketConnection> = new Map();
  private executionState: ExecutionState | null = null;
  private heartbeatInterval: number | null = null;
  private metricsInterval: number | null = null;
  private logBuffer: Array<any> = [];
  private readonly MAX_LOG_BUFFER_SIZE = 1000;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly METRICS_UPDATE_INTERVAL = 5000; // 5 seconds

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.db = drizzle(env.DB, { schema });
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Handle WebSocket upgrade
      if (request.headers.get("Upgrade") === "websocket") {
        return this.handleWebSocketUpgrade(request);
      }

      // Handle HTTP API calls
      switch (path) {
        case "/status":
          return this.handleGetStatus(request);
        case "/control":
          return this.handleControl(request);
        case "/logs":
          return this.handleGetLogs(request);
        case "/metrics":
          return this.handleGetMetrics(request);
        case "/devices":
          return this.handleGetDevices(request);
        case "/events":
          return this.handleGetEvents(request);
        default:
          return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("TestExecutionDO error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Handle WebSocket connection upgrade
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const executionId = url.pathname.split("/")[2]; // Extract from /ws/test-execution/{executionId}

    if (!executionId) {
      return new Response("Missing execution ID", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    // Generate connection ID
    const connectionId = this.generateId();

    // Extract user info from headers
    const userId = request.headers.get("x-user-id") || undefined;
    const subscriptionEvents =
      request.headers.get("x-subscribe-events")?.split(",") || [];

    // Store connection
    const connection: WebSocketConnection = {
      id: connectionId,
      socket: server,
      userId,
      lastPing: Date.now(),
      subscribedEvents,
      metadata: {
        userAgent: request.headers.get("user-agent"),
        connectedAt: Date.now(),
        executionId,
      },
    };

    this.connections.set(connectionId, connection);

    // Initialize or load execution state
    if (!this.executionState) {
      await this.loadExecutionState(executionId);
    }

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers(connectionId, server);

    // Send initial state
    this.sendToConnection(connectionId, {
      type: "connection_established",
      data: {
        connectionId,
        executionId,
        currentState: this.executionState,
        timestamp: Date.now(),
      },
    });

    // Start background tasks
    this.startBackgroundTasks();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(
    connectionId: string,
    socket: WebSocket,
  ): void {
    socket.addEventListener("message", (event) => {
      this.handleWebSocketMessage(connectionId, event);
    });

    socket.addEventListener("close", () => {
      this.handleWebSocketClose(connectionId);
    });

    socket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
      this.handleWebSocketClose(connectionId);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleWebSocketMessage(
    connectionId: string,
    event: MessageEvent,
  ): Promise<void> {
    try {
      const message = JSON.parse(event.data as string);
      const connection = this.connections.get(connectionId);

      if (!connection) return;

      // Update last ping
      connection.lastPing = Date.now();

      switch (message.type) {
        case "ping":
          this.sendToConnection(connectionId, {
            type: "pong",
            data: { timestamp: Date.now() },
          });
          break;

        case "subscribe":
          // Subscribe to specific events
          if (message.events && Array.isArray(message.events)) {
            connection.subscribedEvents = [
              ...new Set([...connection.subscribedEvents, ...message.events]),
            ];
          }
          break;

        case "unsubscribe":
          // Unsubscribe from specific events
          if (message.events && Array.isArray(message.events)) {
            connection.subscribedEvents = connection.subscribedEvents.filter(
              (event) => !message.events.includes(event),
            );
          }
          break;

        case "get_state":
          // Send current state
          this.sendToConnection(connectionId, {
            type: "state_update",
            data: {
              state: this.executionState,
              timestamp: Date.now(),
            },
          });
          break;

        case "control_execution":
          // Handle execution control
          await this.handleExecutionControl(message.action, message.data);
          break;

        default:
          console.warn("Unknown WebSocket message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      this.sendToConnection(connectionId, {
        type: "error",
        data: {
          message: "Invalid message format",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleWebSocketClose(connectionId: string): void {
    this.connections.delete(connectionId);

    // If no more connections, stop background tasks
    if (this.connections.size === 0) {
      this.stopBackgroundTasks();
    }
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending message:", error);
        // Remove broken connection
        this.connections.delete(connectionId);
      }
    }
  }

  /**
   * Broadcast message to all connections
   */
  private broadcast(message: any, eventType?: string): void {
    const messageString = JSON.stringify(message);

    for (const [connectionId, connection] of this.connections.entries()) {
      // Filter by event type if specified
      if (
        eventType &&
        !connection.subscribedEvents.includes(eventType) &&
        !connection.subscribedEvents.includes("*")
      ) {
        continue;
      }

      if (connection.socket.readyState === WebSocket.OPEN) {
        try {
          connection.socket.send(messageString);
        } catch (error) {
          console.error("Error broadcasting message:", error);
          this.connections.delete(connectionId);
        }
      }
    }
  }

  /**
   * Load execution state from database
   */
  private async loadExecutionState(executionId: string): Promise<void> {
    try {
      // Get execution details
      const execution = await this.db
        .select()
        .from(schema.testExecutions)
        .where(eq(schema.testExecutions.id, executionId))
        .first();

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      // Get test results
      const results = await this.db
        .select()
        .from(schema.testExecutionResults)
        .where(eq(schema.testExecutionResults.executionId, executionId));

      // Get artifacts
      const artifacts = await this.db
        .select()
        .from(schema.testArtifacts)
        .where(eq(schema.testArtifacts.executionId, executionId));

      // Get metrics
      const metrics = await this.db
        .select()
        .from(schema.testExecutionMetrics)
        .where(eq(schema.testExecutionMetrics.executionId, executionId))
        .orderBy(desc(schema.testExecutionMetrics.timestamp))
        .limit(1)
        .first();

      // Calculate progress
      const totalTests = results.length;
      const completedTests = results.filter((r) =>
        ["passed", "completed", "failed", "skipped", "error"].includes(r.status),
      ).length;
      const failedTests = results.filter((r) => r.status === "failed").length;
      const skippedTests = results.filter((r) => r.status === "skipped").length;

      // Initialize execution state
      this.executionState = {
        id: executionId,
        projectId: execution.projectId,
        status: execution.status as any,
        progress: {
          total: totalTests,
          completed: completedTests,
          failed: failedTests,
          skipped: skippedTests,
          percentage:
            totalTests > 0
              ? Math.round((completedTests / totalTests) * 100)
              : 0,
        },
        startTime: execution.createdAt,
        endTime: execution.completedAt,
        currentTest: this.getCurrentTest(results),
        devices: [], // Will be populated by execution engine
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          name: artifact.name,
          size: artifact.size || 0,
          timestamp: artifact.createdAt,
        })),
        metrics: {
          totalDuration: execution.duration || 0,
          averageTestDuration: metrics?.averageDuration || 0,
          successRate: metrics?.successRate || 0,
          throughput: metrics?.throughput || 0,
          resourceUtilization: metrics?.resourceUtilization
            ? JSON.parse(metrics.resourceUtilization)
            : {
                cpu: 0,
                memory: 0,
                network: 0,
                disk: 0,
              },
        },
        logs: [],
        events: [
          {
            id: this.generateId(),
            timestamp: Date.now(),
            type: "state_loaded",
            data: { executionId },
            source: "test-execution-do",
          },
        ],
      };
    } catch (error) {
      console.error("Error loading execution state:", error);
      throw error;
    }
  }

  /**
   * Get current running test
   */
  private getCurrentTest(results: any[]): any {
    const runningTests = results.filter((r) => r.status === "running");
    if (runningTests.length > 0) {
      const test = runningTests[0];
      return {
        id: test.testId,
        name: `Test ${test.testId}`, // Would be populated from test details
        status: test.status,
        startTime: test.startedAt || Date.now(),
        step: test.step,
      };
    }
    return undefined;
  }

  /**
   * Handle HTTP requests
   */
  private async handleGetStatus(request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({
        success: true,
        state: this.executionState,
        connections: this.connections.size,
        timestamp: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private async handleControl(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json();
    await this.handleExecutionControl(body.action, body.data);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${body.action} action completed`,
        timestamp: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private async handleGetLogs(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const level = url.searchParams.get("level");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const since = parseInt(url.searchParams.get("since") || "0");

    let logs = this.executionState?.logs || [];

    // Filter by level
    if (level) {
      logs = logs.filter((log) => log.level === level);
    }

    // Filter by timestamp
    if (since > 0) {
      logs = logs.filter((log) => log.timestamp >= since);
    }

    // Limit results
    logs = logs.slice(-limit);

    return new Response(
      JSON.stringify({
        success: true,
        logs,
        total: logs.length,
        timestamp: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private async handleGetMetrics(request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({
        success: true,
        metrics: this.executionState?.metrics || {},
        progress: this.executionState?.progress || {},
        devices: this.executionState?.devices || [],
        timestamp: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private async handleGetDevices(request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({
        success: true,
        devices: this.executionState?.devices || [],
        timestamp: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private async handleGetEvents(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const since = parseInt(url.searchParams.get("since") || "0");

    let events = this.executionState?.events || [];

    // Filter by type
    if (type) {
      events = events.filter((event) => event.type === type);
    }

    // Filter by timestamp
    if (since > 0) {
      events = events.filter((event) => event.timestamp >= since);
    }

    // Limit results
    events = events.slice(-limit);

    return new Response(
      JSON.stringify({
        success: true,
        events,
        total: events.length,
        timestamp: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  /**
   * Handle execution control actions
   */
  private async handleExecutionControl(
    action: string,
    data: any,
  ): Promise<void> {
    if (!this.executionState) return;

    const timestamp = Date.now();
    const event = {
      id: this.generateId(),
      timestamp,
      type: "execution_control",
      data: { action, data, previousStatus: this.executionState.status },
      source: "client",
    };

    // Add event to history
    this.executionState.events.push(event);
    if (this.executionState.events.length > 1000) {
      this.executionState.events = this.executionState.events.slice(-1000);
    }

    // Update state based on action
    switch (action) {
      case "pause":
        if (this.executionState.status === "running") {
          this.executionState.status = "paused";
        }
        break;

      case "resume":
        if (this.executionState.status === "paused") {
          this.executionState.status = "running";
        }
        break;

      case "cancel":
        this.executionState.status = "cancelled";
        this.executionState.endTime = timestamp;
        break;

      default:
        console.warn("Unknown control action:", action);
        return;
    }

    // Persist state change
    await this.persistStateChange();

    // Broadcast state change
    this.broadcast(
      {
        type: "state_change",
        data: {
          action,
          state: this.executionState,
          timestamp,
        },
      },
      "state_change",
    );
  }

  /**
   * Update execution progress
   */
  public async updateProgress(update: {
    testId?: string;
    status?: string;
    step?: string;
    increment?: number;
  }): Promise<void> {
    if (!this.executionState) return;

    const timestamp = Date.now();

    // Update current test
    if (update.testId) {
      this.executionState.currentTest = {
        id: update.testId,
        name: `Test ${update.testId}`,
        status: update.status || "running",
        startTime: timestamp,
        step: update.step,
      };
    }

    // Update progress
    if (update.increment) {
      this.executionState.progress.completed += update.increment;
      this.executionState.progress.percentage = Math.round(
        (this.executionState.progress.completed /
          this.executionState.progress.total) *
          100,
      );
    }

    // Add event
    const event = {
      id: this.generateId(),
      timestamp,
      type: "progress_update",
      data: update,
      source: "execution_engine",
    };

    this.executionState.events.push(event);
    if (this.executionState.events.length > 1000) {
      this.executionState.events = this.executionState.events.slice(-1000);
    }

    // Broadcast progress update
    this.broadcast(
      {
        type: "progress_update",
        data: {
          currentTest: this.executionState.currentTest,
          progress: this.executionState.progress,
          update,
          timestamp,
        },
      },
      "progress_update",
    );
  }

  /**
   * Add log entry
   */
  public addLog(log: {
    level: "info" | "warn" | "error" | "debug";
    message: string;
    testId?: string;
    deviceId?: string;
    metadata?: Record<string, any>;
  }): void {
    if (!this.executionState) return;

    const logEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...log,
    };

    this.executionState.logs.push(logEntry);

    // Limit log size
    if (this.executionState.logs.length > this.MAX_LOG_BUFFER_SIZE) {
      this.executionState.logs = this.executionState.logs.slice(
        -this.MAX_LOG_BUFFER_SIZE,
      );
    }

    // Broadcast log to subscribed clients
    this.broadcast(
      {
        type: "log_entry",
        data: logEntry,
      },
      "log_entry",
    );
  }

  /**
   * Update device status
   */
  public updateDeviceStatus(deviceId: string, status: any): void {
    if (!this.executionState) return;

    const existingDeviceIndex = this.executionState.devices.findIndex(
      (d) => d.id === deviceId,
    );

    const deviceUpdate = {
      id: deviceId,
      ...status,
      lastUpdate: Date.now(),
    };

    if (existingDeviceIndex >= 0) {
      this.executionState.devices[existingDeviceIndex] = {
        ...this.executionState.devices[existingDeviceIndex],
        ...deviceUpdate,
      };
    } else {
      this.executionState.devices.push(deviceUpdate);
    }

    // Broadcast device update
    this.broadcast(
      {
        type: "device_update",
        data: deviceUpdate,
      },
      "device_update",
    );
  }

  /**
   * Add artifact
   */
  public addArtifact(artifact: {
    id: string;
    type: string;
    name: string;
    size: number;
  }): void {
    if (!this.executionState) return;

    const artifactEntry = {
      ...artifact,
      timestamp: Date.now(),
    };

    this.executionState.artifacts.push(artifactEntry);

    // Broadcast artifact addition
    this.broadcast(
      {
        type: "artifact_added",
        data: artifactEntry,
      },
      "artifact_added",
    );
  }

  /**
   * Update metrics
   */
  public updateMetrics(metrics: Partial<ExecutionState["metrics"]>): void {
    if (!this.executionState) return;

    this.executionState.metrics = {
      ...this.executionState.metrics,
      ...metrics,
    };

    // Broadcast metrics update
    this.broadcast(
      {
        type: "metrics_update",
        data: this.executionState.metrics,
      },
      "metrics_update",
    );
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    if (this.heartbeatInterval) return;

    // Start heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.HEARTBEAT_INTERVAL);

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.METRICS_UPDATE_INTERVAL);
  }

  /**
   * Stop background tasks
   */
  private stopBackgroundTasks(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Check connection heartbeats
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = this.HEARTBEAT_INTERVAL * 2; // 2x heartbeat interval

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastPing > timeout) {
        console.log(`Connection ${connectionId} timed out`);
        connection.socket.close();
        this.connections.delete(connectionId);
      }
    }

    // If no more connections, stop background tasks
    if (this.connections.size === 0) {
      this.stopBackgroundTasks();
    }
  }

  /**
   * Collect and update metrics
   */
  private collectMetrics(): void {
    if (!this.executionState) return;

    // Update resource utilization based on active connections and devices
    const activeConnections = this.connections.size;
    const activeDevices = this.executionState.devices.filter(
      (d) => d.status === "active",
    ).length;

    this.executionState.metrics.resourceUtilization = {
      cpu: Math.min(100, activeConnections * 5 + activeDevices * 10),
      memory: Math.min(100, activeConnections * 2 + activeDevices * 5),
      network: Math.min(100, activeConnections * 3),
      disk: Math.min(100, this.executionState.artifacts.length * 0.1),
    };

    // Broadcast metrics update
    this.broadcast(
      {
        type: "metrics_update",
        data: {
          metrics: this.executionState.metrics,
          timestamp: Date.now(),
        },
      },
      "metrics_update",
    );
  }

  /**
   * Persist state changes to database
   */
  private async persistStateChange(): Promise<void> {
    if (!this.executionState) return;

    try {
      // Update execution status in database
      await this.db
        .update(schema.testExecutions)
        .set({
          status: this.executionState.status,
          updatedAt: Date.now(),
          completedAt: this.executionState.endTime || null,
        })
        .where(eq(schema.testExecutions.id, this.executionState.id));

      // Store events in database for historical analysis
      // This would be implemented based on specific requirements
    } catch (error) {
      console.error("Error persisting state change:", error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on Durable Object shutdown
   */
  async close(): Promise<void> {
    this.stopBackgroundTasks();

    // Close all WebSocket connections
    for (const [connectionId, connection] of this.connections.entries()) {
      connection.socket.close();
    }
    this.connections.clear();
  }
}
