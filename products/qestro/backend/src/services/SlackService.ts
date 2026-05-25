import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
  username?: string;
  icon_emoji?: string;
}

export interface SlackNotification {
  webhookUrl: string;
  message: SlackMessage;
  channel?: string;
}

export class SlackService {
  async testConnection(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessage = {
        text: 'Test connection from Questro',
        channel: '#general'
      };

      const response = await axios.post(webhookUrl, testMessage, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000
      });

      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendMessage(notification: SlackNotification): Promise<boolean> {
    try {
      const response = await axios.post(notification.webhookUrl, notification.message, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        logger.info('Slack message sent successfully');
        return true;
      } else {
        logger.error(`Slack message failed with status: ${response.status}`);
        return false;
      }
    } catch (error) {
      logger.error('Failed to send Slack message:', error);
      return false;
    }
  }

  async sendTestResultNotification(
    webhookUrl: string,
    testName: string,
    status: 'passed' | 'failed',
    details: {
      duration?: number;
      errors?: string[];
      url?: string;
    }
  ): Promise<boolean> {
    const emoji = status === 'passed' ? ':white_check_mark:' : ':x:';
    const color = status === 'passed' ? 'good' : 'danger';
    
    const message = {
      channel: '#general',
      text: `${emoji} Test Result: ${testName}`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Test Name',
              value: testName,
              short: true
            },
            {
              title: 'Status',
              value: status.toUpperCase(),
              short: true
            },
            {
              title: 'Duration',
              value: details.duration ? `${details.duration}ms` : 'N/A',
              short: true
            },
            {
              title: 'URL',
              value: details.url || 'N/A',
              short: true
            }
          ],
          footer: 'Questro Test Automation',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    if (details.errors && details.errors.length > 0) {
      message.attachments[0].fields.push({
        title: 'Errors',
        value: details.errors.join('\n'),
        short: false
      });
    }

    return this.sendMessage({
      webhookUrl,
      message
    });
  }
}

export const slackService = new SlackService();
