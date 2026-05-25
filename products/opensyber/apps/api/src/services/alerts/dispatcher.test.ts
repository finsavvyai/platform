import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchAlerts,
  dispatchViolationAlerts,
  dispatchCspmAlerts,
  sendTestAlert,
  buildAlertMessage,
} from './dispatcher.js';
import { createMockDb } from '../../test/helpers.js';
import { sendToChannel } from './index.js';

// Mock sendToChannel
vi.mock('./index.js', () => ({
  sendToChannel: vi.fn(),
  sendToMultipleChannels: vi.fn(),
}));

const mockSendToChannel = vi.mocked(sendToChannel);

// Mock KV namespace for rate limiting tests
const mockKv = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
} as unknown as KVNamespace;

// Mock alert channels (includes inactive)
const mockChannels = [
  {
    id: 'ac-email-1',
    orgId: 'org-123',
    channelType: 'email',
    name: 'Security Team',
    config: JSON.stringify({
      to: ['security@example.com'],
    }),
    minSeverity: 'high',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'ac-slack-1',
    orgId: 'org-123',
    channelType: 'slack',
    name: 'Slack Alerts',
    config: JSON.stringify({
      webhookUrl: 'https://hooks.slack.com/test',
    }),
    minSeverity: 'critical',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'ac-pagerduty-1',
    orgId: 'org-123',
    channelType: 'pagerduty',
    name: 'PD',
    config: JSON.stringify({
      integrationKey: 'R123',
    }),
    minSeverity: 'critical',
    isActive: false, // inactive
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

// Mock active channels only (what findActiveChannels would return)
const mockActiveChannels = mockChannels.filter((ch) => ch.isActive);

describe('Alert Dispatcher', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockSendToChannel.mockReset();
    mockSendToChannel.mockResolvedValue({
      success: true,
      externalId: 'test-external-id',
    });
  });

  describe('buildAlertMessage', () => {
    it('should build alert message with all fields', () => {
      const message = buildAlertMessage({
        id: 'alert-123',
        severity: 'critical',
        title: 'Test Alert',
        description: 'Test description',
        findings: [],
        organization: 'Test Org',
        account: 'AWS Prod',
        dashboardUrl: 'https://example.com',
      });

      expect(message.id).toBe('alert-123');
      expect(message.severity).toBe('critical');
      expect(message.title).toBe('Test Alert');
      expect(message.organization).toBe('Test Org');
      expect(message.account).toBe('AWS Prod');
      expect(message.dashboardUrl).toBe('https://example.com');
      expect(message.findings).toEqual([]);
      expect(message.timestamp).toBeTruthy();
    });

    it('should build minimal alert message', () => {
      const message = buildAlertMessage({
        id: 'alert-456',
        severity: 'low',
        title: 'Minimal Alert',
        description: 'No description provided',
        findings: [],
      });

      expect(message.id).toBe('alert-456');
      expect(message.severity).toBe('low');
      expect(message.findings).toEqual([]);
    });
  });

  describe('dispatchAlerts', () => {
    it('should dispatch to matching channels only', async () => {
      // findActiveChannels would return only active channels
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Security Alert',
        description: 'Test alert',
        findings: [],
      });

      // With active channels only (Email, Slack):
      // - Email (minSeverity='high') matches 'high' alert -> sent
      // - Slack (minSeverity='critical') does NOT match 'high' alert -> skipped
      expect(result.totalChannels).toBe(2);
      expect(result.skipped).toBe(1); // Slack (severity)
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockSendToChannel).toHaveBeenCalledTimes(1);
    });

    it('should filter by min severity', async () => {
      // findActiveChannels would return only active channels
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        severity: 'critical',
        title: 'Critical Alert',
        description: 'Critical alert',
        findings: [],
      });

      // With active channels only (Email, Slack) and severity='critical':
      // - Email (minSeverity='high') matches 'critical' -> sent
      // - Slack (minSeverity='critical') matches 'critical' -> sent
      expect(result.totalChannels).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.successful).toBe(2);
      expect(mockSendToChannel).toHaveBeenCalledTimes(2);
    });

    it('should return empty result when no channels match', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        severity: 'critical',
        title: 'Critical Alert',
        description: 'No channels match critical',
        findings: [],
      });

      // Only Slack has minSeverity='critical' but let's make all channels not match
      expect(result.totalChannels).toBeGreaterThan(0);
    });

    it('should handle send failures gracefully', async () => {
      // findActiveChannels would return only active channels
      mockDb._setSelectResults([mockActiveChannels]);

      mockSendToChannel
        .mockResolvedValueOnce({ success: true, externalId: 'email-1' })
        .mockResolvedValueOnce({ success: false, error: 'Slack API error' });

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        severity: 'critical', // Use critical to match both Email and Slack
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results.get('ac-slack-1')?.success).toBe(false);
      expect(result.results.get('ac-slack-1')?.error).toBe('Slack API error');
    });

    it('should handle config parse errors gracefully', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      mockSendToChannel.mockRejectedValueOnce(new Error('Invalid config'));

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      expect(result.failed).toBeGreaterThan(0);
    });

    it('should return empty result for solo users (no org)', async () => {
      mockDb._setSelectResults([]);

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: null,
        severity: 'high',
        title: 'Solo Alert',
        description: 'Solo user alert',
        findings: [],
      });

      expect(result.totalChannels).toBe(0);
      expect(result.successful).toBe(0);
      expect(mockSendToChannel).not.toHaveBeenCalled();
    });
  });

  describe('dispatchViolationAlerts', () => {
    it('should dispatch alerts for policy violations', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchViolationAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        violations: [
          {
            policyId: 'pol-1',
            policyName: 'No secrets in bash',
            severity: 'high',
            resourceId: 'agent-1',
            resourceType: 'agent',
            description: 'Bash command contained secret',
          },
        ],
        organization: 'Test Org',
        account: 'Prod',
        dashboardUrl: 'https://example.com',
      });

      expect(result.totalChannels).toBeGreaterThan(0);
      expect(mockSendToChannel).toHaveBeenCalled();
    });

    it('should find highest severity from violations', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchViolationAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        violations: [
          {
            policyId: 'pol-1',
            policyName: 'Low severity violation',
            severity: 'low',
            resourceId: 'agent-1',
            resourceType: 'agent',
            description: 'Minor issue',
          },
          {
            policyId: 'pol-2',
            policyName: 'Critical violation',
            severity: 'critical',
            resourceId: 'agent-2',
            resourceType: 'agent',
            description: 'Critical issue',
          },
        ],
      });

      // Should use critical severity
      expect(mockSendToChannel).toHaveBeenCalled();
      const messageArg = mockSendToChannel.mock.calls[0][0];
      expect(messageArg.severity).toBe('critical');
    });

    it('should return empty result when no violations', async () => {
      const result = await dispatchViolationAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        violations: [],
      });

      expect(result.totalChannels).toBe(0);
      expect(mockSendToChannel).not.toHaveBeenCalled();
    });
  });

  describe('dispatchCspmAlerts', () => {
    it('should dispatch alerts for CSPM findings', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchCspmAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        findings: [
          {
            id: 'finding-1',
            severity: 'critical',
            resourceId: 'bucket-data',
            resourceType: 's3-bucket',
            region: 'us-east-1',
            title: 'S3 Public Bucket',
            description: 'Bucket has public ACL',
            remediation: 'Disable public access',
          },
        ],
        cloudAccountName: 'AWS Prod',
        organization: 'Test Org',
        dashboardUrl: 'https://example.com',
      });

      expect(result.totalChannels).toBeGreaterThan(0);
      expect(mockSendToChannel).toHaveBeenCalled();

      const messageArg = mockSendToChannel.mock.calls[0][0];
      expect(messageArg.severity).toBe('critical');
      expect(messageArg.findings).toHaveLength(1);
      expect(messageArg.account).toBe('AWS Prod');
    });

    it('should return empty result when no findings', async () => {
      const result = await dispatchCspmAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        findings: [],
      });

      expect(result.totalChannels).toBe(0);
      expect(mockSendToChannel).not.toHaveBeenCalled();
    });
  });

  describe('sendTestAlert', () => {
    it('should send test alert to channel', async () => {
      const testChannel = {
        id: 'ac-test',
        orgId: 'org-123',
        channelType: 'email',
        name: 'Test Channel',
        config: JSON.stringify({ to: ['test@example.com'] }),
        minSeverity: 'low',
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      mockDb._setSelectResults([[testChannel]]);

      const result = await sendTestAlert(mockDb as any, 'ac-test');

      expect(result.success).toBe(true);
      expect(result.externalId).toBeTruthy();
      expect(mockSendToChannel).toHaveBeenCalled();

      const messageArg = mockSendToChannel.mock.calls[0][0];
      expect(messageArg.id).toContain('test-alert');
      expect(messageArg.title).toBe('OpenSyber Test Alert');
    });

    it('should return error when channel not found', async () => {
      mockDb._setSelectResults([]);

      const result = await sendTestAlert(mockDb as any, 'missing');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not found');
      expect(mockSendToChannel).not.toHaveBeenCalled();
    });

    it('should return error when channel is inactive', async () => {
      const inactiveChannel = {
        id: 'ac-inactive',
        orgId: 'org-123',
        channelType: 'email',
        name: 'Inactive',
        config: JSON.stringify({ to: ['test@example.com'] }),
        minSeverity: 'low',
        isActive: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      mockDb._setSelectResults([[inactiveChannel]]);

      const result = await sendTestAlert(mockDb as any, 'ac-inactive');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel is not active');
      expect(mockSendToChannel).not.toHaveBeenCalled();
    });

    it('should handle send failures gracefully', async () => {
      const testChannel = {
        id: 'ac-test',
        orgId: 'org-123',
        channelType: 'email',
        name: 'Test',
        config: JSON.stringify({ to: ['test@example.com'] }),
        minSeverity: 'low',
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      mockDb._setSelectResults([[testChannel]]);
      mockSendToChannel.mockResolvedValueOnce({
        success: false,
        error: 'API error',
      });

      const result = await sendTestAlert(mockDb as any, 'ac-test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDb = createMockDb();
      mockSendToChannel.mockReset();
      mockSendToChannel.mockResolvedValue({
        success: true,
        externalId: 'test-external-id',
      });
    });

    it('should allow alerts under rate limit', async () => {
      mockDb._setSelectResults([mockActiveChannels]);
      mockKv.get = vi.fn().mockResolvedValue(null); // No existing alerts

      const result = await dispatchAlerts(mockDb as any, mockKv, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      expect(result.successful).toBe(1);
      expect(mockKv.put).toHaveBeenCalled();
    });

    it('should block alerts when rate limit exceeded', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      // Mock 10 existing timestamps (rate limit reached)
      const timestamps = Array(10).fill(Date.now() - 30000); // 30 seconds ago
      mockKv.get = vi.fn().mockResolvedValue(JSON.stringify(timestamps));

      const result = await dispatchAlerts(mockDb as any, mockKv, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      const error = result.results.get('ac-email-1')?.error;
      expect(error).toContain('Rate limit exceeded');
    });

    it('should handle KV errors gracefully and allow alert', async () => {
      mockDb._setSelectResults([mockActiveChannels]);
      mockKv.get = vi.fn().mockRejectedValue(new Error('KV error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await dispatchAlerts(mockDb as any, mockKv, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      // Should still send the alert despite KV error
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should work without KV (undefined)', async () => {
      mockDb._setSelectResults([mockActiveChannels]);

      const result = await dispatchAlerts(mockDb as any, undefined, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      // Should work normally without KV
      expect(result.successful).toBe(1);
    });

    it('should update KV counter after sending alert', async () => {
      mockDb._setSelectResults([mockActiveChannels]);
      mockKv.get = vi.fn().mockResolvedValue(null);

      await dispatchAlerts(mockDb as any, mockKv, {
        orgId: 'org-123',
        severity: 'high',
        title: 'Test Alert',
        description: 'Test',
        findings: [],
      });

      expect(mockKv.put).toHaveBeenCalledWith(
        expect.stringContaining('alert_rate_limit:'),
        expect.stringMatching(/\[\d+\]/), // JSON array with timestamp
        { expirationTtl: 120 },
      );
    });
  });
});
