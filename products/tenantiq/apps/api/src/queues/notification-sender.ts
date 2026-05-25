import type { Env } from '../index';
import { sendPushNotification } from '../lib/web-push';
import { broadcastToTenant } from '../lib/broadcast';
import { sendWebhookNotification } from '../lib/webhook-notify';
import type { WebhookPayload } from '../lib/webhook-notify';

interface NotificationMessage {
	type: string;
	tenantId?: string;
	userId?: string;
	email?: string;
	count?: number;
	workflowId?: string;
	workflowName?: string;
	runId?: string;
	[key: string]: unknown;
}

export async function sendNotification(message: unknown, env: Env) {
	const msg = message as NotificationMessage;

	switch (msg.type) {
		case 'critical_alerts': {
			console.log(`[Notification] ${msg.count} critical alerts for tenant ${msg.tenantId}`);
			await storeNotification(env, msg.tenantId!, 'critical_alerts', `${msg.count} critical alert(s) detected`);
			await broadcastToTenant(env, msg.tenantId!, { type: 'alert', newAlerts: msg.count, severity: 'critical' });
			if (msg.email) await sendEmail(env, msg.email, 'Security Alert: Critical alerts detected', emailTemplates.securityAlert(msg.count ?? 0, msg.tenantId!));
			if (msg.userId) await sendPushNotification(env, msg.userId, { title: 'Critical Alerts', body: `${msg.count} critical alert(s) detected`, category: 'security', url: '/alerts' });
			break;
		}

		case 'workflow_approval_needed': {
			console.log(`[Notification] Workflow approval needed: ${msg.workflowName}`);
			await storeNotification(env, msg.tenantId!, 'workflow_approval', `Workflow "${msg.workflowName}" needs approval`, { workflowId: msg.workflowId, runId: msg.runId });
			break;
		}

		case 'remediation_complete': {
			console.log(`[Notification] Remediation complete for tenant ${msg.tenantId}`);
			await storeNotification(env, msg.tenantId!, 'remediation_complete', 'Remediation action completed successfully');
			await broadcastToTenant(env, msg.tenantId!, { type: 'notification', message: 'Remediation completed successfully' });
			break;
		}

		case 'workflow_completed': {
			console.log(`[Notification] Workflow completed: ${msg.workflowName}`);
			await storeNotification(env, msg.tenantId!, 'workflow_completed', `Workflow "${msg.workflowName}" completed successfully`, { workflowId: msg.workflowId, runId: msg.runId });
			if (msg.email) await sendEmail(env, msg.email, `Workflow Complete: ${msg.workflowName}`, emailTemplates.workflowCompletion(msg.workflowName ?? 'Unknown', 'completed'));
			if (msg.userId) await sendPushNotification(env, msg.userId, { title: 'Workflow Complete', body: `"${msg.workflowName}" completed`, category: 'workflow', url: '/workflows' });
			break;
		}

		case 'workflow_failed': {
			console.log(`[Notification] Workflow failed: ${msg.workflowName}`);
			await storeNotification(env, msg.tenantId!, 'workflow_failed', `Workflow "${msg.workflowName}" failed to complete`, { workflowId: msg.workflowId, runId: msg.runId });
			if (msg.email) await sendEmail(env, msg.email, `Workflow Failed: ${msg.workflowName}`, emailTemplates.workflowCompletion(msg.workflowName ?? 'Unknown', 'failed'));
			break;
		}

		case 'workflow_report': {
			console.log(`[Notification] Workflow report for tenant ${msg.tenantId}`);
			await storeNotification(env, msg.tenantId!, 'workflow_report', 'Workflow execution report is ready');
			break;
		}

		case 'backup_failure': {
			console.log(`[Notification] Backup failed for tenant ${msg.tenantId}`);
			await storeNotification(env, msg.tenantId!, 'backup_failure', 'Backup job failed — immediate attention required');
			await broadcastToTenant(env, msg.tenantId!, { type: 'notification', message: 'Backup job failed', severity: 'critical' });
			if (msg.email) await sendEmail(env, msg.email, 'Backup Failed: Immediate action required', emailTemplates.backupFailure(msg.tenantId!));
			if (msg.userId) await sendPushNotification(env, msg.userId, { title: 'Backup Failed', body: 'A backup job has failed', category: 'backup', url: '/backups' });
			break;
		}

		default:
			console.log(`[Notification] Unknown notification type: ${msg.type}`);
	}

	// Dispatch to configured webhooks (Slack/Teams/Discord) for all types
	if (msg.tenantId) {
		try {
			const webhookPayload: WebhookPayload = {
				type: 'alert',
				title: notificationTitle(msg),
				message: notificationMessage(msg),
				severity: msg.severity as string | undefined,
				url: `https://app.tenantiq.io${notificationUrl(msg)}`,
				timestamp: new Date().toISOString(),
			};
			await sendWebhookNotification(env.KV, msg.tenantId, webhookPayload);
		} catch (err) {
			console.warn('[Notification] Webhook dispatch failed:', err);
		}
	}
}

const NOTIFICATION_TITLES: Record<string, string> = {
	critical_alerts: 'Critical Alerts Detected',
	workflow_approval_needed: 'Workflow Approval Needed',
	remediation_complete: 'Remediation Complete',
	workflow_completed: 'Workflow Completed',
	workflow_failed: 'Workflow Failed',
	backup_failure: 'Backup Failure',
};

const NOTIFICATION_URLS: Record<string, string> = {
	critical_alerts: '/alerts',
	workflow_approval_needed: '/workflows',
	remediation_complete: '/alerts',
	workflow_completed: '/workflows',
	workflow_failed: '/workflows',
	backup_failure: '/backups',
};

function notificationTitle(msg: NotificationMessage): string {
	return NOTIFICATION_TITLES[msg.type] ?? `TenantIQ: ${msg.type}`;
}

function notificationMessage(msg: NotificationMessage): string {
	if (msg.type === 'critical_alerts') return `${msg.count} critical alert(s) detected`;
	if (msg.workflowName) return `Workflow "${msg.workflowName}" — ${msg.type.replace('workflow_', '')}`;
	return msg.type.replace(/_/g, ' ');
}

function notificationUrl(msg: NotificationMessage): string {
	return NOTIFICATION_URLS[msg.type] ?? '/';
}

async function storeNotification(env: Env, tenantId: string, type: string, message: string, extra?: Record<string, unknown>) {
	await env.KV.put(
		`notification:${tenantId}:${Date.now()}`,
		JSON.stringify({ type, message, ...extra, timestamp: new Date().toISOString() }),
		{ expirationTtl: 86400 }
	);
}

async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
	if (!env.RESEND_API_KEY) {
		console.log('[Email] RESEND_API_KEY not configured — skipping email');
		return false;
	}

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: 'TenantIQ <notifications@tenantiq.io>', to: [to], subject, html })
		});

		if (!response.ok) {
			console.error(`[Email] Resend API returned ${response.status}`);
			return false;
		}
		return true;
	} catch (error) {
		console.error('[Email] Failed to send:', error);
		return false;
	}
}

const emailTemplates = {
	securityAlert(count: number, tenantId: string): string {
		return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h2 style="color:#d13438">Security Alert</h2><p><strong>${count}</strong> critical alert(s) detected for tenant <code>${tenantId}</code>.</p><p>Review and address these alerts immediately in your TenantIQ dashboard.</p><a href="https://app.tenantiq.io/alerts" style="display:inline-block;padding:10px 20px;background:#0078d4;color:#fff;border-radius:6px;text-decoration:none">View Alerts</a></div>`;
	},

	backupFailure(tenantId: string): string {
		return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h2 style="color:#d13438">Backup Failure</h2><p>A backup job for tenant <code>${tenantId}</code> has failed.</p><p>Your data recovery capability may be degraded. Please investigate and re-trigger the backup.</p><a href="https://app.tenantiq.io/backups" style="display:inline-block;padding:10px 20px;background:#0078d4;color:#fff;border-radius:6px;text-decoration:none">View Backups</a></div>`;
	},

	workflowCompletion(name: string, status: 'completed' | 'failed'): string {
		const color = status === 'completed' ? '#107c10' : '#d13438';
		const label = status === 'completed' ? 'Completed' : 'Failed';
		return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h2 style="color:${color}">Workflow ${label}</h2><p>Workflow <strong>"${name}"</strong> has ${status}.</p><a href="https://app.tenantiq.io/workflows" style="display:inline-block;padding:10px 20px;background:#0078d4;color:#fff;border-radius:6px;text-decoration:none">View Workflows</a></div>`;
	}
};
