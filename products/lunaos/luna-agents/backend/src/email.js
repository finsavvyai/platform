import config from './config.js';

export class EmailService {
  constructor(env) {
    this.sendgridApiKey = env.SENDGRID_API_KEY;
    this.fromEmail = env.EMAIL_FROM || config.email.from;
    this.supportEmail = env.EMAIL_SUPPORT || config.email.support;
  }

  /**
   * Send email using SendGrid
   */
  async sendEmail(options) {
    const { to, subject, html, text, from = this.fromEmail } = options;

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }],
            subject
          }],
          from: { email: from },
          content: [
            { type: 'text/plain', value: text || this.htmlToText(html) },
            { type: 'text/html', value: html }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid error: ${response.status} - ${error}`);
      }

      return { success: true, messageId: response.headers.get('x-message-id') };

    } catch (error) {
      console.error('Email send error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, apiKey, userTier = 'free') {
    const html = this.getWelcomeEmailTemplate(email, apiKey, userTier);
    const text = this.getWelcomeEmailText(email, apiKey, userTier);

    return await this.sendEmail({
      to: email,
      subject: '🌙 Welcome to Luna RAG Pro! Your Intelligent Code Search is Ready',
      html,
      text
    });
  }

  /**
   * Send trial expiration email
   */
  async sendTrialExpirationEmail(email, daysRemaining, apiKey) {
    const html = this.getTrialExpirationTemplate(email, daysRemaining);
    const text = this.getTrialExpirationText(email, daysRemaining);

    return await this.sendEmail({
      to: email,
      subject: `⏰ Your Luna RAG Pro trial ends in ${daysRemaining} days!`,
      html,
      text
    });
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccessEmail(email, subscriptionData) {
    const html = this.getPaymentSuccessTemplate(email, subscriptionData);
    const text = this.getPaymentSuccessText(email, subscriptionData);

    return await this.sendEmail({
      to: email,
      subject: '🎉 Payment Successful! Luna RAG Pro is Active',
      html,
      text
    });
  }

  /**
   * Send cancellation email
   */
  async sendCancellationEmail(email, cancellationDate) {
    const html = this.getCancellationTemplate(email, cancellationDate);
    const text = this.getCancellationText(email, cancellationDate);

    return await this.sendEmail({
      to: email,
      subject: 'Your Luna RAG subscription has been cancelled',
      html,
      text
    });
  }

  /**
   * Send usage report email
   */
  async sendUsageReportEmail(email, usageStats) {
    const html = this.getUsageReportTemplate(email, usageStats);
    const text = this.getUsageReportText(email, usageStats);

    return await this.sendEmail({
      to: email,
      subject: '📊 Your Luna RAG Usage Report',
      html,
      text
    });
  }

  /**
   * Send enterprise contact email
   */
  async sendEnterpriseContactEmail(contactData) {
    const html = this.getEnterpriseContactTemplate(contactData);
    const text = this.getEnterpriseContactText(contactData);

    return await this.sendEmail({
      to: this.supportEmail,
      subject: `🏢 Enterprise Inquiry from ${contactData.company}`,
      html,
      text
    });
  }

  /**
   * Welcome email template
   */
  getWelcomeEmailTemplate(email, apiKey, userTier = 'free') {
    const isPro = userTier !== 'free';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Luna RAG${isPro ? ' Pro' : ''}!</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 2.5rem; margin-bottom: 10px; }
          .title { font-size: 1.5rem; color: #333; margin-bottom: 20px; }
          .api-key { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 15px; margin: 20px 0; font-family: monospace; word-break: break-all; }
          .features { margin: 30px 0; }
          .feature { margin-bottom: 15px; padding-left: 20px; position: relative; }
          .feature::before { content: "✓"; position: absolute; left: 0; color: #28a745; font-weight: bold; }
          .cta { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; text-align: center; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🌙</div>
            <h1 class="title">Welcome to Luna RAG${isPro ? ' Pro' : ''}!</h1>
            <p>Your intelligent code search journey begins now</p>
          </div>

          ${isPro ? `
          <div>
            <h3>🎉 Your API Key</h3>
            <div class="api-key">${apiKey}</div>
          </div>
          ` : ''}

          <div class="features">
            <h3>${isPro ? '🚀 Your Pro Features' : '🎁 Your Free Features'}</h3>
            ${isPro ? `
              <div class="feature">Unlimited semantic searches - no daily limits!</div>
              <div class="feature">Unlimited file indexing for entire codebases</div>
              <div class="feature">Luna Vision RAG™ - analyze screenshots with code context</div>
              <div class="feature">GLM Vision - advanced visual AI testing</div>
              <div class="feature">Priority support (24hr response time)</div>
              <div class="feature">Advanced analytics dashboard</div>
            ` : `
              <div class="feature">100 semantic searches per day</div>
              <div class="feature">1,000 files indexed</div>
              <div class="feature">Basic semantic search</div>
              <div class="feature">Community support</div>
            `}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://agent.lunaos.ai/docs" class="cta">Get Started with Luna RAG</a>
          </div>

          <div class="footer">
            <p>Questions? Just reply to this email or visit our <a href="https://agent.lunaos.ai/support">support page</a></p>
            <p>Happy coding! The Luna Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Trial expiration template
   */
  getTrialExpirationTemplate(email, daysRemaining) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Luna RAG Pro Trial Expiration</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
          .upgrade-btn { background: #007bff; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; display: inline-block; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <h2>⏰ Your Luna RAG Pro Trial Ends Soon</h2>
        <p>Hi ${email},</p>
        <p>Your 14-day free trial of Luna RAG Pro will expire in <strong>${daysRemaining} days</strong>.</p>

        <h3>Don't lose access to:</h3>
        <ul>
          <li>🔍 Unlimited semantic searches</li>
          <li>🖼️ Luna Vision RAG™ screenshot analysis</li>
          <li>🧠 GLM Vision advanced testing</li>
          <li>📊 Advanced analytics dashboard</li>
          <li>🚀 Priority support</li>
        </ul>

        <p><strong>Ready to continue your intelligent code search journey?</strong></p>

        <div style="text-align: center; margin: 20px 0;">
          <a href="https://agent.lunaos.ai/upgrade" class="upgrade-btn">Upgrade Now & Continue Searching</a>
        </div>

        <p>Questions? Just reply to this email!</p>
        <p>Best regards,<br>The Luna Team</p>
      </body>
      </html>
    `;
  }

  /**
   * Payment success template
   */
  getPaymentSuccessTemplate(email, subscriptionData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Successful - Luna RAG Pro</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <h2>🎉 Payment Successful! Welcome to Luna RAG Pro</h2>
        <p>Hi ${email},</p>
        <p>Thank you for your subscription! Your Luna RAG Pro features are now active.</p>

        <h3>📋 Subscription Details</h3>
        <ul>
          <li><strong>Plan:</strong> Luna RAG Pro</li>
          <li><strong>Price:</strong> $29/month</li>
          <li><strong>Status:</strong> Active</li>
          <li><strong>Next Billing:</strong> ${new Date(subscriptionData.renewsAt).toLocaleDateString()}</li>
        </ul>

        <h3>🚀 Your Pro Features Are Ready:</h3>
        <ul>
          <li>✅ Unlimited searches (no limits!)</li>
          <li>✅ Luna Vision RAG™ for screenshot analysis</li>
          <li>✅ GLM Vision for advanced visual AI</li>
          <li>✅ Priority support (24hr response)</li>
          <li>✅ Advanced analytics dashboard</li>
        </ul>

        <div style="background: #28a745; color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p>💡 <strong>Tip:</strong> Just ask me "analyze this screenshot" to start using Vision RAG!</p>
        </div>

        <p>Need help getting started? Check out our <a href="https://agent.lunaos.ai/docs">documentation</a> or reply to this email.</p>
        <p>Happy coding with Luna RAG!</p>
        <p>The Luna Team</p>
      </body>
      </html>
    `;
  }

  /**
   * Cancellation template
   */
  getCancellationTemplate(email, cancellationDate) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Subscription Cancelled - Luna RAG</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <h2>Subscription Cancelled</h2>
        <p>Hi ${email},</p>
        <p>Your Luna RAG Pro subscription has been cancelled as of ${new Date(cancellationDate).toLocaleDateString()}.</p>

        <h3>What happens next:</h3>
        <ul>
          <li>✅ Your Pro features will remain active until the end of your current billing period</li>
          <li>📉 You'll be downgraded to the Free tier automatically</li>
          <li>🆓 You'll have 100 searches per day and 1,000 files indexed</li>
        </ul>

        <div style="background: #ffc107; color: #333; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>We're sorry to see you go!</strong></p>
          <p>Have feedback or questions about your experience? Just reply to this email - we'd love to hear from you.</p>
        </div>

        <p>Want to reactivate your subscription? You can restart anytime at <a href="https://agent.lunaos.ai/pricing">lunaos.ai/pricing</a>.</p>
        <p>Thank you for trying Luna RAG!</p>
        <p>The Luna Team</p>
      </body>
      </html>
    `;
  }

  /**
   * Usage report template
   */
  getUsageReportTemplate(email, usageStats) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Luna RAG Usage Report</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <h2>📊 Your Luna RAG Usage Report</h2>

        <h3>📈 Monthly Summary</h3>
        <ul>
          <li><strong>Searches:</strong> ${usageStats.monthly.searches}</li>
          <li><strong>Files Indexed:</strong> ${usageStats.monthly.filesIndexed}</li>
          <li><strong>Vision Analyses:</strong> ${usageStats.monthly.visionAnalyses}</li>
          <li><strong>GLM Analyses:</strong> ${usageStats.monthly.glmAnalyses}</li>
        </ul>

        <h3>🎯 Your Features</h3>
        <p>You currently have access to: <strong>${usageStats.features.join(', ')}</strong></p>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>💡 Pro Tip:</strong> Try combining searches: "How does authentication work?" followed by "Show me pattern implementations."</p>
        </div>

        <p>Keep exploring your codebase with Luna RAG!</p>
        <p>The Luna Team</p>
      </body>
      </html>
    `;
  }

  /**
   * Enterprise contact template
   */
  getEnterpriseContactTemplate(contactData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Enterprise Inquiry - Luna RAG</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <h2>🏢 New Enterprise Inquiry</h2>

        <h3>Contact Information</h3>
        <ul>
          <li><strong>Company:</strong> ${contactData.company}</li>
          <li><strong>Name:</strong> ${contactData.name}</li>
          <li><strong>Email:</strong> ${contactData.email}</li>
          <li><strong>Team Size:</strong> ${contactData.teamSize}</li>
        </ul>

        <h3>Message:</h3>
        <p>${contactData.message}</p>

        <p>This inquiry requires follow-up. Please contact the customer promptly.</p>

        <p>The Luna Team</p>
      </body>
      </html>
    `;
  }

  /**
   * Convert HTML to text (fallback)
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Text versions of templates
   */
  getWelcomeEmailText(email, apiKey, userTier = 'free') {
    const isPro = userTier !== 'free';
    return `
Welcome to Luna RAG${isPro ? ' Pro' : ''}!

Your intelligent code search journey begins now.

${isPro ? `Your API Key: ${apiKey}` : ''}

${isPro ? 'Your Pro Features:' : 'Your Free Features:'}
${isPro ? `
- Unlimited semantic searches - no daily limits!
- Unlimited file indexing for entire codebases
- Luna Vision RAG™ - analyze screenshots with code context
- GLM Vision - advanced visual AI testing
- Priority support (24hr response time)
- Advanced analytics dashboard
` : `
- 100 semantic searches per day
- 1,000 files indexed
- Basic semantic search
- Community support
`}

Get started: https://agent.lunaos.ai/docs

Questions? Just reply to this email.

Happy coding! The Luna Team
    `;
  }

  getTrialExpirationText(email, daysRemaining) {
    return `
Your Luna RAG Pro Trial Ends Soon

Hi ${email},

Your 14-day free trial of Luna RAG Pro will expire in ${daysRemaining} days.

Don't lose access to:
- Unlimited semantic searches
- Luna Vision RAG™ screenshot analysis
- GLM Vision advanced testing
- Advanced analytics dashboard
- Priority support

Ready to continue? https://agent.lunaos.ai/upgrade

Questions? Just reply to this email!

Best regards,
The Luna Team
    `;
  }

  getPaymentSuccessText(email, subscriptionData) {
    return `
Payment Successful! Welcome to Luna RAG Pro

Hi ${email},

Thank you for your subscription! Your Luna RAG Pro features are now active.

Subscription Details:
- Plan: Luna RAG Pro
- Price: $29/month
- Status: Active
- Next Billing: ${new Date(subscriptionData.renewsAt).toLocaleDateString()}

Your Pro Features Are Ready:
- Unlimited searches (no limits!)
- Luna Vision RAG™ for screenshot analysis
- GLM Vision for advanced visual AI
- Priority support (24hr response)
- Advanced analytics dashboard

Tip: Just ask me "analyze this screenshot" to start using Vision RAG!

Need help getting started? https://agent.lunaos.ai/docs

Happy coding with Luna RAG!
The Luna Team
    `;
  }

  getCancellationText(email, cancellationDate) {
    return `
Subscription Cancelled

Hi ${email},

Your Luna RAG Pro subscription has been cancelled as of ${new Date(cancellationDate).toLocaleDateString()}.

What happens next:
- Your Pro features will remain active until the end of your current billing period
- You'll be downgraded to the Free tier automatically
- You'll have 100 searches per day and 1,000 files indexed

We're sorry to see you go! Have feedback or questions about your experience? Just reply to this email - we'd love to hear from you.

Want to reactivate your subscription? https://agent.lunaos.ai/pricing

Thank you for trying Luna RAG!
The Luna Team
    `;
  }

  getUsageReportText(email, usageStats) {
    return `
Your Luna RAG Usage Report

Monthly Summary:
- Searches: ${usageStats.monthly.searches}
- Files Indexed: ${usageStats.monthly.filesIndexed}
- Vision Analyses: ${usageStats.monthly.visionAnalyses}
- GLM Analyses: ${usageStats.monthly.glmAnalyses}

Your Features: ${usageStats.features.join(', ')}

Pro Tip: Try combining searches: "How does authentication work?" followed by "Show me pattern implementations."

Keep exploring your codebase with Luna RAG!
The Luna Team
    `;
  }

  getEnterpriseContactText(contactData) {
    return `
New Enterprise Inquiry

Contact Information:
- Company: ${contactData.company}
- Name: ${contactData.name}
- Email: ${contactData.email}
- Team Size: ${contactData.teamSize}

Message:
${contactData.message}

This inquiry requires follow-up. Please contact the customer promptly.

The Luna Team
    `;
  }
}

export default EmailService;