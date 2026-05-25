/**
 * Email Templates — HTML/text templates for transactional emails
 */

const COMMON_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #0a0a0f; color: #e2e8f0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
  .header { text-align: center; margin-bottom: 32px; }
  .logo { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .card { background: #1a1a2e; border-radius: 12px; padding: 24px; margin: 16px 0; border: 1px solid #2d2d44; }
  .cta { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
  .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 40px; }
  h2 { color: #f1f5f9; } a { color: #818cf8; }`;

const HEADER_HTML = `<div class="header"><div class="logo">LunaOS</div><p style="color: #94a3b8;">AI-Powered Development Intelligence</p></div>`;
const FOOTER_HTML = `<div class="footer"><p>LunaOS - AI Development Intelligence<br><a href="https://lunaos.ai">lunaos.ai</a></p></div>`;

export function welcomeEmailHtml(name: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${COMMON_STYLES}
  .agent-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
  .agent { background: #252540; padding: 8px 12px; border-radius: 8px; font-size: 14px; }</style></head><body><div class="container">${HEADER_HTML}
  <h2>Welcome${name ? `, ${name}` : ''}!</h2>
  <p>You now have access to 6 free AI agents that can review your code, generate tests, write documentation, and more.</p>
  <div class="card"><strong>Your Free Agents:</strong><div class="agent-grid">
    <div class="agent">Code Review</div><div class="agent">Testing</div>
    <div class="agent">Documentation</div><div class="agent">Deployment</div>
    <div class="agent">Requirements</div><div class="agent">Architecture</div></div></div>
  <div class="card"><strong>Quick Start:</strong>
    <p style="font-family: monospace; background: #0f0f1a; padding: 12px; border-radius: 6px; font-size: 13px;">
      curl -X POST https://api.lunaos.ai/agents/execute \\<br>
      &nbsp;&nbsp;-H "Authorization: Bearer YOUR_TOKEN" \\<br>
      &nbsp;&nbsp;-d '{"agent":"code-review","context":"your code here"}'</p></div>
  <div style="text-align: center;"><a href="https://agents.lunaos.ai/dashboard" class="cta">Open Dashboard</a></div>
  <div class="card"><strong>Want more?</strong><p>Upgrade to <strong>Pro ($29/mo)</strong> to unlock all 28+ agents, 10,000 monthly executions, and priority LLM routing.</p>
    <a href="https://agents.lunaos.ai/pricing">View Plans</a></div>${FOOTER_HTML}</div></body></html>`;
}

export function welcomeEmailText(name: string): string {
    return `Welcome to LunaOS${name ? `, ${name}` : ''}!\n\nYou now have access to 6 free AI agents:\n- Code Review\n- Testing & Validation\n- Documentation\n- Deployment\n- Requirements Analysis\n- Architecture Design\n\nQuick Start:\ncurl -X POST https://api.lunaos.ai/agents/execute -H "Authorization: Bearer YOUR_TOKEN" -d '{"agent":"code-review","context":"your code"}'\n\nDashboard: https://agents.lunaos.ai/dashboard\nUpgrade to Pro: https://agents.lunaos.ai/pricing\n`;
}

export function upgradeEmailHtml(name: string, tierDisplay: string, agentCount: string, execLimit: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${COMMON_STYLES}
  .highlight { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 2px 8px; border-radius: 4px; color: white; font-weight: 600; }</style></head><body><div class="container">${HEADER_HTML}
  <h2>You're on <span class="highlight">${tierDisplay}</span>!</h2>
  <p>Thank you for upgrading${name ? `, ${name}` : ''}. You now have full access to the LunaOS AI agent fleet.</p>
  <div class="card"><strong>What's Unlocked:</strong><ul style="line-height: 1.8;">
    <li>${agentCount}</li><li>${execLimit} monthly executions</li>
    <li>Agent chains for multi-step workflows</li><li>API key access for CI/CD integration</li>
    <li>Advanced RAG-enhanced context</li></ul></div>
  <div style="text-align: center;"><a href="https://agents.lunaos.ai/dashboard" class="cta">Start Using Pro Agents</a></div>
  <div class="card"><strong>Manage Your Subscription:</strong>
    <p>View invoices, update payment method, or change your plan anytime from the <a href="https://agents.lunaos.ai/dashboard/billing">Billing Dashboard</a>.</p></div>
  ${FOOTER_HTML}</div></body></html>`;
}

export function upgradeEmailText(name: string, tierDisplay: string, agentCount: string, execLimit: string): string {
    return `You're now on ${tierDisplay}!\n\nThank you for upgrading${name ? `, ${name}` : ''}.\n\nWhat's Unlocked:\n- ${agentCount}\n- ${execLimit} monthly executions\n- Agent chains for multi-step workflows\n- API key access for CI/CD integration\n- Advanced RAG-enhanced context\n\nDashboard: https://agents.lunaos.ai/dashboard\nBilling: https://agents.lunaos.ai/dashboard/billing\n`;
}

export function usageWarningEmailHtml(name: string, pct: number, used: number, limit: number, tier: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${COMMON_STYLES}
  .bar-bg { background: #252540; border-radius: 8px; height: 24px; overflow: hidden; margin: 12px 0; }
  .bar-fill { background: linear-gradient(90deg, #6366f1, #f59e0b); height: 100%; border-radius: 8px; }</style></head><body><div class="container">
  <div class="header"><div class="logo">LunaOS</div></div>
  <h2>Usage Alert</h2>
  <p>Hey${name ? ` ${name}` : ''}, you've used <strong>${pct}%</strong> of your monthly executions.</p>
  <div class="card"><strong>${used} / ${limit} executions used</strong>
    <div class="bar-bg"><div class="bar-fill" style="width: ${Math.min(pct, 100)}%;"></div></div>
    <p style="font-size: 14px; color: #94a3b8;">Remaining: ${limit - used} executions</p></div>
  ${tier === 'free' ? `<div style="text-align: center;"><p>Upgrade to <strong>Pro ($29/mo)</strong> for 10,000 monthly executions.</p><a href="https://agents.lunaos.ai/pricing" class="cta">Upgrade Now</a></div>` : ''}
  ${FOOTER_HTML}</div></body></html>`;
}

export function usageWarningEmailText(pct: number, used: number, limit: number, tier: string): string {
    return `Usage Alert: ${pct}% of monthly executions used\n\n${used} / ${limit} executions used\nRemaining: ${limit - used}\n\n${tier === 'free' ? 'Upgrade to Pro ($29/mo) for 10,000 monthly executions: https://agents.lunaos.ai/pricing' : ''}\n`;
}

export function passwordResetEmailHtml(resetUrl: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${COMMON_STYLES}</style></head><body><div class="container">${HEADER_HTML}
  <h2>Reset Your Password</h2>
  <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 15 minutes.</p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="${resetUrl}" class="cta">Reset Password</a></div>
  <div class="card"><p style="font-size: 14px; color: #94a3b8;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p></div>
  ${FOOTER_HTML}</div></body></html>`;
}

export function passwordResetEmailText(resetUrl: string): string {
    return `Reset Your Password\n\nWe received a request to reset your password. Visit the link below to choose a new one (expires in 15 minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n`;
}
