import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
}

export interface EmailTemplate {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicData?: Record<string, any>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string;
  }>;
}

export interface SendGridResponse {
  success: boolean;
  messageId?: string;
  errors?: string[];
}

/**
 * SendGrid Email Service for qestro Platform
 * Handles transactional emails, notifications, and marketing communications
 */
export class SendGridService {
  private config: SendGridConfig;
  private baseUrl = 'https://api.sendgrid.com/v3';

  constructor(config: SendGridConfig) {
    this.config = config;
  }

  /**
   * Send email using SendGrid API
   */
  async sendEmail(email: EmailTemplate): Promise<SendGridResponse> {
    try {
      const payload = this.buildEmailPayload(email);

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const messageId = response.headers.get('x-message-id');
        logger.info(`Email sent successfully to ${Array.isArray(email.to) ? email.to.join(', ') : email.to}`, { messageId });

        return { success: true, messageId };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errors = errorData.errors?.map((e: any) => e.message) || ['Unknown error'];

        logger.error('SendGrid API error:', { status: response.status, errors });
        return { success: false, errors };
      }
    } catch (error) {
      logger.error('Failed to send email:', error);
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  }

  /**
   * Send welcome email for new users
   */
  async sendWelcomeEmail(userEmail: string, userName?: string, customData?: Record<string, any>): Promise<SendGridResponse> {
    const email: EmailTemplate = {
      to: userEmail,
      subject: 'Welcome to qestro - Your AI-Powered Testing Platform! 🚀',
      templateId: 'd-welcome-template', // Replace with actual template ID
      dynamicData: {
        user_name: userName || userEmail.split('@')[0],
        login_url: 'https://qestro.app/login',
        support_email: 'support@qestro.io',
        ...customData
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(
    userEmail: string,
    planName: string,
    action: 'created' | 'updated' | 'cancelled' | 'expired',
    customData?: Record<string, any>
  ): Promise<SendGridResponse> {
    const subjects = {
      created: `Welcome to qestro ${planName}! 🎉`,
      updated: `Your qestro ${planName} plan has been updated`,
      cancelled: `Your qestro subscription has been cancelled`,
      expired: `Your qestro subscription has expired`
    };

    const templateIds = {
      created: 'd-subscription-created',
      updated: 'd-subscription-updated',
      cancelled: 'd-subscription-cancelled',
      expired: 'd-subscription-expired'
    };

    const email: EmailTemplate = {
      to: userEmail,
      subject: subjects[action],
      templateId: templateIds[action],
      dynamicData: {
        plan_name: planName,
        user_email: userEmail,
        dashboard_url: 'https://qestro.app',
        billing_url: 'https://qestro.app/billing',
        support_email: 'support@qestro.io',
        action,
        ...customData
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(userEmail: string, retryDate?: Date): Promise<SendGridResponse> {
    const email: EmailTemplate = {
      to: userEmail,
      subject: 'Payment Failed - Action Required for Your qestro Subscription',
      templateId: 'd-payment-failed',
      dynamicData: {
        user_email: userEmail,
        retry_date: retryDate?.toLocaleDateString(),
        billing_url: 'https://qestro.app/billing',
        support_email: 'support@qestro.io',
        update_payment_url: 'https://qestro.app/billing/payment-method'
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail: string, resetToken: string, userName?: string): Promise<SendGridResponse> {
    const resetUrl = `https://qestro.app/reset-password?token=${resetToken}`;

    const email: EmailTemplate = {
      to: userEmail,
      subject: 'Reset Your qestro Password',
      templateId: 'd-password-reset',
      dynamicData: {
        user_name: userName || userEmail.split('@')[0],
        reset_url: resetUrl,
        reset_token: resetToken,
        expiry_hours: 24,
        support_email: 'support@qestro.io'
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(userEmail: string, verificationToken: string, userName?: string): Promise<SendGridResponse> {
    const verificationUrl = `https://qestro.app/verify-email?token=${verificationToken}`;

    const email: EmailTemplate = {
      to: userEmail,
      subject: 'Verify Your qestro Email Address',
      templateId: 'd-email-verification',
      dynamicData: {
        user_name: userName || userEmail.split('@')[0],
        verification_url: verificationUrl,
        verification_token: verificationToken,
        expiry_hours: 24,
        support_email: 'support@qestro.io'
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send test completion report
   */
  async sendTestReportEmail(
    userEmail: string,
    projectName: string,
    testResults: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    }
  ): Promise<SendGridResponse> {
    const email: EmailTemplate = {
      to: userEmail,
      subject: `Test Report for ${projectName} - ${testResults.failed > 0 ? '❌ Tests Failed' : '✅ All Passed'}`,
      templateId: 'd-test-report',
      dynamicData: {
        user_email: userEmail,
        project_name: projectName,
        total_tests: testResults.total,
        passed_tests: testResults.passed,
        failed_tests: testResults.failed,
        success_rate: Math.round((testResults.passed / testResults.total) * 100),
        duration_seconds: Math.round(testResults.duration / 1000),
        dashboard_url: `https://qestro.app/projects/${encodeURIComponent(projectName)}`,
        report_date: new Date().toLocaleDateString()
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitationEmail(
    userEmail: string,
    inviterName: string,
    teamName: string,
    invitationToken: string
  ): Promise<SendGridResponse> {
    const invitationUrl = `https://qestro.app/invite?token=${invitationToken}`;

    const email: EmailTemplate = {
      to: userEmail,
      subject: `You're invited to join ${teamName} on qestro!`,
      templateId: 'd-team-invitation',
      dynamicData: {
        invitee_email: userEmail,
        inviter_name: inviterName,
        team_name: teamName,
        invitation_url: invitationUrl,
        invitation_token: invitationToken,
        expiry_days: 7,
        support_email: 'support@qestro.io'
      }
    };

    return this.sendEmail(email);
  }

  /**
   * Send marketing email (for subscribed users)
   */
  async sendMarketingEmail(
    userEmails: string[],
    campaignName: string,
    subject: string,
    content: { html?: string; text?: string }
  ): Promise<SendGridResponse> {
    const email: EmailTemplate = {
      to: userEmails,
      subject,
      ...content,
      // Add unsubscribe link for compliance
      html: content.html ? this.addUnsubscribeLink(content.html) : undefined,
      text: content.text ? this.addUnsubscribeLink(content.text) : undefined
    };

    return this.sendEmail(email);
  }

  /**
   * Build email payload for SendGrid API
   */
  private buildEmailPayload(email: EmailTemplate): any {
    const payload: any = {
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName,
      },
      subject: email.subject,
    };

    // Handle recipients
    if (Array.isArray(email.to)) {
      payload.personalizations = [{
        to: email.to.map(email => (typeof email === 'string' ? { email } : email))
      }];
    } else {
      payload.to = [{ email: email.to }];
    }

    // Add reply-to if specified
    if (this.config.replyToEmail) {
      payload.reply_to = { email: this.config.replyToEmail };
    }

    // Handle template vs content
    if (email.templateId) {
      payload.template_id = email.templateId;
      if (email.dynamicData) {
        payload.personalizations = [{
          ...(payload.personalizations || [{}]),
          dynamic_template_data: email.dynamicData
        }];
      }
    } else {
      payload.content = [];
      if (email.html) {
        payload.content.push({ type: 'text/html', value: email.html });
      }
      if (email.text) {
        payload.content.push({ type: 'text/plain', value: email.text });
      }
    }

    // Add attachments if any
    if (email.attachments && email.attachments.length > 0) {
      payload.attachments = email.attachments;
    }

    return payload;
  }

  /**
   * Add unsubscribe link for marketing emails
   */
  private addUnsubscribeLink(content: string): string {
    const unsubscribeLink = '\n\n---\n\nTo unsubscribe from these emails, click here: https://qestro.app/unsubscribe';
    return content + unsubscribeLink;
  }

  /**
   * Send email using fallback method (direct API call)
   */
  async sendEmailDirect(email: EmailTemplate): Promise<SendGridResponse> {
    try {
      const payload = {
        personalizations: [{
          to: Array.isArray(email.to) ? email.to.map(e => typeof e === 'string' ? { email: e } : e) : [{ email: email.to }],
          subject: email.subject,
          ...(email.dynamicData && { dynamic_template_data: email.dynamicData })
        }],
        from: { email: this.config.fromEmail, name: this.config.fromName },
        content: email.html ? [{ type: 'text/html', value: email.html }] : [],
        ...(email.templateId && { template_id: email.templateId }),
        ...(email.attachments && { attachments: email.attachments })
      };

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const messageId = response.headers.get('x-message-id');
        return { success: true, messageId };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errors = errorData.errors?.map((e: any) => e.message) || ['Unknown error'];
        return { success: false, errors };
      }
    } catch (error) {
      logger.error('Direct email send failed:', error);
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  }

  /**
   * Test email configuration
   */
  async testConfiguration(testEmail: string): Promise<SendGridResponse> {
    const email: EmailTemplate = {
      to: testEmail,
      subject: 'qestro Email Service Test ✅',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Email Service Test Successful!</h2>
          <p>This is a test email from the qestro platform to verify that email sending is working correctly.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Test Details:</h3>
            <ul>
              <li>Service: SendGrid</li>
              <li>Sent: ${new Date().toISOString()}</li>
              <li>To: ${testEmail}</li>
            </ul>
          </div>
          <p style="color: #6b7280;">If you received this email, the email service is configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af;">
            This is an automated test from qestro. No action is required.
          </p>
        </div>
      `,
      text: `
Email Service Test Successful!

This is a test email from the qestro platform to verify that email sending is working correctly.

Test Details:
- Service: SendGrid
- Sent: ${new Date().toISOString()}
- To: ${testEmail}

If you received this email, the email service is configured correctly.
      `
    };

    return this.sendEmail(email);
  }
}

// Create singleton instance
export const sendGridService = new SendGridService({
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@qestro.io',
  fromName: 'qestro',
  replyToEmail: process.env.SENDGRID_REPLY_TO_EMAIL || 'support@qestro.io'
});

export default SendGridService;