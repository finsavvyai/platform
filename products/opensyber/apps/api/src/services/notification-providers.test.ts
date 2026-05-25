import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendPagerDuty, sendOpsGenie, sendTeams, sendDiscord } from './notification-providers.js';

const mockPayload = {
  title: 'Test Alert',
  message: 'Something happened',
  severity: 'critical',
  instanceId: 'inst_1',
  alertId: 'alert_1',
};

describe('Notification Providers (Extended)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('PagerDuty', () => {
    it('sends event to PagerDuty Events API v2', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 202 }));
      await sendPagerDuty({ routingKey: 'R123' }, mockPayload);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
      const body = JSON.parse(opts.body);
      expect(body.routing_key).toBe('R123');
      expect(body.event_action).toBe('trigger');
      expect(body.payload.severity).toBe('critical');
    });

    it('maps warning severity correctly', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 202 }));
      await sendPagerDuty({ routingKey: 'R123' }, { ...mockPayload, severity: 'warning' });
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.payload.severity).toBe('warning');
    });
  });

  describe('OpsGenie', () => {
    it('sends alert to OpsGenie API', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 202 }));
      await sendOpsGenie({ apiKey: 'og-key-123' }, mockPayload);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe('https://api.opsgenie.com/v2/alerts');
      expect(opts.headers.Authorization).toBe('GenieKey og-key-123');
      const body = JSON.parse(opts.body);
      expect(body.message).toBe('Test Alert');
      expect(body.priority).toBe('P1');
    });

    it('includes team responder when specified', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 202 }));
      await sendOpsGenie({ apiKey: 'og-key', team: 'infra' }, mockPayload);
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.responders).toEqual([{ type: 'team', name: 'infra' }]);
    });

    it('maps warning severity to P3', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 202 }));
      await sendOpsGenie({ apiKey: 'k' }, { ...mockPayload, severity: 'warning' });
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.priority).toBe('P3');
    });
  });

  describe('Microsoft Teams', () => {
    it('sends Adaptive Card to Teams webhook', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));
      await sendTeams({ webhookUrl: 'https://outlook.office.com/webhook/x' }, mockPayload);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.type).toBe('message');
      expect(body.attachments[0].contentType).toContain('adaptive');
      expect(body.attachments[0].content.type).toBe('AdaptiveCard');
    });

    it('rejects private webhook URLs', async () => {
      await expect(
        sendTeams({ webhookUrl: 'https://localhost/hook' }, mockPayload),
      ).rejects.toThrow('private/internal');
    });
  });

  describe('Discord', () => {
    it('sends embed to Discord webhook', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));
      await sendDiscord({ webhookUrl: 'https://discord.com/api/webhooks/x' }, mockPayload);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toBe('Test Alert');
      expect(body.embeds[0].color).toBe(0xff0000); // critical = red
    });

    it('uses blue color for info severity', async () => {
      globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 }));
      await sendDiscord({ webhookUrl: 'https://discord.com/api/webhooks/x' }, { ...mockPayload, severity: 'info' });
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0x3498db);
    });

    it('rejects private webhook URLs', async () => {
      await expect(
        sendDiscord({ webhookUrl: 'https://192.168.1.1/hook' }, mockPayload),
      ).rejects.toThrow('private/internal');
    });
  });
});
