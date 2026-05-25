import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AlertMessage, EmailChannelConfig } from '../types.js';

// Set up global env for Resend key before tests
(globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-resend-key';

describe('Email Channel', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  let message: AlertMessage;
  let config: EmailChannelConfig;

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
      type: 'email',
      minSeverity: 'high',
      isActive: true,
      to: ['security@example.com'],
    };
  });

  // Import the module dynamically
  let emailChannel: typeof import('./email.js').emailChannel;

  const loadModule = async () => {
    if (!emailChannel) {
      const module = await import('./email.js');
      emailChannel = module.emailChannel;
    }
    return emailChannel;
  };

  describe('send', () => {
    it('should send email via Resend API', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'resend-123' }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('resend-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.resend.com/emails');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string);
      expect(body.to).toEqual(['security@example.com']);
      expect(body.subject).toContain('Critical Security Alert');
      expect(body.html).toBeTruthy();
      expect(body.text).toBeTruthy();
    });

    it('should handle multiple recipients', async () => {
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'resend-456' }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const multiConfig: EmailChannelConfig = {
        ...config,
        to: ['admin@example.com', 'security@example.com', 'devops@example.com'],
      };

      const channel = await loadModule();
      const result = await channel.send(message, multiConfig);

      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.to).toHaveLength(3);
    });

    it('should return error when Resend API key is missing', async () => {
      delete (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Resend API key not configured');

      // Restore key for other tests
      (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-resend-key';
    });

    it('should return error when no recipients configured', async () => {
      (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
      const emptyConfig: EmailChannelConfig = {
        ...config,
        to: [],
      };

      const channel = await loadModule();
      const result = await channel.send(message, emptyConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No recipients configured');
    });

    it('should handle Resend API errors', async () => {
      (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
      const mockFetch = vi.fn(async () =>
        new Response('Invalid email address', { status: 400 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      const result = await channel.send(message, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Resend API error');
    });

    it('should use custom from address if provided', async () => {
      (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'resend-789' }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const customFromConfig: EmailChannelConfig = {
        ...config,
        from: 'alerts@custom.com',
      };

      const channel = await loadModule();
      await channel.send(message, customFromConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.from).toBe('alerts@custom.com');
    });

    it('should include severity emoji in subject', async () => {
      (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'resend-101' }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const channel = await loadModule();
      await channel.send(message, config);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.subject).toContain('🔴');
    });

    it('should handle empty findings list', async () => {
      (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
      const mockFetch = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'resend-202' }), { status: 200 }),
      );
      globalThis.fetch = mockFetch;

      const emptyMessage: AlertMessage = {
        ...message,
        findings: [],
      };

      const channel = await loadModule();
      const result = await channel.send(emptyMessage, config);

      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.html).not.toContain('Affected Resources');
    });
  });

  describe('validate', () => {
    it('should validate correct email config', async () => {
      const channel = await loadModule();
      const result = channel.validate(config);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid email addresses', async () => {
      const channel = await loadModule();
      const invalidConfig: EmailChannelConfig = {
        ...config,
        to: ['not-an-email', 'also-invalid'],
      };

      const result = channel.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid email address');
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

    it('should require at least one recipient', async () => {
      const channel = await loadModule();
      const emptyConfig: EmailChannelConfig = {
        ...config,
        to: [],
      };

      const result = channel.validate(emptyConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one recipient');
    });
  });
});
