import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AlertMessage, PagerDutyChannelConfig } from '../types.js';

describe('PagerDuty Channel', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  let message: AlertMessage;
  let config: PagerDutyChannelConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    message = {
      id: 'alert-123',
      severity: 'critical',
      title: 'Critical Security Alert',
      description: 'Multiple critical security findings detected',
      findings: [
        {
          checkId: 's3-public-acl',
          severity: 'critical',
          resourceId: 'bucket-data',
          resourceType: 's3-bucket',
          region: 'us-east-1',
          title: 'S3 Bucket Public ACL',
          description: 'Bucket has public read access',
          remediation: 'Disable public access',
        },
      ],
      timestamp: '2025-03-04T12:00:00Z',
      dashboardUrl: 'https://opensyber.cloud/alerts/alert-123',
      organization: 'Test Org',
      account: 'AWS Production',
    };

    config = {
      type: 'pagerduty',
      minSeverity: 'critical',
      isActive: true,
      integrationKey: 'R12345678901234567890123456789012',
    };
  });

  // Import the module dynamically
  let pagerdutyChannel: typeof import('./pagerduty.js').pagerdutyChannel;

  const loadModule = async () => {
    if (!pagerdutyChannel) {
      const module = await import('./pagerduty.js');
      pagerdutyChannel = module.pagerdutyChannel;
    }
    return pagerdutyChannel;
  };

  describe('send', () => {
    it('should trigger PagerDuty incident for critical severity', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pd-incident-123', dedup_key: 'alert-123' }), { status: 202 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('alert-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
    });

    it('should trigger PagerDuty incident for high severity', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pd-incident-456' }), { status: 202 }),
      );
      globalThis.fetch = mockFetch;

      const highMessage: AlertMessage = {
        ...message,
        severity: 'high',
      };

      const channel = await loadModule();
      const result = await channel.send(highMessage, config);

      expect(result.success).toBe(true);
    });

    it('should trigger incidents for all severities (filtering done by dispatcher)', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ dedup_key: 'alert-low' }), { status: 202 }),
      );
      globalThis.fetch = mockFetch;

      const lowMessage: AlertMessage = {
        ...message,
        severity: 'low',
      };

      const channel = await loadModule();
      const result = await channel.send(lowMessage, config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use EU endpoint when region is eu', async () => {
      const euConfig: PagerDutyChannelConfig = {
        ...config,
        region: 'eu',
      };

      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pd-eu-123' }), { status: 202 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, euConfig);

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('https://events.eu.pagerduty.com/v2/enqueue');
    });

    it('should return error when integration key missing', async () => {
      const invalidConfig: PagerDutyChannelConfig = {
        ...config,
        integrationKey: '',
      };
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PagerDuty integration key not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle PagerDuty API errors', async () => {
      const mockFetch = vi.fn(async () =>
        new Response('Invalid integration key', { status: 401 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PagerDuty API error');
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Network error');
      });
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send PagerDuty alert');
    });

    it('should use dedup key from alert ID', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pd-123' }), { status: 202 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, config);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(payload.dedup_key).toBe('opensyber-alert-123');
    });

    it('should include findings in custom details', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pd-123' }), { status: 202 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, config);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(payload.payload.custom_details.findings_count).toBe(1);
      expect(payload.payload.custom_details.findings).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should validate correct PagerDuty config', async () => {
      const channel = await loadModule();
      const result = channel.validate(config);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid integration key format', async () => {
      const channel = await loadModule();
      const invalidConfig: PagerDutyChannelConfig = {
        ...config,
        integrationKey: 'short',
      };

      const result = channel.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid integration key format');
    });

    it('should reject invalid region', async () => {
      const channel = await loadModule();
      const invalidConfig = {
        type: 'pagerduty' as const,
        minSeverity: 'high' as const,
        isActive: true,
        integrationKey: 'R12345678901234567890123456789012',
        region: 'invalid' as 'us' | 'eu',
      };

      const result = channel.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Region must be "us" or "eu"');
    });

    it('should reject wrong channel type', async () => {
      const channel = await loadModule();
      const wrongConfig = {
        type: 'slack' as const,
        minSeverity: 'high' as const,
        isActive: true,
        webhookUrl: 'https://hooks.slack.com/test',
      };

      const result = channel.validate(wrongConfig as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid channel type');
    });

    it('should require integration key', async () => {
      const channel = await loadModule();
      const emptyConfig: PagerDutyChannelConfig = {
        ...config,
        integrationKey: '',
      };

      const result = channel.validate(emptyConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Integration key is required');
    });
  });
});
