/**
 * Microsoft Teams alert channel
 *
 * Sends security alerts via Teams incoming webhooks with Adaptive Cards.
 */

import type {
  AlertChannel,
  AlertMessage,
  AlertResult,
  TeamsChannelConfig,
} from '../types.js';
import { buildTeamsPayload } from './teams-card.js';

/**
 * Microsoft Teams alert channel implementation
 */
export const teamsChannel: AlertChannel = {
  async send(
    message: AlertMessage,
    config: TeamsChannelConfig,
  ): Promise<AlertResult> {
    if (!config.webhookUrl) {
      return {
        success: false,
        error: 'Teams webhook URL not configured',
      };
    }

    try {
      const payload = buildTeamsPayload(message);

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
          error: `Teams webhook error: ${response.status} ${body}`,
        };
      }

      return {
        success: true,
        externalId: `teams-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send Teams alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  validate(config: TeamsChannelConfig): { valid: boolean; error?: string } {
    if (config.type !== 'teams') {
      return { valid: false, error: 'Invalid channel type' };
    }

    if (!config.webhookUrl) {
      return { valid: false, error: 'Webhook URL is required' };
    }

    try {
      const url = new URL(config.webhookUrl);
      if (!url.hostname.includes('office.com') && !url.hostname.includes('outlook.office.com')) {
        return { valid: false, error: 'Webhook URL must be from office.com domain' };
      }
    } catch {
      return { valid: false, error: 'Invalid webhook URL' };
    }

    return { valid: true };
  },
};
