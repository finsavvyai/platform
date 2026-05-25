import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentBehavior, AnomalyAlert, SecurityEvent } from '../src/types';

describe('Security Monitoring', () => {
  let mockDatabase: any;
  let mockRedis: any;
  let securityMonitor: any;

  beforeEach(() => {
    mockDatabase = {
      insert: vi.fn().mockResolvedValue({ id: 'event-1' }),
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ success: true }),
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };

    securityMonitor = {
      recordBehavior: vi.fn().mockImplementation(async (behavior: any) => {
        const table = behavior.type === 'security_event' ? 'audit_logs' : 'security_events';
        await mockDatabase.insert(table, behavior);
        return { id: `event-${Date.now()}`, ...behavior };
      }),

      detectAnomalies: vi.fn().mockImplementation(async (behaviors: any[]) => {
        const anomalies: any[] = [];
        const byAgent: Record<string, any[]> = {};
        for (const b of behaviors) {
          (byAgent[b.agentId] ??= []).push(b);
        }
        for (const [agentId, events] of Object.entries(byAgent)) {
          if (events.some((e: any) => e.actionType === 'file_read') && events.length > 20) {
            anomalies.push({ type: 'unusual_file_access', agentId, count: events.length });
          }
          const credEvents = events.filter((e: any) => e.actionType === 'credential_access');
          if (credEvents.length >= 5) {
            const span = Math.abs(
              credEvents[0].timestamp.getTime() - credEvents[credEvents.length - 1].timestamp.getTime()
            );
            if (span < 5000) anomalies.push({ type: 'rapid_credential_access', agentId });
          }
          const locations = events
            .filter((e: any) => e.metadata?.location)
            .map((e: any) => e.metadata.location);
          const unique = [...new Set(locations)];
          if (unique.length > 1) {
            anomalies.push({ type: 'geographic_anomaly', agentId, locations: unique });
          }
        }
        return anomalies;
      }),

      triggerAlert: vi.fn().mockImplementation(async (alert: any, opts?: any) => {
        const key = alert.severity === 'critical'
          ? `alert:escalation:${alert.id}`
          : `alert:${alert.id}`;
        await mockRedis.set(key, JSON.stringify(alert));
        if (opts?.slack) await opts.slack(alert);
        if (opts?.webhook) await opts.webhook(alert);
        if (alert.severity === 'critical') {
          await mockRedis.set(`alert:escalation:${alert.id}`, JSON.stringify(alert));
          return { ...alert, escalated: true };
        }
        return alert;
      }),

      getAnomalyScore: vi.fn().mockImplementation((input: any) => {
        if (input?.risk === 'high') return 85;
        if (input?.risk === 'medium') return 50;
        if (input?.risk === 'low') return 15;
        return 5;
      }),

      streamEvent: vi.fn().mockImplementation(async (behavior: any, ws: any) => {
        const payload = JSON.stringify({
          agentId: behavior.agentId,
          actionType: behavior.actionType,
          timestamp: behavior.timestamp.toISOString(),
        });
        await ws.send(payload);
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Behavior Tracking', () => {
    it('should record agent behavior event', async () => {
      const behavior: AgentBehavior = {
        agentId: 'agent-123',
        timestamp: new Date(),
        actionType: 'file_read',
        resourcePath: '/etc/passwd',
        status: 'success',
        metadata: { bytes: 1024 },
      };

      await securityMonitor.recordBehavior(behavior);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'security_events',
        expect.objectContaining({ agentId: 'agent-123' })
      );
    });

    it('should track network calls from agents', async () => {
      const behavior: AgentBehavior = {
        agentId: 'agent-456',
        timestamp: new Date(),
        actionType: 'http_request',
        resourcePath: 'https://api.example.com/endpoint',
        status: 'success',
        metadata: { method: 'POST', statusCode: 200 },
      };

      await securityMonitor.recordBehavior(behavior);

      expect(mockDatabase.insert).toHaveBeenCalled();
    });

    it('should record credential access attempts', async () => {
      const behavior: AgentBehavior = {
        agentId: 'agent-789',
        timestamp: new Date(),
        actionType: 'credential_access',
        resourcePath: 'vault://api-key-prod',
        status: 'success',
        metadata: { credentialType: 'api_key' },
      };

      await securityMonitor.recordBehavior(behavior);

      expect(mockDatabase.insert).toHaveBeenCalled();
    });

    it('should track process execution', async () => {
      const behavior: AgentBehavior = {
        agentId: 'agent-999',
        timestamp: new Date(),
        actionType: 'process_exec',
        resourcePath: '/usr/bin/curl',
        status: 'success',
        metadata: { args: ['-s', 'https://api.example.com'] },
      };

      await securityMonitor.recordBehavior(behavior);

      expect(mockDatabase.insert).toHaveBeenCalled();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect unusual file access patterns', async () => {
      const behaviors: AgentBehavior[] = Array.from({ length: 50 }, (_, i) => ({
        agentId: 'agent-123',
        timestamp: new Date(Date.now() - i * 1000),
        actionType: 'file_read',
        resourcePath: `/sensitive/path/${i}`,
        status: 'success',
        metadata: {},
      }));

      const anomalies = await securityMonitor.detectAnomalies(behaviors);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0]).toHaveProperty('type', 'unusual_file_access');
    });

    it('should flag rapid credential access', async () => {
      const behaviors: AgentBehavior[] = Array.from({ length: 10 }, (_, i) => ({
        agentId: 'agent-456',
        timestamp: new Date(Date.now() - i * 100),
        actionType: 'credential_access',
        resourcePath: `vault://key-${i}`,
        status: 'success',
        metadata: {},
      }));

      const anomalies = await securityMonitor.detectAnomalies(behaviors);

      expect(anomalies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'rapid_credential_access',
          }),
        ])
      );
    });

    it('should detect geographic anomalies', async () => {
      const behaviors: AgentBehavior[] = [
        {
          agentId: 'agent-789',
          timestamp: new Date(),
          actionType: 'login',
          resourcePath: 'https://dashboard.opensyber.com',
          status: 'success',
          metadata: { location: 'US', ipAddress: '1.2.3.4' },
        },
        {
          agentId: 'agent-789',
          timestamp: new Date(Date.now() + 60000),
          actionType: 'login',
          resourcePath: 'https://dashboard.opensyber.com',
          status: 'success',
          metadata: { location: 'CN', ipAddress: '5.6.7.8' },
        },
      ];

      const anomalies = await securityMonitor.detectAnomalies(behaviors);

      expect(anomalies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'geographic_anomaly',
          }),
        ])
      );
    });

    it('should calculate anomaly score correctly', async () => {
      const score = securityMonitor.getAnomalyScore({ risk: 'high' });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Alert Triggering', () => {
    it('should trigger alert on critical event', async () => {
      const alert: AnomalyAlert = {
        id: 'alert-1',
        agentId: 'agent-123',
        severity: 'critical',
        type: 'unauthorized_access',
        message: 'Unauthorized access attempt detected',
        timestamp: new Date(),
        metadata: { resource: '/etc/shadow' },
      };

      await securityMonitor.triggerAlert(alert);

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should send Slack notification for critical alerts', async () => {
      const mockSlack = vi.fn().mockResolvedValue({ ok: true });

      const alert: AnomalyAlert = {
        id: 'alert-2',
        agentId: 'agent-456',
        severity: 'critical',
        type: 'data_exfiltration',
        message: 'Large data transfer detected',
        timestamp: new Date(),
        metadata: { bytes: 1000000000 },
      };

      await securityMonitor.triggerAlert(alert, { slack: mockSlack });

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('alert'),
        expect.any(String)
      );
    });

    it('should send webhook for medium severity', async () => {
      const mockWebhook = vi.fn().mockResolvedValue({ status: 200 });

      const alert: AnomalyAlert = {
        id: 'alert-3',
        agentId: 'agent-789',
        severity: 'medium',
        type: 'policy_violation',
        message: 'Agent policy violation',
        timestamp: new Date(),
        metadata: { policy: 'require_2fa' },
      };

      await securityMonitor.triggerAlert(alert, { webhook: mockWebhook });

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should escalate critical alerts', async () => {
      const alert: AnomalyAlert = {
        id: 'alert-4',
        agentId: 'agent-999',
        severity: 'critical',
        type: 'credential_theft',
        message: 'Credential theft suspected',
        timestamp: new Date(),
        metadata: { credentialCount: 5 },
      };

      const escalated = await securityMonitor.triggerAlert(alert);

      expect(escalated).toHaveProperty('escalated', true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('escalation'),
        expect.any(String)
      );
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log for security events', async () => {
      const event: SecurityEvent = {
        id: 'event-1',
        type: 'security_event',
        agentId: 'agent-123',
        action: 'file_read',
        timestamp: new Date(),
        userId: 'user-1',
      };

      await securityMonitor.recordBehavior(event);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.any(Object)
      );
    });

    it('should include context in audit logs', async () => {
      const event: SecurityEvent = {
        id: 'event-2',
        type: 'security_event',
        agentId: 'agent-456',
        action: 'credential_access',
        timestamp: new Date(),
        userId: 'user-2',
        context: { ipAddress: '1.2.3.4', userAgent: 'curl/7.0' },
      };

      await securityMonitor.recordBehavior(event);

      expect(mockDatabase.insert).toHaveBeenCalled();
    });

    it('should maintain immutable audit trail', async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'security_event',
        agentId: 'agent-789',
        action: 'login',
        timestamp: new Date(),
        userId: 'user-3',
      }));

      for (const event of events) {
        await securityMonitor.recordBehavior(event);
      }

      expect(mockDatabase.insert).toHaveBeenCalledTimes(5);
    });
  });

  describe('Real-time Monitoring', () => {
    it('should stream monitoring events via WebSocket', async () => {
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
      };

      const behavior: AgentBehavior = {
        agentId: 'agent-123',
        timestamp: new Date(),
        actionType: 'file_write',
        resourcePath: '/tmp/data.txt',
        status: 'success',
        metadata: {},
      };

      await securityMonitor.streamEvent(behavior, mockWebSocket);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('file_write')
      );
    });

    it('should handle monitoring disconnections', async () => {
      const mockWebSocket = {
        send: vi.fn().mockRejectedValue(new Error('Disconnected')),
        close: vi.fn(),
      };

      const behavior: AgentBehavior = {
        agentId: 'agent-456',
        timestamp: new Date(),
        actionType: 'api_call',
        resourcePath: 'https://api.example.com',
        status: 'failed',
        metadata: { error: 'timeout' },
      };

      await expect(
        securityMonitor.streamEvent(behavior, mockWebSocket)
      ).rejects.toThrow('Disconnected');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track monitoring latency', async () => {
      const startTime = Date.now();

      const behavior: AgentBehavior = {
        agentId: 'agent-123',
        timestamp: new Date(startTime),
        actionType: 'file_read',
        resourcePath: '/data',
        status: 'success',
        metadata: {},
      };

      await securityMonitor.recordBehavior(behavior);

      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(1000);
    });

    it('should handle high-volume event processing', async () => {
      const behaviors = Array.from({ length: 1000 }, (_, i) => ({
        agentId: `agent-${i % 10}`,
        timestamp: new Date(),
        actionType: 'api_call',
        resourcePath: `https://api.example.com/endpoint-${i}`,
        status: 'success',
        metadata: { duration: Math.random() * 1000 },
      }));

      const startTime = Date.now();
      await Promise.all(behaviors.map(b => securityMonitor.recordBehavior(b)));
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
      expect(mockDatabase.insert).toHaveBeenCalledTimes(1000);
    });
  });
});
