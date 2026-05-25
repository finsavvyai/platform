import { describe, it, expect, vi, afterEach } from 'vitest';
import { emailService } from './email.js';

describe('Email Service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends email via Resend API', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));

      await emailService.sendPaymentFailedEmail({
        to: 'user@example.com',
        userName: 'John',
        apiKey: 'resend-test-key',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer resend-test-key',
          }),
        }),
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.to).toEqual(['user@example.com']);
      expect(body.subject).toContain('Payment failed');
      expect(body.html).toContain('John');
    });

    it('sends email without name', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_456' }), { status: 200 }));

      await emailService.sendPaymentFailedEmail({
        to: 'user@example.com',
        userName: null,
        apiKey: 'resend-test-key',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.html).toContain('Hi,');
      expect(body.html).not.toContain('Hi null');
    });

    it('does not throw on API error', async () => {
      globalThis.fetch = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        emailService.sendPaymentFailedEmail({
          to: 'user@example.com',
          userName: 'John',
          apiKey: 'bad-key',
        }),
      ).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Email] Failed to send payment failed email:',
        'Unauthorized',
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('sends welcome email with correct subject', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_w1' }), { status: 200 }));

      await emailService.sendWelcomeEmail({
        to: 'new@example.com',
        userName: 'Alice',
        apiKey: 'resend-test-key',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('Welcome to OpenSyber');
      expect(body.html).toContain('Alice');
      expect(body.html).toContain('Deploy Your Agent');
    });
  });

  describe('sendAgentDeployedEmail', () => {
    it('sends agent deployed email with instance name', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_d1' }), { status: 200 }));

      await emailService.sendAgentDeployedEmail({
        to: 'user@example.com',
        userName: 'Bob',
        instanceName: 'Production Agent',
        apiKey: 'resend-test-key',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('Your AI agent is live');
      expect(body.html).toContain('Production Agent');
    });
  });

  describe('sendFirstSecurityEventEmail', () => {
    it('sends first security event email', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_s1' }), { status: 200 }));

      await emailService.sendFirstSecurityEventEmail({
        to: 'user@example.com',
        userName: 'Carol',
        apiKey: 'resend-test-key',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('Your first security event detected');
      expect(body.html).toContain('View Security Dashboard');
    });
  });

  describe('sendTrialEndingEmail', () => {
    it('sends trial ending email with days left', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_t1' }), { status: 200 }));

      await emailService.sendTrialEndingEmail({
        to: 'user@example.com',
        userName: 'Dave',
        daysLeft: 2,
        apiKey: 'resend-test-key',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toContain('2 days');
      expect(body.html).toContain('Upgrade Now');
    });
  });

  describe('sendTrialExpiredEmail', () => {
    it('sends trial expired email', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'email_te1' }), { status: 200 }));

      await emailService.sendTrialExpiredEmail({
        to: 'user@example.com',
        userName: 'Eve',
        apiKey: 'resend-test-key',
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('Your free trial has ended');
      expect(body.html).toContain('Choose a Plan');
    });
  });
});
