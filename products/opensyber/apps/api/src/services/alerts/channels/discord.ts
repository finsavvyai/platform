/**
 * Discord alert channel
 *
 * Sends security alerts via Discord webhooks with rich embeds.
 */

import type {
  AlertChannel,
  AlertMessage,
  AlertResult,
  DiscordChannelConfig,
} from '../types.js';
import { getSeverityColor, getSeverityEmoji } from '../types.js';

/**
 * Map severity to Discord color (decimal)
 */
function getDiscordColor(severity: string): number {
  const defaultColor = 0x6B7280; // gray
  const colors: Record<string, number> = {
    critical: 0xDC2626, // red
    high: 0xEA580C,     // orange
    medium: 0xCA8A04,   // yellow
    low: defaultColor,   // gray
  };
  return colors[severity as keyof typeof colors] ?? defaultColor;
}

/**
 * Build Discord webhook payload with embed
 */
function buildDiscordPayload(message: AlertMessage, config: DiscordChannelConfig): string {
  const color = getDiscordColor(message.severity);
  const severityEmoji = getSeverityEmoji(message.severity);

  // Build embed fields
  const fields = [
    {
      name: 'Severity',
      value: `${severityEmoji} ${message.severity.toUpperCase()}`,
      inline: true,
    },
    {
      name: 'Organization',
      value: message.organization || 'OpenSyber',
      inline: true,
    },
    {
      name: 'Account',
      value: message.account || 'N/A',
      inline: true,
    },
  ];

  // Add findings as fields (max 25 fields total in Discord)
  const findingsFields = message.findings.slice(0, 10).map((f) => ({
    name: `${getSeverityEmoji(f.severity)} ${escapeDiscord(f.title)}`,
    value: `${f.resourceType}: \`${f.resourceId}\``,
    inline: false,
  }));

  if (message.findings.length > 10) {
    findingsFields.push({
      name: 'Additional Findings',
      value: `... and ${message.findings.length - 10} more`,
      inline: false,
    });
  }

  const payload = {
    username: config.username || 'OpenSyber Security',
    avatar_url: config.avatarUrl || 'https://opensyber.cloud/icon.png',
    embeds: [
      {
        title: `${severityEmoji} Security Alert`,
        description: `**${escapeDiscord(message.title)}**\n\n${escapeDiscord(message.description)}`,
        color: color ?? 0x6B7280,
        fields: [...fields, ...findingsFields].slice(0, 25),
        timestamp: message.timestamp,
        footer: {
          text: 'OpenSyber Security Platform',
          icon_url: 'https://opensyber.cloud/icon.png',
        },
        ...(message.dashboardUrl
          ? {
              url: message.dashboardUrl,
            }
          : {}),
      },
    ],
  };

  return JSON.stringify(payload);
}

/**
 * Escape special characters for Discord
 */
function escapeDiscord(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/\|/g, '\\|');
}

/**
 * Discord alert channel implementation
 */
export const discordChannel: AlertChannel = {
  async send(
    message: AlertMessage,
    config: DiscordChannelConfig,
  ): Promise<AlertResult> {
    if (!config.webhookUrl) {
      return {
        success: false,
        error: 'Discord webhook URL not configured',
      };
    }

    try {
      const payload = buildDiscordPayload(message, config);

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      // Discord returns 204 NO CONTENT on success
      if (response.status !== 204) {
        const body = await response.text();
        return {
          success: false,
          error: `Discord webhook error: ${response.status} ${body}`,
        };
      }

      return {
        success: true,
        externalId: `discord-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send Discord alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  validate(config: DiscordChannelConfig): { valid: boolean; error?: string } {
    if (config.type !== 'discord') {
      return { valid: false, error: 'Invalid channel type' };
    }

    if (!config.webhookUrl) {
      return { valid: false, error: 'Webhook URL is required' };
    }

    try {
      const url = new URL(config.webhookUrl);
      if (!url.hostname.includes('discord.com') && !url.hostname.includes('discord.gg')) {
        return { valid: false, error: 'Webhook URL must be from discord.com' };
      }
    } catch {
      return { valid: false, error: 'Invalid webhook URL' };
    }

    if (config.username && config.username.length > 32) {
      return { valid: false, error: 'Username must be 32 characters or less' };
    }

    if (config.avatarUrl) {
      try {
        new URL(config.avatarUrl);
      } catch {
        return { valid: false, error: 'Invalid avatar URL' };
      }
    }

    return { valid: true };
  },
};
