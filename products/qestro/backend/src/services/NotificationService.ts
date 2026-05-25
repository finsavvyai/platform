import nodemailer from 'nodemailer';
import twilio from 'twilio';
import axios from 'axios';

export interface EmailNotification {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  priority?: 'high' | 'normal' | 'low';
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
}

export interface SMSNotification {
  to: string | string[];
  message: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface SlackNotification {
  channel: string;
  message: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  mentionChannel?: boolean;
  attachments?: any[];
  blocks?: any[];
}

export interface WebhookNotification {
  url: string;
  payload: any;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT' | 'PATCH';
  retryAttempts?: number;
}

export interface VoiceCallNotification {
  to: string;
  message: string;
  voice?: 'male' | 'female';
  language?: string;
  speed?: number;
}

export interface PushNotification {
  deviceTokens: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
  sound?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'slack' | 'push';
  subject?: string;
  content: string;
  variables: string[];
  createdAt: Date;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'voice' | 'push';
  config: any;
  enabled: boolean;
  testMode?: boolean;
  rateLimiting?: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
}

export interface NotificationLog {
  id: string;
  channelId: string;
  type: string;
  recipient: string;
  subject?: string;
  message: string;
  status: 'sent' | 'failed' | 'pending' | 'retry';
  attempt: number;
  sentAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private emailTransporter: any;
  private twilioClient: any;
  private channels = new Map<string, NotificationChannel>();
  private rateLimitCounters = new Map<string, { minute: number; hour: number; day: number; lastReset: Date }>();

  constructor() {
    this.initializeEmailTransporter();
    this.initializeTwilioClient();
    this.initializeChannels();
  }

  async sendEmail(notification: EmailNotification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email service not configured');
      }

      const recipients = Array.isArray(notification.to) ? notification.to : [notification.to];
      
      // Validate email addresses
      for (const email of recipients) {
        if (!this.isValidEmail(email)) {
          throw new Error(`Invalid email address: ${email}`);
        }
      }

      const mailOptions = {
        from: {
          name: process.env.FROM_NAME || 'Questro AI Testing',
          address: process.env.FROM_EMAIL || 'noreply@questro.io'
        },
        to: recipients.join(', '),
        subject: notification.subject,
        html: notification.html,
        text: notification.text || this.htmlToText(notification.html),
        priority: notification.priority || 'normal',
        attachments: notification.attachments,
        headers: {
          'X-Mailer': 'Questro AI Testing Platform',
          'X-Priority': notification.priority === 'high' ? '1' : '3'
        }
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      
      // Log notification
      await this.logNotification({
        channelId: 'email',
        type: 'email',
        recipient: recipients.join(', '),
        subject: notification.subject,
        message: notification.html,
        status: 'sent',
        attempt: 1,
        sentAt: new Date(),
        metadata: { messageId: info.messageId }
      });

      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error) {
      console.error('Email sending failed:', error);
      
      // Log failed notification
      await this.logNotification({
        channelId: 'email',
        type: 'email',
        recipient: Array.isArray(notification.to) ? notification.to.join(', ') : notification.to,
        subject: notification.subject,
        message: notification.html,
        status: 'failed',
        attempt: 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendSMS(notification: SMSNotification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.twilioClient) {
        throw new Error('SMS service not configured');
      }

      const recipients = Array.isArray(notification.to) ? notification.to : [notification.to];
      const results = [];

      for (const phoneNumber of recipients) {
        try {
          // Validate and format phone number
          const formattedNumber = this.formatPhoneNumber(phoneNumber);
          
          const message = await this.twilioClient.messages.create({
            body: notification.message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedNumber,
            statusCallback: `${process.env.BACKEND_URL}/api/notifications/sms/status`
          });

          results.push({
            success: true,
            messageId: message.sid,
            recipient: formattedNumber
          });

          // Log notification
          await this.logNotification({
            channelId: 'sms',
            type: 'sms',
            recipient: formattedNumber,
            message: notification.message,
            status: 'sent',
            attempt: 1,
            sentAt: new Date(),
            metadata: { messageId: message.sid }
          });

        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            recipient: phoneNumber
          });

          // Log failed notification
          await this.logNotification({
            channelId: 'sms',
            type: 'sms',
            recipient: phoneNumber,
            message: notification.message,
            status: 'failed',
            attempt: 1,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const allSuccessful = results.every(r => r.success);
      
      return {
        success: allSuccessful,
        messageId: results.filter(r => r.success).map(r => r.messageId).join(', '),
        error: allSuccessful ? undefined : results.filter(r => !r.success).map(r => r.error).join('; ')
      };

    } catch (error) {
      console.error('SMS sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendSlack(notification: SlackNotification): Promise<{ success: boolean; messageTs?: string; error?: string }> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Slack webhook URL not configured');
      }

      const urgencyColors = {
        low: '#36A64F',      // Green
        medium: '#FF9500',   // Orange  
        high: '#FF0000',     // Red
        critical: '#8B0000'  // Dark Red
      };

      const urgencyEmojis = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        critical: '🚨'
      };

      const payload: any = {
        channel: notification.channel,
        username: 'Questro AI Testing',
        icon_emoji: ':robot_face:',
        text: notification.mentionChannel ? `<!channel> ${notification.message}` : notification.message
      };

      // Add rich formatting for alerts
      if (notification.urgency) {
        payload.attachments = [{
          color: urgencyColors[notification.urgency],
          fields: [
            {
              title: `${urgencyEmojis[notification.urgency]} ${notification.urgency.toUpperCase()} Alert`,
              value: notification.message,
              short: false
            }
          ],
          footer: 'Questro AI Testing Platform',
          ts: Math.floor(Date.now() / 1000)
        }];
      }

      // Add custom attachments if provided
      if (notification.attachments) {
        payload.attachments = [...(payload.attachments || []), ...notification.attachments];
      }

      // Add custom blocks if provided (for rich Slack formatting)
      if (notification.blocks) {
        payload.blocks = notification.blocks;
      }

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        // Log notification
        await this.logNotification({
          channelId: 'slack',
          type: 'slack',
          recipient: notification.channel,
          message: notification.message,
          status: 'sent',
          attempt: 1,
          sentAt: new Date(),
          metadata: { urgency: notification.urgency }
        });

        return {
          success: true,
          messageTs: response.data?.ts
        };
      } else {
        throw new Error(`Slack API returned status ${response.status}`);
      }

    } catch (error) {
      console.error('Slack notification failed:', error);
      
      // Log failed notification
      await this.logNotification({
        channelId: 'slack',
        type: 'slack',
        recipient: notification.channel,
        message: notification.message,
        status: 'failed',
        attempt: 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendWebhook(notification: WebhookNotification): Promise<{ success: boolean; response?: any; error?: string }> {
    const maxRetries = notification.retryAttempts || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios({
          method: notification.method || 'POST',
          url: notification.url,
          data: notification.payload,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Questro-AI-Testing/1.0',
            ...notification.headers
          },
          timeout: 15000,
          validateStatus: (status) => status >= 200 && status < 300
        });

        // Log successful notification
        await this.logNotification({
          channelId: 'webhook',
          type: 'webhook',
          recipient: notification.url,
          message: JSON.stringify(notification.payload),
          status: 'sent',
          attempt,
          sentAt: new Date(),
          metadata: { statusCode: response.status, responseData: response.data }
        });

        return {
          success: true,
          response: response.data
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Webhook attempt ${attempt} failed:`, lastError);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Log failed notification after all retries
    await this.logNotification({
      channelId: 'webhook',
      type: 'webhook',
      recipient: notification.url,
      message: JSON.stringify(notification.payload),
      status: 'failed',
      attempt: maxRetries,
      error: lastError?.message || 'Unknown error'
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error'
    };
  }

  async makeVoiceCall(notification: VoiceCallNotification): Promise<{ success: boolean; callId?: string; error?: string }> {
    try {
      if (!this.twilioClient) {
        throw new Error('Voice service not configured');
      }

      // Create TwiML for the voice message
      const twiml = `
        <Response>
          <Say voice="${notification.voice || 'alice'}" language="${notification.language || 'en'}" rate="${notification.speed || 1}">
            ${notification.message}
          </Say>
          <Say voice="${notification.voice || 'alice'}" language="${notification.language || 'en'}" rate="${notification.speed || 1}">
            This message will repeat once more.
          </Say>
          <Say voice="${notification.voice || 'alice'}" language="${notification.language || 'en'}" rate="${notification.speed || 1}">
            ${notification.message}
          </Say>
        </Response>
      `;

      const call = await this.twilioClient.calls.create({
        twiml,
        to: this.formatPhoneNumber(notification.to),
        from: process.env.TWILIO_PHONE_NUMBER,
        statusCallback: `${process.env.BACKEND_URL}/api/notifications/voice/status`,
        statusCallbackMethod: 'POST'
      });

      // Log notification
      await this.logNotification({
        channelId: 'voice',
        type: 'voice',
        recipient: notification.to,
        message: notification.message,
        status: 'sent',
        attempt: 1,
        sentAt: new Date(),
        metadata: { callId: call.sid }
      });

      return {
        success: true,
        callId: call.sid
      };

    } catch (error) {
      console.error('Voice call failed:', error);
      
      // Log failed notification
      await this.logNotification({
        channelId: 'voice',
        type: 'voice',
        recipient: notification.to,
        message: notification.message,
        status: 'failed',
        attempt: 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendPushNotification(notification: PushNotification): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      // This would integrate with Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNs)
      // For now, we'll implement a basic structure
      
      const results = [];
      
      for (const deviceToken of notification.deviceTokens) {
        try {
          // Send to FCM/APNs
          const result = await this.sendToFCM({
            to: deviceToken,
            notification: {
              title: notification.title,
              body: notification.body,
              sound: notification.sound || 'default'
            },
            data: notification.data,
            priority: notification.priority || 'normal'
          });
          
          results.push({ success: true, deviceToken, messageId: result.messageId });
          
        } catch (error) {
          results.push({ 
            success: false, 
            deviceToken, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // Log notification
      await this.logNotification({
        channelId: 'push',
        type: 'push',
        recipient: `${notification.deviceTokens.length} devices`,
        message: `${notification.title}: ${notification.body}`,
        status: results.every(r => r.success) ? 'sent' : 'failed',
        attempt: 1,
        sentAt: new Date(),
        metadata: { deviceCount: notification.deviceTokens.length, successCount: results.filter(r => r.success).length }
      });

      return {
        success: results.every(r => r.success),
        results
      };

    } catch (error) {
      console.error('Push notification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testNotificationChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    try {
      const testMessage = `Test notification from Questro AI Testing Platform - ${new Date().toLocaleString()}`;

      switch (channel.type) {
        case 'email':
          return await this.sendEmail({
            to: channel.config.testEmail || channel.config.recipients[0],
            subject: 'Questro Test Notification',
            html: `<p>${testMessage}</p>`
          });

        case 'sms':
          return await this.sendSMS({
            to: channel.config.testPhone || channel.config.phoneNumbers[0],
            message: testMessage
          });

        case 'slack':
          return await this.sendSlack({
            channel: channel.config.testChannel || channel.config.channel,
            message: testMessage,
            urgency: 'low'
          });

        case 'webhook':
          return await this.sendWebhook({
            url: channel.config.url,
            payload: {
              type: 'test',
              message: testMessage,
              timestamp: new Date().toISOString()
            },
            headers: channel.config.headers
          });

        case 'voice':
          return await this.makeVoiceCall({
            to: channel.config.testPhone || channel.config.phoneNumber,
            message: 'This is a test call from Questro AI Testing Platform. Your voice notifications are working correctly.'
          });

        default:
          return { success: false, error: 'Unsupported channel type' };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getNotificationLogs(filters?: {
    channelId?: string;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<NotificationLog[]> {
    // Implement database query to fetch notification logs
    return [];
  }

  async getNotificationStats(timeframe: 'hour' | 'day' | 'week' | 'month'): Promise<{
    total: number;
    sent: number;
    failed: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
  }> {
    // Implement database aggregation query
    return {
      total: 0,
      sent: 0,
      failed: 0,
      byType: {},
      byChannel: {}
    };
  }

  private initializeEmailTransporter(): void {
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('Email service not configured - missing SMTP settings');
        return;
      }

      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      this.emailTransporter.verify((error: any, success: any) => {
        if (error) {
          console.error('Email service verification failed:', error);
        } else {
          console.log('Email service ready');
        }
      });

    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  private initializeTwilioClient(): void {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.warn('SMS/Voice service not configured - missing Twilio settings');
        return;
      }

      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      console.log('Twilio service ready');

    } catch (error) {
      console.error('Failed to initialize Twilio service:', error);
    }
  }

  private initializeChannels(): void {
    // Load notification channels from database
    // This is a placeholder implementation
    console.log('Notification channels initialized');
  }

  private async sendToFCM(payload: any): Promise<{ messageId: string }> {
    // Implement Firebase Cloud Messaging integration
    // This is a placeholder
    return { messageId: 'fcm_' + Date.now() };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing
    if (digits.length === 10) {
      return '+1' + digits; // Assume US/Canada
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return '+' + digits;
    } else if (digits.startsWith('1')) {
      return '+' + digits;
    } else {
      return '+' + digits;
    }
  }

  private htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private async logNotification(log: Omit<NotificationLog, 'id'>): Promise<void> {
    const logEntry: NotificationLog = {
      id: this.generateId(),
      ...log
    };

    // Store in database
    console.log('Logging notification:', logEntry.type, logEntry.status);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}