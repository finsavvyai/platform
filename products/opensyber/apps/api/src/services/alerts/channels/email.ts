/**
 * Email alert channel
 *
 * Sends security alerts via email using Resend API.
 */

import type {
  AlertChannel,
  AlertMessage,
  AlertResult,
  EmailChannelConfig,
} from '../types.js';
import { getSeverityEmoji } from '../types.js';
import { buildEmailHtml, buildEmailText } from './email-template.js';

const RESEND_API = 'https://api.resend.com/emails';

/**
 * Email alert channel implementation
 */
export const emailChannel: AlertChannel = {
  async send(
    message: AlertMessage,
    config: EmailChannelConfig,
  ): Promise<AlertResult> {
    const resendKey = (globalThis as typeof globalThis & { RESEND_API_KEY?: string }).RESEND_API_KEY;
    if (resendKey === undefined) {
      return {
        success: false,
        error: 'Resend API key not configured',
      };
    }

    if (config.to.length === 0) {
      return {
        success: false,
        error: 'No recipients configured',
      };
    }

    try {
      const from = config.from || 'security@opensyber.cloud';
      const subject = `${getSeverityEmoji(message.severity)} ${message.title}`;

      const response = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: config.to,
          subject,
          html: buildEmailHtml(message),
          text: buildEmailText(message),
          tags: [
            { name: 'category', value: 'security_alert' },
            { name: 'severity', value: message.severity },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          error: `Resend API error: ${response.status} ${body}`,
        };
      }

      const data = await response.json() as { id: string };

      return {
        success: true,
        externalId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  validate(config: EmailChannelConfig): { valid: boolean; error?: string } {
    if (config.type !== 'email') {
      return { valid: false, error: 'Invalid channel type' };
    }

    if (!config.to || config.to.length === 0) {
      return { valid: false, error: 'At least one recipient email is required' };
    }

    for (const email of config.to) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { valid: false, error: `Invalid email address: ${email}` };
      }
    }

    return { valid: true };
  },
};
