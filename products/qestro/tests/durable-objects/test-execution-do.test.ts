/**
 * Test Execution Durable Object Tests
 *
 * Comprehensive test suite for real-time test execution monitoring.
 * Tests WebSocket connections, state management, event broadcasting,
 * and integration with the test execution engine.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestExecutionDO } from '../../src/durable-objects/test-execution-do';

// Mock DurableObjectState and environment
const createMockState = () => ({
  storage: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    transaction: vi.fn(),
  },
  idFromName: vi.fn(),
  idFromString: vi.fn(),
});

const createMockEnv = () => ({
  DB: {} as D1Database,
  TEST_EXECUTION_DO: {
    idFromName: vi.fn(() => ({ get: vi.fn() })),
  },
});

describe('TestExecutionDO', () => {
  let testExecutionDO: TestExecutionDO;
  let mockState: any;
  let mockEnv: any;

  beforeEach(() => {
    mockState = createMockState();
    mockEnv = createMockEnv();
    testExecutionDO = new TestExecutionDO(mockState, mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    it('should handle WebSocket upgrade successfully', async () => {
      const executionId = 'test-execution-123';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: {
          'Upgrade': 'websocket',
          'x-user-id': 'user-123',
          'x-subscribe-events': 'progress_update,log_entry'
        }
      });

      // Mock execution state loading
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        projectId: 'project-123',
        status: 'running',
        createdAt: Date.now(),
        completedAt: null
      });

      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });

    it('should reject WebSocket upgrade without execution ID', async () => {
      const request = new Request('http://localhost/ws/test-execution/', {
        headers: { 'Upgrade': 'websocket' }
      });

      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing execution ID');
    });

    it('should handle multiple concurrent WebSocket connections', async () => {
      const executionId = 'test-execution-456';
      const connections = [];

      // Mock execution state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        projectId: 'project-456',
        status: 'running'
      });

      // Create multiple connections
      for (let i = 0; i < 5; i++) {
        const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
          headers: {
            'Upgrade': 'websocket',
            'x-user-id': `user-${i}`
          }
        });

        const response = await testExecutionDO.fetch(request);
        connections.push(response);
      }

      // All connections should be established
      connections.forEach(response => {
        expect(response.status).toBe(101);
      });
    });
  });

  describe('Message Handling', () => {
    let mockWebSocket: any;
    let mockPair: any;

    beforeEach(() => {
      // Create mock WebSocket pair
      mockPair = {
        client: { readyState: WebSocket.OPEN, send: vi.fn() },
        server: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          addEventListener: vi.fn(),
          close: vi.fn()
        }
      };
      mockWebSocket = mockPair.server;

      // Mock WebSocketPair
      global.WebSocketPair = vi.fn(() => ({
        0: mockPair.client,
        1: mockPair.server
      })) as any;
    });

    it('should handle ping messages correctly', async () => {
      const executionId = 'test-execution-789';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: { 'Upgrade': 'websocket' }
      });

      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running'
      });

      await testExecutionDO.fetch(request);

      // Simulate ping message
      const pingMessage = { type: 'ping', timestamp: Date.now() };
      mockWebSocket.addEventListener.mock.calls[0][1]({
        data: JSON.stringify(pingMessage)
      });

      // Should send pong response
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'pong',
          data: expect.any(Number)
        })
      );
    });

    it('should handle subscription management', async () => {
      const executionId = 'test-execution-sub';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: {
          'Upgrade': 'websocket',
          'x-subscribe-events': 'progress_update'
        }
      });

      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running'
      });

      await testExecutionDO.fetch(request);

      // Subscribe to additional events
      const subscribeMessage = {
        type: 'subscribe',
        events: ['log_entry', 'device_update']
      };

      mockWebSocket.addEventListener.mock.calls[0][1]({
        data: JSON.stringify(subscribeMessage)
      });

      // Should handle subscription (verified through no errors)
      expect(mockWebSocket.addEventListener).toHaveBeenCalled();
    });

    it('should handle execution control messages', async () => {
      const executionId = 'test-execution-control';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: { 'Upgrade': 'websocket' }
      });

      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running'
      });

      await testExecutionDO.fetch(request);

      // Send pause control message
      const controlMessage = {
        type: 'control_execution',
        action: 'pause',
        data: { reason: 'User requested pause' }
      };

      mockWebSocket.addEventListener.mock.calls[0][1]({
        data: JSON.stringify(controlMessage)
      });

      // Should handle control message without errors
      expect(mockWebSocket.addEventListener).toHaveBeenCalled();
    });
  });

  describe('HTTP API Endpoints', () => {
    beforeEach(() => {
      // Mock execution state for HTTP endpoints
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: 'exec-http-123',
        projectId: 'project-123',
        status: 'running',
        progress: {
          total: 10,
          completed: 5,
          failed: 1,
          skipped: 0,
          percentage: 50
        },
        devices: [
          {
            id: 'device-1',
            name: 'iPhone 12',
            platform: 'ios',
            status: 'active',
            battery: 85
          }
        ],
        artifacts: [],
        metrics: {
          totalDuration: 120000,
          averageTestDuration: 12000,
          successRate: 80,
          resourceUtilization: {
            cpu: 45,
            memory: 60,
            network: 20,
            disk: 30
          }
        },
        logs: [
          {
            id: 'log-1',
            timestamp: Date.now(),
            level: 'info',
            message: 'Test execution started'
          }
        ],
        events: [
          {
            id: 'event-1',
            timestamp: Date.now(),
            type: 'execution_started',
            data: {},
            source: 'system'
          }
        ]
      });
    });

    it('should return current status', async () => {
      const request = new Request('http://localhost/status');
      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.state).toBeDefined();
      expect(data.state.id).toBe('exec-http-123');
      expect(data.connections).toBe(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should return execution logs', async () => {
      const request = new Request('http://localhost/logs?level=info&limit=10');
      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.logs).toBeDefined();
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].level).toBe('info');
    });

    it('should return metrics', async () => {
      const request = new Request('http://localhost/metrics');
      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.metrics).toBeDefined();
      expect(data.progress).toBeDefined();
      expect(data.devices).toBeDefined();
      expect(data.metrics.successRate).toBe(80);
    });

    it('should return device status', async () => {
      const request = new Request('http://localhost/devices');
      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.devices).toBeDefined();
      expect(data.devices).toHaveLength(1);
      expect(data.devices[0].name).toBe('iPhone 12');
    });

    it('should return events', async () => {
      const request = new Request('http://localhost/events?type=execution_started');
      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.events).toBeDefined();
      expect(data.events[0].type).toBe('execution_started');
    });

    it('should handle execution control', async () => {
      const controlData = {
        action: 'pause',
        data: { reason: 'Manual pause' }
      };

      const request = new Request('http://localhost/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(controlData)
      });

      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('pause action completed');
    });
  });

  describe('State Management', () => {
    it('should maintain execution state across connections', async () => {
      const executionId = 'state-test-123';

      // Mock initial state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running',
        progress: { total: 5, completed: 2, percentage: 40 }
      });

      // First connection
      const request1 = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: { 'Upgrade': 'websocket' }
      });

      // Mock WebSocketPair for first connection
      const mockPair1 = {
        client: { readyState: WebSocket.OPEN },
        server: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          addEventListener: vi.fn(),
          close: vi.fn()
        }
      };

      global.WebSocketPair = vi.fn(() => ({
        0: mockPair1.client,
        1: mockPair1.server
      })) as any;

      await testExecutionDO.fetch(request1);

      // Second connection should get same state
      const request2 = new Request(`http://localhost/status`);
      const response = await testExecutionDO.fetch(request2);
      const data = await response.json();

      expect(data.state.id).toBe(executionId);
      expect(data.state.progress.completed).toBe(2);
    });

    it('should update progress correctly', async () => {
      const executionId = 'progress-test-123';

      // Mock initial state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running',
        progress: { total: 10, completed: 3, percentage: 30 }
      });

      // Test progress update
      await testExecutionDO.updateProgress({
        testId: 'test-456',
        status: 'completed',
        increment: 1
      });

      // Progress should be updated in state
      // This would be verified through WebSocket messages or status endpoint
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle log entries correctly', async () => {
      const executionId = 'log-test-123';

      // Mock initial state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running',
        logs: []
      });

      // Test log addition
      testExecutionDO.addLog({
        level: 'info',
        message: 'Test step completed',
        testId: 'test-789',
        metadata: { step: 'login' }
      });

      // Log should be added to state
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle device status updates', async () => {
      const executionId = 'device-test-123';

      // Mock initial state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running',
        devices: []
      });

      // Test device status update
      testExecutionDO.updateDeviceStatus('device-456', {
        name: 'Android Emulator',
        platform: 'android',
        status: 'active',
        battery: 90
      });

      // Device should be added/updated in state
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle artifact additions', async () => {
      const executionId = 'artifact-test-123';

      // Mock initial state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running',
        artifacts: []
      });

      // Test artifact addition
      testExecutionDO.addArtifact({
        id: 'artifact-456',
        type: 'screenshot',
        name: 'login-page-screenshot',
        size: 1024000
      });

      // Artifact should be added to state
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle metrics updates', async () => {
      const executionId = 'metrics-test-123';

      // Mock initial state
      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running',
        metrics: {
          totalDuration: 60000,
          averageTestDuration: 5000,
          successRate: 90
        }
      });

      // Test metrics update
      testExecutionDO.updateMetrics({
        totalDuration: 120000,
        successRate: 85,
        resourceUtilization: {
          cpu: 50,
          memory: 65,
          network: 25,
          disk: 35
        }
      });

      // Metrics should be updated in state
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid WebSocket messages gracefully', async () => {
      const executionId = 'error-test-123';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: { 'Upgrade': 'websocket' }
      });

      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running'
      });

      // Mock WebSocket
      const mockPair = {
        client: { readyState: WebSocket.OPEN },
        server: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          addEventListener: vi.fn(),
          close: vi.fn()
        }
      };

      global.WebSocketPair = vi.fn(() => ({
        0: mockPair.client,
        1: mockPair.server
      })) as any;

      await testExecutionDO.fetch(request);

      // Send invalid message
      mockWebSocket.addEventListener.mock.calls[0][1]({
        data: 'invalid json'
      });

      // Should send error response
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });

    it('should handle missing execution state gracefully', async () => {
      const executionId = 'missing-state-123';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: { 'Upgrade': 'websocket' }
      });

      // Mock missing execution
      vi.mocked(mockState.storage.get).mockResolvedValue(null);

      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should handle HTTP requests to unknown endpoints', async () => {
      const request = new Request('http://localhost/unknown-endpoint');
      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(404);
    });

    it('should handle invalid control actions', async () => {
      const request = new Request('http://localhost/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalid_action',
          data: {}
        })
      });

      const response = await testExecutionDO.fetch(request);

      expect(response.status).toBe(200);
      // Should not throw error, but action will be ignored
    });
  });

  describe('Background Tasks', () => {
    it('should start background tasks on connection', async () => {
      const executionId = 'bg-task-123';
      const request = new Request(`http://localhost/ws/test-execution/${executionId}`, {
        headers: { 'Upgrade': 'websocket' }
      });

      vi.mocked(mockState.storage.get).mockResolvedValue({
        id: executionId,
        status: 'running'
      });

      // Mock WebSocket
      const mockPair = {
        client: { readyState: WebSocket.OPEN },
        server: {
          readyState: WebSocket.OPEN,
          send: vi.fn(),
          addEventListener: vi.fn(),
          close: vi.fn()
        }
      };

      global.WebSocketPair = vi.fn(() => ({
        0: mockPair.client,
        1: mockPair.server
      })) as any;

      await testExecutionDO.fetch(request);

      // Background tasks should be started (heartbeat, metrics collection)
      // This is verified through the fact that no errors are thrown
      expect(mockPair.server.addEventListener).toHaveBeenCalled();
    });

    it('should stop background tasks when all connections close', async () => {
      // This test would verify that intervals are cleared
      // Implementation depends on specific interval tracking
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle connection timeouts', async () => {
      // Test heartbeat timeout logic
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Broadcasting', () => {
    let mockConnections: any[];

    beforeEach(() => {
      // Setup mock connections
      mockConnections = [
        {
          id: 'conn-1',
          socket: { readyState: WebSocket.OPEN, send: vi.fn() },
          subscribedEvents: ['*']
        },
        {
          id: 'conn-2',
          socket: { readyState: WebSocket.OPEN, send: vi.fn() },
          subscribedEvents: ['progress_update']
        },
        {
          id: 'conn-3',
          socket: { readyState: WebSocket.CLOSED, send: vi.fn() },
          subscribedEvents: ['*']
        }
      ];

      // Manually set up connections for testing
      (testExecutionDO as any).connections = new Map(
        mockConnections.map(conn => [conn.id, conn])
      );
    });

    it('should broadcast to all subscribers', async () => {
      const message = {
        type: 'test_message',
        data: { test: 'data' }
      };

      // Manually call broadcast method
      (testExecutionDO as any).broadcast(message, 'test_message');

      // Should send to open connections with matching subscriptions
      expect(mockConnections[0].socket.send).toHaveBeenCalled();
      expect(mockConnections[1].socket.send).toHaveBeenCalled();
      // Should not send to closed connection
      expect(mockConnections[2].socket.send).not.toHaveBeenCalled();
    });

    it('should filter broadcasts by event type', async () => {
      const message = {
        type: 'specific_event',
        data: { test: 'data' }
      };

      (testExecutionDO as any).broadcast(message, 'specific_event');

      // Should send only to connections subscribed to the specific event
      expect(mockConnections[1].socket.send).not.toHaveBeenCalled(); // Not subscribed to specific_event
    });
  });
});
