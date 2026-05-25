export interface EmailService {
  sendPaymentFailedEmail(opts: {
    to: string;
    userName: string | null;
    apiKey: string;
  }): Promise<void>;

  sendWelcomeEmail(opts: {
    to: string;
    userName: string | null;
    apiKey: string;
  }): Promise<void>;

  sendAgentDeployedEmail(opts: {
    to: string;
    userName: string | null;
    instanceName: string;
    apiKey: string;
  }): Promise<void>;

  sendFirstSecurityEventEmail(opts: {
    to: string;
    userName: string | null;
    apiKey: string;
  }): Promise<void>;

  sendTrialEndingEmail(opts: {
    to: string;
    userName: string | null;
    daysLeft: number;
    apiKey: string;
  }): Promise<void>;

  sendTrialExpiredEmail(opts: {
    to: string;
    userName: string | null;
    apiKey: string;
  }): Promise<void>;
}

export const emailService: EmailService = {
  async sendPaymentFailedEmail({ to, userName, apiKey }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: [to],
        subject: 'Payment failed — action required',
        html: `<p>Hi${userName ? ` ${userName}` : ''},</p>
<p>We were unable to process your most recent payment for your OpenSyber subscription.</p>
<p>Please update your payment method in your <a href="https://opensyber.cloud/dashboard/settings">account settings</a> to avoid service interruption.</p>
<p>If you need help, reply to this email.</p>
<p>— The OpenSyber Team</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[Email] Failed to send payment failed email:', await response.text());
    }
  },

  async sendWelcomeEmail({ to, userName, apiKey }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: [to],
        subject: 'Welcome to OpenSyber',
        html: `<p>Hi${userName ? ` ${userName}` : ''},</p>
<p>Welcome to OpenSyber! We're excited to have you on board.</p>
<p>You can deploy your first AI agent in just a few clicks. Head over to your dashboard to get started.</p>
<p><a href="https://opensyber.cloud/dashboard">Deploy Your Agent</a></p>
<p>If you have any questions, just reply to this email.</p>
<p>— The OpenSyber Team</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[Email] Failed to send welcome email:', await response.text());
    }
  },

  async sendAgentDeployedEmail({ to, userName, instanceName, apiKey }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: [to],
        subject: 'Your AI agent is live',
        html: `<p>Hi${userName ? ` ${userName}` : ''},</p>
<p>Great news — your AI agent <strong>${instanceName}</strong> has been deployed and is now running.</p>
<p>You can monitor its status, view security events, and manage configurations from your dashboard.</p>
<p><a href="https://opensyber.cloud/dashboard">View Dashboard</a></p>
<p>If you need help, reply to this email.</p>
<p>— The OpenSyber Team</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[Email] Failed to send agent deployed email:', await response.text());
    }
  },

  async sendFirstSecurityEventEmail({ to, userName, apiKey }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: [to],
        subject: 'Your first security event detected',
        html: `<p>Hi${userName ? ` ${userName}` : ''},</p>
<p>Your AI agent just flagged its first security event. OpenSyber is actively monitoring your infrastructure and keeping you informed.</p>
<p>Head over to your security dashboard to review the details and take action if needed.</p>
<p><a href="https://opensyber.cloud/dashboard/security">View Security Dashboard</a></p>
<p>If you have any questions, reply to this email.</p>
<p>— The OpenSyber Team</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[Email] Failed to send first security event email:', await response.text());
    }
  },

  async sendTrialEndingEmail({ to, userName, daysLeft, apiKey }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: [to],
        subject: `Your free trial ends in ${daysLeft} days`,
        html: `<p>Hi${userName ? ` ${userName}` : ''},</p>
<p>Just a heads-up — your OpenSyber free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.</p>
<p>To keep your AI agents running and maintain access to all security features, upgrade to a paid plan before your trial expires.</p>
<p><a href="https://opensyber.cloud/pricing">Upgrade Now</a></p>
<p>If you have any questions, reply to this email.</p>
<p>— The OpenSyber Team</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[Email] Failed to send trial ending email:', await response.text());
    }
  },

  async sendTrialExpiredEmail({ to, userName, apiKey }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OpenSyber <noreply@opensyber.cloud>',
        to: [to],
        subject: 'Your free trial has ended',
        html: `<p>Hi${userName ? ` ${userName}` : ''},</p>
<p>Your OpenSyber free trial has come to an end. Your AI agents have been paused and security monitoring is no longer active.</p>
<p>Choose a plan to restore your agents and pick up right where you left off.</p>
<p><a href="https://opensyber.cloud/pricing">Choose a Plan</a></p>
<p>If you need help, reply to this email.</p>
<p>— The OpenSyber Team</p>`,
      }),
    });

    if (!response.ok) {
      console.error('[Email] Failed to send trial expired email:', await response.text());
    }
  },
};
