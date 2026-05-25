/**
 * Slack Notifier Skill
 * Listens for agent security events and forwards them to Slack.
 */
const { parentPort } = require('node:worker_threads');

const webhookUrl = process.env.SLACK_WEBHOOK_URL;
if (!webhookUrl) {
  console.error('[slack-notifier] SLACK_WEBHOOK_URL not set');
  process.exit(1);
}

async function sendSlackMessage(text) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status}`);
  }
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type === 'security_event') {
      const emoji = msg.severity === 'critical' ? ':rotating_light:' : ':warning:';
      await sendSlackMessage(
        `${emoji} *${msg.eventType}* on instance \`${msg.instanceId}\`\n${msg.details || ''}`,
      ).catch((err) => console.error('[slack-notifier]', err.message));
    }
  });
}

console.log('[slack-notifier] Started — listening for events');
