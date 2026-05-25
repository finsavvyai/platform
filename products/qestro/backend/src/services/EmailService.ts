import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Email provider interfaces (from autoboot pattern)
interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  from?: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
  response?: any;
}

interface BulkEmailResult {
  totalRecipients: number;
  successful: number;
  failed: number;
  results: EmailResult[];
}

interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailResult>;
  verify?(): Promise<boolean>;
}

// SendGrid Provider (from autoboot pattern)
class SendGridProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private client: any;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    try {
      // Dynamic import to avoid dependency issues
      this.client = require('@sendgrid/mail');
      this.client.setApiKey(apiKey);
    } catch (error) {
      logger.warn('SendGrid library not available, using fallback HTTP method');
    }
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      if (this.client) {
        // Use SendGrid library if available
        const msg = {
          to: message.to,
          from: message.from || process.env.FROM_EMAIL || 'noreply@qestro.io',
          subject: message.subject,
          text: message.text,
          html: message.html,
          templateId: message.templateId,
          dynamicTemplateData: message.templateData,
          replyTo: message.replyTo,
        };

        const [response] = await this.client.send(msg);
        return {
          success: true,
          provider: this.name,
          messageId: response.headers['x-message-id'],
          response: response
        };
      } else {
        // Fallback HTTP method
        return this.sendViaHTTP(message);
      }
    } catch (error) {
      logger.error('SendGrid send failed:', error);
      return {
        success: false,
        provider: this.name,
        error: error.message
      };
    }
  }

  private async sendViaHTTP(message: EmailMessage): Promise<EmailResult> {
    const fetch = (await import('node-fetch')).default;

    const payload: any = {
      personalizations: [{
        to: [{ email: message.to }],
        subject: message.subject,
        ...(message.templateData && { dynamic_template_data: message.templateData })
      }],
      from: { email: message.from || process.env.FROM_EMAIL || 'noreply@qestro.io' },
      content: []
    };

    if (message.templateId) {
      payload.template_id = message.templateId;
    } else {
      if (message.text) payload.content.push({ type: 'text/plain', value: message.text });
      if (message.html) payload.content.push({ type: 'text/html', value: message.html });
    }

    if (message.replyTo) {
      payload.reply_to = { email: message.replyTo };
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return {
        success: true,
        provider: this.name,
        messageId: response.headers.get('x-message-id')
      };
    } else {
      const error = await response.text();
      return {
        success: false,
        provider: this.name,
        error: `SendGrid API error: ${error}`
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      logger.error('SendGrid verification failed:', error);
      return false;
    }
  }
}

// Resend Provider (from autoboot pattern)
class ResendProvider implements EmailProvider {
  name = 'resend';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const fetch = (await import('node-fetch')).default;

      const payload: any = {
        from: message.from || process.env.FROM_EMAIL || 'noreply@qestro.io',
        to: [message.to],
        subject: message.subject,
      };

      if (message.html) payload.html = message.html;
      if (message.text) payload.text = message.text;
      if (message.replyTo) payload.replyTo = message.replyTo;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          provider: this.name,
          messageId: data.id,
          response: data
        };
      } else {
        return {
          success: false,
          provider: this.name,
          error: data.message || 'Resend API error'
        };
      }
    } catch (error) {
      logger.error('Resend send failed:', error);
      return {
        success: false,
        provider: this.name,
        error: error.message
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch('https://api.resend.com/domains', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      logger.error('Resend verification failed:', error);
      return false;
    }
  }
}

// Mailgun Provider (from autoboot pattern)
class MailgunProvider implements EmailProvider {
  name = 'mailgun';
  private apiKey: string;
  private domain: string;

  constructor(apiKey: string, domain: string) {
    this.apiKey = apiKey;
    this.domain = domain;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const fetch = (await import('node-fetch')).default;

      const formData = new URLSearchParams();
      formData.append('from', message.from || process.env.FROM_EMAIL || `noreply@${this.domain}`);
      formData.append('to', message.to);
      formData.append('subject', message.subject);
      if (message.html) formData.append('html', message.html);
      if (message.text) formData.append('text', message.text);
      if (message.replyTo) formData.append('h:Reply-To', message.replyTo);

      const auth = Buffer.from(`api:${this.apiKey}`).toString('base64');

      const response = await fetch(`https://api.mailgun.net/v3/${this.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          provider: this.name,
          messageId: data.id,
          response: data
        };
      } else {
        return {
          success: false,
          provider: this.name,
          error: data.message || 'Mailgun API error'
        };
      }
    } catch (error) {
      logger.error('Mailgun send failed:', error);
      return {
        success: false,
        provider: this.name,
        error: error.message
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const fetch = (await import('node-fetch')).default;
      const auth = Buffer.from(`api:${this.apiKey}`).toString('base64');
      const response = await fetch(`https://api.mailgun.net/v3/${this.domain}/stats`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      return response.ok;
    } catch (error) {
      logger.error('Mailgun verification failed:', error);
      return false;
    }
  }
}

// SMTP Provider (fallback)
class SMTPProvider implements EmailProvider {
  name = 'smtp';
  private transporter: nodemailer.Transporter;

  constructor(config: any) {
    this.transporter = nodemailer.createTransport(config);
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: message.from || process.env.FROM_EMAIL || 'noreply@qestro.io',
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      };

      const result = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        provider: this.name,
        messageId: result.messageId,
        response: result
      };
    } catch (error) {
      logger.error('SMTP send failed:', error);
      return {
        success: false,
        provider: this.name,
        error: error.message
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('SMTP verification failed:', error);
      return false;
    }
  }
}

// Main Email Service with multi-provider fallbacks (from autoboot pattern)
class EmailService {
  private providers: EmailProvider[] = [];
  private primaryProviderIndex = 0;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize SendGrid if API key is available
    if (process.env.SENDGRID_API_KEY) {
      this.providers.push(new SendGridProvider(process.env.SENDGRID_API_KEY));
      logger.info('SendGrid provider initialized');
    }

    // Initialize Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      this.providers.push(new ResendProvider(process.env.RESEND_API_KEY));
      logger.info('Resend provider initialized');
    }

    // Initialize Mailgun if credentials are available
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      this.providers.push(new MailgunProvider(process.env.MAILGUN_API_KEY, process.env.MAILGUN_DOMAIN));
      logger.info('Mailgun provider initialized');
    }

    // Initialize SMTP as fallback
    if (process.env.SMTP_HOST) {
      const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        } : undefined,
      };
      this.providers.push(new SMTPProvider(smtpConfig));
      logger.info('SMTP provider initialized');
    }

    if (this.providers.length === 0) {
      logger.warn('No email providers configured. Email service will not work.');
    } else {
      logger.info(`Email service initialized with ${this.providers.length} providers`);
    }
  }

  /**
   * Send email with automatic provider fallbacks (from autoboot pattern)
   */
  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    if (this.providers.length === 0) {
      return {
        success: false,
        error: 'No email providers configured'
      };
    }

    let lastError: Error | null = null;

    // Try each provider in order
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];

      try {
        const result = await provider.send(message);

        if (result.success) {
          logger.info(`Email sent successfully via ${provider.name}`, {
            to: message.to,
            subject: message.subject,
            messageId: result.messageId
          });
          return result;
        } else {
          lastError = new Error(result.error);
          logger.warn(`Provider ${provider.name} failed:`, { error: result.error });
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Provider ${provider.name} threw error:`, error);
      }
    }

    // All providers failed
    logger.error('All email providers failed', {
      to: message.to,
      subject: message.subject,
      lastError: lastError?.message
    });

    return {
      success: false,
      error: `All providers failed. Last error: ${lastError?.message}`
    };
  }

  /**
   * Send bulk emails (from autoboot pattern)
   */
  async sendBulkEmail(message: Omit<EmailMessage, 'to'>, recipients: string[]): Promise<BulkEmailResult> {
    const results: EmailResult[] = [];

    for (const recipient of recipients) {
      const result = await this.sendEmail({
        ...message,
        to: recipient
      });
      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      totalRecipients: recipients.length,
      successful,
      failed,
      results: results.filter(r => !r.success) // Only return failed results for brevity
    };
  }

  /**
   * Send welcome email (from autoboot pattern)
   */
  async sendWelcomeEmail(email: string, name: string, plan: string): Promise<EmailResult> {
    const templateData = {
      customerName: name,
      planName: this.getPlanDisplayName(plan),
      planDescription: this.getPlanDescription(plan),
      loginUrl: `${process.env.FRONTEND_URL}/login`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@qestro.io',
      companyName: 'qestro',
      productUrl: process.env.FRONTEND_URL || 'https://qestro.io'
    };

    // Try template first, fallback to HTML
    const result = await this.sendEmail({
      to: email,
      templateId: this.getTemplateId('welcome'),
      templateData,
      subject: `Welcome to qestro ${this.getPlanDisplayName(plan)}!`,
      html: this.generateWelcomeHTML(templateData),
      from: process.env.FROM_EMAIL || 'noreply@qestro.io'
    });

    return result;
  }

  /**
   * Send payment confirmation email (from autoboot pattern)
   */
  async sendPaymentConfirmationEmail(
    email: string,
    name: string,
    plan: string,
    orderId: string,
    amount: number,
    currency: string = 'USD'
  ): Promise<EmailResult> {
    const templateData = {
      customerName: name,
      planName: this.getPlanDisplayName(plan),
      planDescription: this.getPlanDescription(plan),
      orderId,
      amount: this.formatCurrency(amount, currency),
      currency,
      orderDate: new Date().toLocaleDateString(),
      billingUrl: `${process.env.FRONTEND_URL}/billing`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@qestro.io',
      companyName: 'qestro'
    };

    return this.sendEmail({
      to: email,
      templateId: this.getTemplateId('payment_confirmation'),
      templateData,
      subject: `Payment Confirmation - qestro ${this.getPlanDisplayName(plan)}`,
      html: this.generatePaymentConfirmationHTML(templateData),
      from: process.env.FROM_EMAIL || 'billing@qestro.io'
    });
  }

  /**
   * Send subscription cancelled email (from autoboot pattern)
   */
  async sendSubscriptionCancelledEmail(
    email: string,
    name: string,
    plan: string,
    effectiveDate: Date
  ): Promise<EmailResult> {
    const templateData = {
      customerName: name,
      planName: this.getPlanDisplayName(plan),
      planDescription: this.getPlanDescription(plan),
      effectiveDate: effectiveDate.toLocaleDateString(),
      reactivationUrl: `${process.env.FRONTEND_URL}/billing?reactivate=true`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@qestro.io',
      companyName: 'qestro'
    };

    return this.sendEmail({
      to: email,
      templateId: this.getTemplateId('subscription_cancelled'),
      templateData,
      subject: `Subscription Cancelled - qestro`,
      html: this.generateSubscriptionCancelledHTML(templateData),
      from: process.env.FROM_EMAIL || 'noreply@qestro.io'
    });
  }

  /**
   * Send trial ending reminder (from autoboot pattern)
   */
  async sendTrialEndingReminder(
    email: string,
    name: string,
    plan: string,
    daysRemaining: number
  ): Promise<EmailResult> {
    const templateData = {
      customerName: name,
      planName: this.getPlanDisplayName(plan),
      planDescription: this.getPlanDescription(plan),
      daysRemaining,
      trialEndDate: new Date(Date.now() + (daysRemaining * 24 * 60 * 60 * 1000)).toLocaleDateString(),
      upgradeUrl: `${process.env.FRONTEND_URL}/billing?upgrade=true`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@qestro.io',
      companyName: 'qestro'
    };

    return this.sendEmail({
      to: email,
      templateId: this.getTemplateId('trial_ending'),
      templateData,
      subject: `Your qestro Trial Ends in ${daysRemaining} Days`,
      html: this.generateTrialEndingHTML(templateData),
      from: process.env.FROM_EMAIL || 'noreply@qestro.io'
    });
  }

  /**
   * Send payment failed email (from autoboot pattern)
   */
  async sendPaymentFailedEmail(
    email: string,
    name: string,
    plan: string,
    amount: number,
    retryDate: Date
  ): Promise<EmailResult> {
    const templateData = {
      customerName: name,
      planName: this.getPlanDisplayName(plan),
      planDescription: this.getPlanDescription(plan),
      amount: this.formatCurrency(amount),
      retryDate: retryDate.toLocaleDateString(),
      updatePaymentUrl: `${process.env.FRONTEND_URL}/billing?update=true`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@qestro.io',
      companyName: 'qestro'
    };

    return this.sendEmail({
      to: email,
      templateId: this.getTemplateId('payment_failed'),
      templateData,
      subject: `Payment Failed - Action Required for qestro`,
      html: this.generatePaymentFailedHTML(templateData),
      from: process.env.BILLING_EMAIL || 'billing@qestro.io'
    });
  }

  /**
   * Get plan display name (from autoboot pattern)
   */
  private getPlanDisplayName(plan: string): string {
    const planNames: Record<string, string> = {
      'qs-qestro-free': 'Free',
      'qs-qestro-professional-monthly': 'Professional',
      'qs-qestro-enterprise-monthly': 'Enterprise',
      'professional': 'Professional',
      'enterprise': 'Enterprise',
      'free': 'Free'
    };
    return planNames[plan] || plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  /**
   * Get plan description (from autoboot pattern)
   */
  private getPlanDescription(plan: string): string {
    const descriptions: Record<string, string> = {
      'qs-qestro-free': 'Perfect for individuals and small projects',
      'qs-qestro-professional-monthly': 'Advanced features for growing teams',
      'qs-qestro-enterprise-monthly': 'Complete solution for large organizations',
      'professional': 'Advanced features for growing teams',
      'enterprise': 'Complete solution for large organizations',
      'free': 'Perfect for getting started with test automation'
    };
    return descriptions[plan] || 'Flexible test automation solution';
  }

  /**
   * Get template ID (from autoboot pattern)
   */
  private getTemplateId(templateName: string): string {
    const templateIds: Record<string, string> = {
      welcome: process.env.SENDGRID_TEMPLATE_WELCOME || 'd-welcome-template',
      payment_confirmation: process.env.SENDGRID_TEMPLATE_PAYMENT || 'd-payment-template',
      subscription_cancelled: process.env.SENDGRID_TEMPLATE_CANCELLED || 'd-cancelled-template',
      trial_ending: process.env.SENDGRID_TEMPLATE_TRIAL || 'd-trial-template',
      payment_failed: process.env.SENDGRID_TEMPLATE_FAILED || 'd-failed-template'
    };
    return templateIds[templateName] || templateName;
  }

  /**
   * Format currency (from autoboot pattern)
   */
  private formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount / 100); // Convert from cents to dollars
  }

  /**
   * Generate welcome email HTML (from autoboot pattern)
   */
  private generateWelcomeHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; font-size: 32px; margin: 0;">qestro</h1>
          <p style="color: #6B7280; font-size: 16px;">AI-Powered Test Automation Platform</p>
        </div>

        <h2 style="color: #1F2937;">Welcome aboard, ${data.customerName}! 🚀</h2>

        <p>Thank you for joining qestro! You've just taken the first step towards revolutionizing your testing workflow with our AI-powered automation platform.</p>

        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1F2937; margin-top: 0;">Your ${data.planName} plan includes:</h3>
          <p style="color: #4B5563; margin: 10px 0;">${data.planDescription}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.loginUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Get Started</a>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 14px;">
            Need help? Our team is here for you:<br>
            📧 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a><br>
            📚 <a href="${data.productUrl}/docs">Documentation</a>
          </p>
        </div>

        <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 30px;">
          © 2024 ${data.companyName}. All rights reserved.
        </p>
      </div>
    `;
  }

  /**
   * Generate payment confirmation HTML (from autoboot pattern)
   */
  private generatePaymentConfirmationHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; font-size: 32px; margin: 0;">qestro</h1>
          <p style="color: #6B7280; font-size: 16px;">Payment Confirmation</p>
        </div>

        <h2 style="color: #1F2937;">Thank you, ${data.customerName}! ✅</h2>

        <p>Your payment has been successfully processed. Here are your details:</p>

        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1F2937; margin-top: 0;">Order Details</h3>
          <p style="color: #4B5563; margin: 5px 0;"><strong>Plan:</strong> ${data.planName}</p>
          <p style="color: #4B5563; margin: 5px 0;"><strong>Amount:</strong> ${data.amount}</p>
          <p style="color: #4B5563; margin: 5px 0;"><strong>Order ID:</strong> ${data.orderId}</p>
          <p style="color: #4B5563; margin: 5px 0;"><strong>Date:</strong> ${data.orderDate}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.billingUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Manage Billing</a>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 14px;">
            Questions? Contact our support team:<br>
            📧 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>
          </p>
        </div>

        <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 30px;">
          © 2024 ${data.companyName}. All rights reserved.
        </p>
      </div>
    `;
  }

  /**
   * Generate subscription cancelled HTML (from autoboot pattern)
   */
  private generateSubscriptionCancelledHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; font-size: 32px; margin: 0;">qestro</h1>
          <p style="color: #6B7280; font-size: 16px;">Subscription Cancellation</p>
        </div>

        <h2 style="color: #1F2937;">We're sorry to see you go, ${data.customerName}</h2>

        <p>Your subscription has been cancelled. Your access to the ${data.planName} plan will end on <strong>${data.effectiveDate}</strong>.</p>

        <div style="background: #FEF3CD; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p style="color: #92400E; margin: 0;">
            <strong>Change your mind?</strong><br>
            You can reactivate your subscription anytime before ${data.effectiveDate}.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.reactivationUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reactivate Subscription</a>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 14px;">
            We'd love to hear your feedback! Let us know how we can improve:<br>
            📧 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>
          </p>
        </div>

        <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 30px;">
          © 2024 ${data.companyName}. All rights reserved.
        </p>
      </div>
    `;
  }

  /**
   * Generate trial ending HTML (from autoboot pattern)
   */
  private generateTrialEndingHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; font-size: 32px; margin: 0;">qestro</h1>
          <p style="color: #6B7280; font-size: 16px;">Trial Ending Soon</p>
        </div>

        <h2 style="color: #1F2937;">Your trial ends in ${data.daysRemaining} days, ${data.customerName} ⏰</h2>

        <p>Your qestro ${data.planName} trial will end on <strong>${data.trialEndDate}</strong>. Don't lose access to your automated testing workflows!</p>

        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1F2937; margin-top: 0;">Why upgrade to ${data.planName}?</h3>
          <p style="color: #4B5563; margin: 10px 0;">${data.planDescription}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.upgradeUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Upgrade Now</a>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 14px;">
            Questions about billing or features?<br>
            📧 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>
          </p>
        </div>

        <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 30px;">
          © 2024 ${data.companyName}. All rights reserved.
        </p>
      </div>
    `;
  }

  /**
   * Generate payment failed HTML (from autoboot pattern)
   */
  private generatePaymentFailedHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #DC2626; font-size: 32px; margin: 0;">⚠️</h1>
          <p style="color: #6B7280; font-size: 16px;">Payment Failed</p>
        </div>

        <h2 style="color: #1F2937;">Action Required: Update Payment Method</h2>

        <p>Hi ${data.customerName},</p>

        <p>We were unable to process your payment of <strong>${data.amount}</strong> for your qestro ${data.planName} subscription.</p>

        <div style="background: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
          <p style="color: #991B1B; margin: 0;">
            <strong>What happens next?</strong><br>
            We'll automatically retry the payment on ${data.retryDate}. If it fails again, your subscription may be suspended.
          </p>
        </div>

        <p>To avoid any interruption in service, please update your payment method:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.updatePaymentUrl}" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Update Payment Method</a>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 14px;">
            Need help with payment or have questions?<br>
            📧 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>
          </p>
        </div>

        <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 30px;">
          © 2024 ${data.companyName}. All rights reserved.
        </p>
      </div>
    `;
  }

  /**
   * Verify all configured providers
   */
  async verifyAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const provider of this.providers) {
      try {
        if (provider.verify) {
          results[provider.name] = await provider.verify();
        } else {
          results[provider.name] = true; // Assume working if no verify method
        }
      } catch (error) {
        results[provider.name] = false;
      }
    }

    return results;
  }
}

// Export singleton instance
export const emailService = new EmailService();
export const sendEmail = (message: EmailMessage) => emailService.sendEmail(message);
export default emailService;