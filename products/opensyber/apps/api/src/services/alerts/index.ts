/**
 * Alert channel providers
 *
 * Exports all alert channel implementations and utilities.
 */

export * from './types.js';
export * from './channels/email.js';
export * from './channels/slack.js';
export * from './channels/pagerduty.js';
export * from './channels/opsgenie.js';
export * from './channels/teams.js';
export * from './channels/discord.js';

import type { AlertChannel, AlertMessage, AlertResult, ChannelConfig } from './types.js';
import { emailChannel } from './channels/email.js';
import { slackChannel } from './channels/slack.js';
import { pagerdutyChannel } from './channels/pagerduty.js';
import { opsgenieChannel } from './channels/opsgenie.js';
import { teamsChannel } from './channels/teams.js';
import { discordChannel } from './channels/discord.js';

/**
 * Registry of all alert channel providers
 */
export const alertChannels: Record<string, AlertChannel> = {
  email: emailChannel,
  slack: slackChannel,
  pagerduty: pagerdutyChannel,
  opsgenie: opsgenieChannel,
  teams: teamsChannel,
  discord: discordChannel,
};

/**
 * Send alert to a specific channel
 */
export async function sendToChannel(
  message: AlertMessage,
  config: ChannelConfig,
): Promise<AlertResult> {
  const channel = alertChannels[config.type];
  if (!channel) {
    return {
      success: false,
      error: `Unknown channel type: ${config.type}`,
    };
  }

  return channel.send(message, config);
}

/**
 * Send alert to multiple channels
 *
 * Returns aggregated results with successes and failures.
 */
export async function sendToMultipleChannels(
  message: AlertMessage,
  configs: ChannelConfig[],
): Promise<Map<string, AlertResult>> {
  const results = new Map<string, AlertResult>();

  await Promise.all(
    configs.map(async (config) => {
      const result = await sendToChannel(message, config);
      results.set(config.type, result);
    }),
  );

  return results;
}

/**
 * Validate channel configuration
 */
export function validateChannelConfig(config: ChannelConfig): { valid: boolean; error?: string } {
  const channel = alertChannels[config.type];
  if (!channel) {
    return {
      valid: false,
      error: `Unknown channel type: ${config.type}`,
    };
  }

  return channel.validate(config);
}
