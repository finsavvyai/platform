/**
 * Slack alert channel
 *
 * Sends security alerts via Slack incoming webhooks.
 */

import type {
  AlertChannel,
  AlertMessage,
  AlertResult,
  SlackChannelConfig,
} from '../types.js';
import { getSeverityColor, getSeverityEmoji } from '../types.js';

/**
 * Build Slack blocks payload for alert
 */
function buildSlackPayload(message: AlertMessage, config: SlackChannelConfig): string {
  const severityColor = getSeverityColor(message.severity);
  const severityEmoji = getSeverityEmoji(message.severity);

  // Build findings fields
  const findingFields = message.findings.slice(0, 5).map((f) => ({
    type: 'mrkdwn' as const,
    text: `${getSeverityEmoji(f.severity)} *${escapeSlack(f.title)}*\n_${f.resourceType}: ${escapeSlack(f.resourceId)}_`,
  }));

  if (message.findings.length > 5) {
    findingFields.push({
      type: 'mrkdwn' as const,
      text: `... and ${message.findings.length - 5} more`,
    });
  }

  const payload = {
    channel: config.channel,
    attachments: [
      {
        color: severityColor,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${severityEmoji} Security Alert`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Severity:*\n${message.severity.toUpperCase()}`,
              },
              {
                type: 'mrkdwn',
                text: `*Organization:*\n${message.organization || 'OpenSyber'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Account:*\n${message.account || 'N/A'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Time:*\n<!date^${Math.floor(new Date(message.timestamp).getTime() / 1000)}^{date_short_pretty} at {time}|${new Date(message.timestamp).toLocaleString()}>`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlack(message.title)}*\n${escapeSlack(message.description)}`,
            },
          },
          ...(message.findings.length > 0
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Affected Resources (${message.findings.length})*`,
                  },
                },
                {
                  type: 'section',
                  fields: findingFields,
                },
              ]
            : []),
          ...(message.dashboardUrl
            ? [
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: 'View in Dashboard',
                        emoji: true,
                      },
                      url: message.dashboardUrl,
                      style: 'primary',
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    ],
  };

  return JSON.stringify(payload);
}

/**
 * Escape special characters for Slack text
 */
function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Slack alert channel implementation
 */
export const slackChannel: AlertChannel = {
  async send(
    message: AlertMessage,
    config: SlackChannelConfig,
  ): Promise<AlertResult> {
    if (!config.webhookUrl) {
      return {
        success: false,
        error: 'Slack webhook URL not configured',
      };
    }

    try {
      const payload = buildSlackPayload(message, config);

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          error: `Slack webhook error: ${response.status} ${body}`,
        };
      }

      // Slack webhooks don't return an ID
      return {
        success: true,
        externalId: `slack-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send Slack alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  validate(config: SlackChannelConfig): { valid: boolean; error?: string } {
    if (config.type !== 'slack') {
      return { valid: false, error: 'Invalid channel type' };
    }

    if (!config.webhookUrl) {
      return { valid: false, error: 'Webhook URL is required' };
    }

    try {
      new URL(config.webhookUrl);
    } catch {
      return { valid: false, error: 'Invalid webhook URL' };
    }

    if (!config.webhookUrl.includes('hooks.slack.com')) {
      return { valid: false, error: 'Webhook URL must be from hooks.slack.com' };
    }

    return { valid: true };
  },
};
