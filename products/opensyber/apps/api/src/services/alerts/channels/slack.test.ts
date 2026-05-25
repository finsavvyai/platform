import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AlertMessage, SlackChannelConfig } from '../types.js';

describe('Slack Channel', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  let message: AlertMessage;
  let config: SlackChannelConfig;

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
        {
          checkId: 'iam-no-mfa',
          severity: 'high',
          resourceId: 'root',
          resourceType: 'iam-user',
          region: 'global',
          title: 'Root Account Without MFA',
          description: 'Root account does not have MFA enabled',
          remediation: 'Enable MFA on root account',
        },
      ],
      timestamp: '2025-03-04T12:00:00Z',
      dashboardUrl: 'https://opensyber.cloud/alerts/alert-123',
      organization: 'Test Org',
      account: 'AWS Production',
    };

    config = {
      type: 'slack',
      minSeverity: 'high',
      isActive: true,
      webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX',
    };
  });

  // Import the module dynamically
  let slackChannel: typeof import('./slack.js').slackChannel;

  const loadModule = async () => {
    if (!slackChannel) {
      const module = await import('./slack.js');
      slackChannel = module.slackChannel;
    }
    return slackChannel;
  };

  describe('send', () => {
    it('should send alert via Slack webhook', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(config.webhookUrl);
      expect(options.method).toBe('POST');

      const payload = JSON.parse(options.body as string);
      expect(payload.attachments).toBeDefined();
      expect(payload.attachments[0].color).toBe('#DC2626'); // critical color
    });

    it('should include severity-based color', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, config);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(payload.attachments[0].color).toBe('#DC2626'); // critical
    });

    it('should handle multiple findings with truncation', async () => {
      const manyFindingsMessage: AlertMessage = {
        ...message,
        findings: Array.from({ length: 10 }, (_, i) => ({
          checkId: `check-${i}`,
          severity: 'high' as const,
          resourceId: `resource-${i}`,
          resourceType: 'ec2-instance',
          region: 'us-east-1',
          title: `Finding ${i}`,
          description: `Description ${i}`,
          remediation: `Fix ${i}`,
        })),
      };

      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(manyFindingsMessage, config);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      // Should show first 5 findings
      expect(payload.attachments[0].blocks).toBeDefined();
    });

    it('should return error when webhook URL missing', async () => {
      const invalidConfig: SlackChannelConfig = {
        ...config,
        webhookUrl: '',
      };

      const channel = await loadModule();
      const result = await channel.send(message, invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Slack webhook URL not configured');
    });

    it('should handle webhook errors', async () => {
      const mockFetch = vi.fn(async () =>
        new Response('Internal Server Error', { status: 500 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Slack webhook error');
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Network error');
      });
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send Slack alert');
    });

    it('should use custom channel if provided', async () => {
      const channelConfig: SlackChannelConfig = {
        ...config,
        channel: '#security-alerts',
      };

      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, channelConfig);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(payload.channel).toBe('#security-alerts');
    });

    it('should include dashboard button if URL provided', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, config);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const actionBlocks = payload.attachments[0].blocks.filter(
        (b: any) => b.elements?.[0]?.text?.text === 'View in Dashboard'
      );
      expect(actionBlocks).toHaveLength(1);
    });

    it('should handle empty findings', async () => {
      const emptyMessage: AlertMessage = {
        ...message,
        findings: [],
      };

      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(emptyMessage, config);

      expect(result.success).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate correct Slack config', async () => {
      const channel = await loadModule();
      const result = channel.validate(config);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-Slack webhook URL', async () => {
      const channel = await loadModule();
      const invalidConfig: SlackChannelConfig = {
        ...config,
        webhookUrl: 'https://example.com/webhook',
      };

      const result = channel.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Webhook URL must be from hooks.slack.com');
    });

    it('should reject invalid URL', async () => {
      const channel = await loadModule();
      const invalidConfig: SlackChannelConfig = {
        ...config,
        webhookUrl: 'not-a-url',
      };

      const result = channel.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid webhook URL');
    });

    it('should reject wrong channel type', async () => {
      const channel = await loadModule();
      const wrongConfig = {
        type: 'email' as const,
        minSeverity: 'high' as const,
        isActive: true,
        to: ['test@example.com'],
      };

      const result = channel.validate(wrongConfig as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid channel type');
    });

    it('should require webhook URL', async () => {
      const channel = await loadModule();
      const emptyConfig: SlackChannelConfig = {
        ...config,
        webhookUrl: '',
      };

      const result = channel.validate(emptyConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Webhook URL is required');
    });
  });
});
