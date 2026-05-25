/**
 * Email Service — send transactional emails via Resend API.
 * Templates use inline HTML with TenantIQ branding.
 */

import type { Env } from '../app/types';

/** Escape user-controlled strings to prevent XSS in HTML email templates */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

interface SendEmailParams {
	to: string;
	subject: string;
	html: string;
}

const RESEND_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'TenantIQ <notifications@tenantiq.app>';

export async function sendEmail(env: Env, params: SendEmailParams): Promise<boolean> {
	if (!env.RESEND_API_KEY) {
		console.warn('[email-service] RESEND_API_KEY not configured — skipping email');
		return false;
	}

	try {
		const res = await fetch(RESEND_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: FROM_ADDRESS,
				to: params.to,
				subject: params.subject,
				html: params.html,
			}),
		});

		if (!res.ok) {
			console.error(`[email-service] Resend API error: ${res.status}`);
			return false;
		}
		return true;
	} catch (err) {
		console.error('[email-service] Failed to send email:', err);
		return false;
	}
}

// ─── Shared Template Wrapper ─────────────────────────────────────────────────

function wrapTemplate(title: string, body: string): string {
	return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7">
<div style="max-width:600px;margin:0 auto;background:#fff">
<div style="background:#007AFF;padding:24px 32px;color:#fff">
<h1 style="margin:0;font-size:20px;font-weight:600">TenantIQ</h1>
<p style="margin:4px 0 0;font-size:13px;opacity:0.85">${title}</p>
</div>
<div style="padding:32px">${body}</div>
<div style="padding:16px 32px;background:#f5f5f7;color:#86868b;font-size:12px;text-align:center">
<p style="margin:0">&copy; ${new Date().getFullYear()} TenantIQ. All rights reserved.</p>
</div>
</div></body></html>`;
}

// ─── Severity Badge ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
	critical: '#FF3B30',
	high: '#FF9500',
	medium: '#FFCC00',
	low: '#34C759',
};

function severityBadge(severity: string): string {
	const color = SEVERITY_COLORS[severity] ?? '#86868b';
	return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${color};color:#fff;font-size:12px;font-weight:600;text-transform:uppercase">${escapeHtml(severity)}</span>`;
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export function securityAlertEmail(
	alertTitle: string,
	severity: string,
	description: string,
	actionUrl: string,
): string {
	const body = `
<h2 style="margin:0 0 8px;font-size:18px;color:#1d1d1f">Security Alert</h2>
<p style="margin:0 0 16px">${severityBadge(severity)}</p>
<h3 style="margin:0 0 8px;font-size:16px;color:#1d1d1f">${escapeHtml(alertTitle)}</h3>
<p style="margin:0 0 24px;color:#424245;line-height:1.5">${escapeHtml(description)}</p>
<a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 24px;background:#007AFF;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View Alert</a>`;
	return wrapTemplate('Security Alert', body);
}

export function backupFailureEmail(
	tenantName: string,
	failureReason: string,
	lastSuccessAt: string,
): string {
	const body = `
<h2 style="margin:0 0 16px;font-size:18px;color:#1d1d1f">Backup Failed</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<tr><td style="padding:8px 0;color:#86868b;width:140px">Tenant</td><td style="padding:8px 0;color:#1d1d1f;font-weight:500">${escapeHtml(tenantName)}</td></tr>
<tr><td style="padding:8px 0;color:#86868b">Failure Reason</td><td style="padding:8px 0;color:#FF3B30;font-weight:500">${escapeHtml(failureReason)}</td></tr>
<tr><td style="padding:8px 0;color:#86868b">Last Success</td><td style="padding:8px 0;color:#1d1d1f">${escapeHtml(lastSuccessAt)}</td></tr>
</table>
<p style="color:#424245;line-height:1.5">Please investigate and retry the backup from your TenantIQ dashboard.</p>`;
	return wrapTemplate('Backup Failure', body);
}

export function workflowCompletionEmail(
	workflowName: string,
	status: string,
	summary: string,
): string {
	const statusColor = status === 'completed' ? '#34C759' : '#FF3B30';
	const body = `
<h2 style="margin:0 0 16px;font-size:18px;color:#1d1d1f">Workflow ${status === 'completed' ? 'Completed' : 'Failed'}</h2>
<p style="margin:0 0 8px;color:#86868b">Workflow</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1d1d1f">${escapeHtml(workflowName)}</p>
<p style="margin:0 0 8px;color:#86868b">Status</p>
<p style="margin:0 0 16px;font-weight:600;color:${statusColor}">${escapeHtml(status)}</p>
<p style="margin:0 0 8px;color:#86868b">Summary</p>
<p style="margin:0 0 24px;color:#424245;line-height:1.5">${escapeHtml(summary)}</p>`;
	return wrapTemplate('Workflow Update', body);
}

export function teamInviteEmail(
	inviterName: string,
	role: string,
	inviteUrl: string,
	expiresAt: string,
): string {
	const roleLabels: Record<string, string> = {
		tenant_admin: 'Admin',
		tenant_operator: 'Operator',
		tenant_viewer: 'Viewer',
	};
	const roleLabel = roleLabels[role] || role;
	const expDate = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	const body = `
<h2 style="margin:0 0 8px;font-size:18px;color:#1d1d1f">You've been invited to TenantIQ</h2>
<p style="margin:0 0 24px;color:#424245;line-height:1.5"><strong>${escapeHtml(inviterName)}</strong> has invited you to join their organization on TenantIQ as a <strong>${escapeHtml(roleLabel)}</strong>.</p>
<p style="margin:0 0 8px;color:#86868b;font-size:13px">TenantIQ helps manage Microsoft 365 security, compliance, and cost intelligence.</p>
<div style="margin:24px 0">
<a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:14px 32px;background:#007AFF;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">Accept Invitation</a>
</div>
<p style="margin:0;color:#86868b;font-size:12px">This invitation expires on ${escapeHtml(expDate)}. If you didn't expect this, you can safely ignore it.</p>`;
	return wrapTemplate('Team Invitation', body);
}

export async function sendInvitationEmail(
	env: Env,
	params: { to: string; invitedBy: string; invitationUrl: string },
): Promise<boolean> {
	const body = `<h2 style="margin:0 0 8px;font-size:18px;color:#1d1d1f">You've been invited to TenantIQ</h2>
<p style="margin:0 0 16px;color:#424245;line-height:1.5"><strong>${escapeHtml(params.invitedBy)}</strong> invited you to TenantIQ — AI-powered Microsoft 365 security and compliance.</p>
<div style="margin:0 0 24px"><a href="${escapeHtml(params.invitationUrl)}" style="display:inline-block;padding:14px 32px;background:#007AFF;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">Accept Invitation</a></div>
<p style="margin:0;color:#86868b;font-size:12px">This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.</p>`;
	return sendEmail(env, { to: params.to, subject: "You've been invited to TenantIQ", html: wrapTemplate('Team Invitation', body) });
}

export function weeklyDigestEmail(metrics: {
	alerts: number;
	resolved: number;
	savings: number;
}): string {
	const body = `
<h2 style="margin:0 0 24px;font-size:18px;color:#1d1d1f">Your Weekly Security Digest</h2>
<div style="display:flex;gap:16px;margin-bottom:24px">
<div style="flex:1;padding:16px;background:#f5f5f7;border-radius:12px;text-align:center">
<p style="margin:0;font-size:28px;font-weight:700;color:#FF9500">${metrics.alerts}</p>
<p style="margin:4px 0 0;font-size:13px;color:#86868b">New Alerts</p>
</div>
<div style="flex:1;padding:16px;background:#f5f5f7;border-radius:12px;text-align:center">
<p style="margin:0;font-size:28px;font-weight:700;color:#34C759">${metrics.resolved}</p>
<p style="margin:4px 0 0;font-size:13px;color:#86868b">Resolved</p>
</div>
<div style="flex:1;padding:16px;background:#f5f5f7;border-radius:12px;text-align:center">
<p style="margin:0;font-size:28px;font-weight:700;color:#007AFF">$${metrics.savings}</p>
<p style="margin:4px 0 0;font-size:13px;color:#86868b">Savings</p>
</div>
</div>`;
	return wrapTemplate('Weekly Digest', body);
}
