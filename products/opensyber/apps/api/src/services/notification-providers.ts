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

export async function sendPagerDuty(
  config: { routingKey: string },
  payload: NotificationPayload,
): Promise<void> {
  const severity: Record<string, string> = { critical: 'critical', warning: 'warning', info: 'info' };
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: config.routingKey,
      event_action: 'trigger',
      payload: {
        summary: `${payload.title}: ${payload.message}`,
        severity: severity[payload.severity] || 'warning',
        source: `opensyber-${payload.instanceId}`,
        component: 'security-monitoring',
        custom_details: { alertId: payload.alertId, instanceId: payload.instanceId },
      },
    }),
  });
}

export async function sendOpsGenie(
  config: { apiKey: string; team?: string },
  payload: NotificationPayload,
): Promise<void> {
  const body: Record<string, unknown> = {
    message: payload.title,
    description: payload.message,
    priority: payload.severity === 'critical' ? 'P1' : payload.severity === 'warning' ? 'P3' : 'P5',
    tags: ['opensyber', payload.severity],
    details: { instanceId: payload.instanceId, alertId: payload.alertId },
  };
  if (config.team) {
    body.responders = [{ type: 'team', name: config.team }];
  }
  await fetch('https://api.opsgenie.com/v2/alerts', {
    method: 'POST',
    headers: { 'Authorization': `GenieKey ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function sendTeams(
  config: { webhookUrl: string },
  payload: NotificationPayload,
): Promise<void> {
  validateWebhookUrl(config.webhookUrl);
  const color = payload.severity === 'critical' ? 'attention' : payload.severity === 'warning' ? 'warning' : 'good';
  await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard', version: '1.4',
          body: [
            { type: 'TextBlock', text: payload.title, weight: 'bolder', size: 'medium', color },
            { type: 'TextBlock', text: payload.message, wrap: true },
            { type: 'FactSet', facts: [
              { title: 'Severity', value: payload.severity },
              { title: 'Instance', value: payload.instanceId },
            ]},
          ],
        },
      }],
    }),
  });
}

export async function sendDiscord(
  config: { webhookUrl: string },
  payload: NotificationPayload,
): Promise<void> {
  validateWebhookUrl(config.webhookUrl);
  const colors: Record<string, number> = { critical: 0xff0000, warning: 0xffa500, info: 0x3498db };
  await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: payload.title,
        description: payload.message,
        color: colors[payload.severity] || 0x3498db,
        fields: [
          { name: 'Severity', value: payload.severity, inline: true },
          { name: 'Instance', value: payload.instanceId, inline: true },
        ],
        footer: { text: 'OpenSyber Security' },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}
