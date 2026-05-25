/**
 * Email Service — Resend integration for transactional emails
 *
 * Uses Resend's REST API (no SDK) for Cloudflare Worker compatibility.
 * Templates: welcome email, upgrade receipt, usage warning.
 */

import {
    welcomeEmailHtml, welcomeEmailText,
    upgradeEmailHtml, upgradeEmailText,
    usageWarningEmailHtml, usageWarningEmailText,
    passwordResetEmailHtml, passwordResetEmailText,
} from './email-templates';

const RESEND_API = 'https://api.resend.com';
const FROM_EMAIL = 'LunaOS <noreply@lunaos.ai>';

// ─── Resend API Client ───────────────────────────────────────────────────────

async function sendEmail(
    apiKey: string,
    params: { to: string; subject: string; html: string; text?: string },
): Promise<{ id: string } | null> {
    try {
        const res = await fetch(`${RESEND_API}/emails`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: params.to,
                subject: params.subject,
                html: params.html,
                text: params.text,
            }),
        });

        if (!res.ok) {
            console.error(`Resend error: ${res.status}`);
            return null;
        }

        return await res.json() as { id: string };
    } catch (err: any) {
        console.error('Email send error:', err.message);
        return null;
    }
}

// ─── Welcome Email ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
    apiKey: string,
    params: { email: string; name: string },
): Promise<void> {
    await sendEmail(apiKey, {
        to: params.email,
        subject: 'Welcome to LunaOS — Your AI Dev Team Awaits',
        html: welcomeEmailHtml(params.name),
        text: welcomeEmailText(params.name),
    });
}

// ─── Upgrade Receipt ─────────────────────────────────────────────────────────

export async function sendUpgradeEmail(
    apiKey: string,
    params: { email: string; name: string; tier: string },
): Promise<void> {
    const tierDisplay = params.tier === 'team' ? 'Team ($79/mo)' : 'Pro ($29/mo)';
    const agentCount = params.tier === 'team' ? '28+ agents + priority support' : '28+ agents';
    const execLimit = params.tier === 'team' ? '100,000' : '10,000';

    await sendEmail(apiKey, {
        to: params.email,
        subject: `You're on ${tierDisplay} — All Agents Unlocked!`,
        html: upgradeEmailHtml(params.name, tierDisplay, agentCount, execLimit),
        text: upgradeEmailText(params.name, tierDisplay, agentCount, execLimit),
    });
}

// ─── Usage Warning ───────────────────────────────────────────────────────────

export async function sendUsageWarningEmail(
    apiKey: string,
    params: { email: string; name: string; used: number; limit: number; tier: string },
): Promise<void> {
    const pct = Math.round((params.used / params.limit) * 100);

    await sendEmail(apiKey, {
        to: params.email,
        subject: `${pct}% of your monthly executions used`,
        html: usageWarningEmailHtml(params.name, pct, params.used, params.limit, params.tier),
        text: usageWarningEmailText(pct, params.used, params.limit, params.tier),
    });
}

// ─── Password Reset Email ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(
    apiKey: string,
    params: { email: string; resetToken: string },
): Promise<void> {
    const resetUrl = `https://agents.lunaos.ai/auth/reset-password?token=${params.resetToken}`;

    await sendEmail(apiKey, {
        to: params.email,
        subject: 'Reset your LunaOS password',
        html: passwordResetEmailHtml(resetUrl),
        text: passwordResetEmailText(resetUrl),
    });
}
