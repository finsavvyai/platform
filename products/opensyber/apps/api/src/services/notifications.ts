import { sendPagerDuty, sendOpsGenie, sendTeams, sendDiscord } from './notification-providers.js';

interface NotificationPayload {
  title: string;
  message: string;
  severity: string;
  instanceId: string;
  alertId: string;
}

function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid webhook URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' ||
    hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.') ||
    hostname.endsWith('.local') || hostname === '[::1]' ||
    hostname === 'metadata.google.internal' || hostname === '169.254.169.254'
  ) {
    throw new Error('Webhook URL must not target private/internal addresses');
  }
}

export const notificationService = {
  async sendEmail(
    config: { email: string },
    payload: NotificationPayload,
    apiKey: string,
  ): Promise<void> {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OpenSyber Alerts <alerts@opensyber.cloud>',
        to: config.email,
        subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        html: `<h2>Security Alert: ${payload.title}</h2>
<p><strong>Severity:</strong> ${payload.severity}</p>
<p>${payload.message}</p>
<p><strong>Instance:</strong> ${payload.instanceId}</p>
<p><a href="https://opensyber.cloud/dashboard/security/alerts">View in Dashboard</a></p>`,
      }),
    });
  },

  async sendWebhook(
    config: { url: string; secret?: string },
    payload: NotificationPayload,
  ): Promise<void> {
    validateWebhookUrl(config.url);
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (config.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(config.secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      headers['X-Signature-256'] = `sha256=${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    }

    await fetch(config.url, { method: 'POST', headers, body });
  },

  async sendSlack(
    config: { webhookUrl: string },
    payload: NotificationPayload,
  ): Promise<void> {
    validateWebhookUrl(config.webhookUrl);
    const emoji: Record<string, string> = {
      critical: ':rotating_light:', warning: ':warning:', info: ':information_source:',
    };
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji[payload.severity] || ':bell:'} *${payload.title}*\n${payload.message}\nSeverity: ${payload.severity} | Instance: ${payload.instanceId}`,
      }),
    });
  },

  async notify(
    channelType: string,
    config: string,
    payload: NotificationPayload,
    env: { RESEND_API_KEY: string },
  ): Promise<void> {
    try {
      const parsed = JSON.parse(config);
      switch (channelType) {
        case 'email': await this.sendEmail(parsed, payload, env.RESEND_API_KEY); break;
        case 'webhook': await this.sendWebhook(parsed, payload); break;
        case 'slack': await this.sendSlack(parsed, payload); break;
        case 'pagerduty': await sendPagerDuty(parsed, payload); break;
        case 'opsgenie': await sendOpsGenie(parsed, payload); break;
        case 'teams': await sendTeams(parsed, payload); break;
        case 'discord': await sendDiscord(parsed, payload); break;
      }
    } catch (err) {
      console.error(`[Notifications] Failed to send ${channelType} notification:`, err);
    }
  },
};
