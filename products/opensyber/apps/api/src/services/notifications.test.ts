import { describe, it, expect, vi, afterEach } from 'vitest';
import { notificationService } from './notifications.js';
import { generateHmacSignature } from '../test/helpers.js';

const samplePayload = {
  title: 'SQL Injection Detected',
  message: 'A SQL injection attempt was blocked on instance db-prod-01.',
  severity: 'critical',
  instanceId: 'inst_abc123',
  alertId: 'alert_xyz789',
};

describe('Notification Service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── sendEmail ────────────────────────────────────────────────────────────

  describe('sendEmail', () => {
    it('sends email via Resend API with correct payload', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_001' }), { status: 200 }));

      await notificationService.sendEmail(
        { email: 'admin@example.com' },
        samplePayload,
        'resend-test-key',
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer resend-test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.from).toBe('OpenSyber Alerts <alerts@opensyber.cloud>');
      expect(body.to).toBe('admin@example.com');
      expect(body.subject).toBe('[CRITICAL] SQL Injection Detected');
      expect(body.html).toContain('Security Alert: SQL Injection Detected');
      expect(body.html).toContain('inst_abc123');
    });

    it('uppercases severity in subject line', async () => {
      globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 }));

      await notificationService.sendEmail(
        { email: 'user@test.com' },
        { ...samplePayload, severity: 'warning' },
        'key',
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('[WARNING] SQL Injection Detected');
    });

    it('includes dashboard link in HTML body', async () => {
      globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 }));

      await notificationService.sendEmail({ email: 'u@t.com' }, samplePayload, 'key');

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.html).toContain('https://opensyber.cloud/dashboard/security/alerts');
    });
  });

  // ── sendWebhook ──────────────────────────────────────────────────────────

  describe('sendWebhook', () => {
    it('sends POST with JSON payload to configured URL', async () => {
      globalThis.fetch = vi.fn(async () => new Response('OK', { status: 200 }));

      await notificationService.sendWebhook(
        { url: 'https://hooks.example.com/events' },
        samplePayload,
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://hooks.example.com/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(samplePayload),
        }),
      );
    });

    it('includes valid HMAC SHA-256 signature when secret is provided', async () => {
      globalThis.fetch = vi.fn(async () => new Response('OK', { status: 200 }));
      const secret = 'webhook-secret-42';

      await notificationService.sendWebhook(
        { url: 'https://hooks.example.com/events', secret },
        samplePayload,
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = call[1].headers as Record<string, string>;
      const body = call[1].body as string;

      // Verify signature is present and starts with sha256= prefix
      expect(headers['X-Signature-256']).toBeDefined();
      expect(headers['X-Signature-256']).toMatch(/^sha256=[0-9a-f]+$/);

      // Independently compute HMAC and compare
      const expectedHex = await generateHmacSignature(secret, body);
      expect(headers['X-Signature-256']).toBe(`sha256=${expectedHex}`);
    });

    it('does not include X-Signature-256 header when no secret is provided', async () => {
      globalThis.fetch = vi.fn(async () => new Response('OK', { status: 200 }));

      await notificationService.sendWebhook(
        { url: 'https://hooks.example.com/events' },
        samplePayload,
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = call[1].headers as Record<string, string>;
      expect(headers['X-Signature-256']).toBeUndefined();
    });
  });

  // ── sendSlack ────────────────────────────────────────────────────────────

  describe('sendSlack', () => {
    it('sends formatted message to Slack webhook URL', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));

      await notificationService.sendSlack(
        { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
        samplePayload,
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/xxx',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.text).toContain(':rotating_light:');
      expect(body.text).toContain('*SQL Injection Detected*');
      expect(body.text).toContain('inst_abc123');
    });

    it('uses warning emoji for warning severity', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));

      await notificationService.sendSlack(
        { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
        { ...samplePayload, severity: 'warning' },
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.text).toContain(':warning:');
    });

    it('falls back to bell emoji for unknown severity', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));

      await notificationService.sendSlack(
        { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
        { ...samplePayload, severity: 'low' },
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.text).toContain(':bell:');
    });
  });

  // ── notify (dispatcher) ──────────────────────────────────────────────────

  describe('notify', () => {
    const env = { RESEND_API_KEY: 'resend-test-key' };

    it('dispatches to sendEmail for email channel', async () => {
      globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 }));

      const config = JSON.stringify({ email: 'ops@example.com' });
      await notificationService.notify('email', config, samplePayload, env);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('dispatches to sendWebhook for webhook channel', async () => {
      globalThis.fetch = vi.fn(async () => new Response('OK', { status: 200 }));

      const config = JSON.stringify({ url: 'https://hooks.example.com/notify' });
      await notificationService.notify('webhook', config, samplePayload, env);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://hooks.example.com/notify',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('dispatches to sendSlack for slack channel', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));

      const config = JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/T/B/x' });
      await notificationService.notify('slack', config, samplePayload, env);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T/B/x',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('does not throw on unknown channel type', async () => {
      globalThis.fetch = vi.fn();

      await expect(
        notificationService.notify('sms', '{}', samplePayload, env),
      ).resolves.toBeUndefined();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('catches and logs error when config is invalid JSON', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        notificationService.notify('email', 'not-valid-json', samplePayload, env),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Notifications] Failed to send email notification:'),
        expect.any(SyntaxError),
      );

      consoleSpy.mockRestore();
    });

    it('catches and logs error when fetch rejects', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Network failure');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = JSON.stringify({ email: 'ops@example.com' });
      await expect(
        notificationService.notify('email', config, samplePayload, env),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Notifications] Failed to send email notification:'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
