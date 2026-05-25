/**
 * SMS Service — send critical alerts via Twilio.
 * Only used for severity === 'critical' alerts.
 */

import type { Env } from '../app/types';

interface SendSMSParams {
	to: string;
	body: string;
}

export async function sendSMS(env: Env, params: SendSMSParams): Promise<boolean> {
	if (!env.TWILIO_SID) {
		console.warn('[sms-service] TWILIO_SID not configured — skipping SMS');
		return false;
	}
	if (!env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
		console.warn('[sms-service] TWILIO_AUTH_TOKEN or TWILIO_FROM missing — skipping SMS');
		return false;
	}

	const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`;
	const credentials = btoa(`${env.TWILIO_SID}:${env.TWILIO_AUTH_TOKEN}`);

	const formBody = new URLSearchParams({
		From: env.TWILIO_FROM,
		To: params.to,
		Body: params.body,
	});

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${credentials}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formBody.toString(),
		});

		if (!res.ok) {
			const errorBody = await res.text().catch(() => '');
			console.error(`[sms-service] Twilio API error: ${res.status} ${errorBody}`);
			return false;
		}
		return true;
	} catch (err) {
		console.error('[sms-service] Failed to send SMS:', err);
		return false;
	}
}

/**
 * Format a short SMS text for critical alerts.
 * Keeps message under 160 chars for single-segment delivery.
 */
export function formatSMSAlert(
	alertTitle: string,
	severity: string,
	tenantName: string,
): string {
	const prefix = `[TenantIQ ${severity.toUpperCase()}]`;
	const body = `${alertTitle} — ${tenantName}`;
	const maxBody = 160 - prefix.length - 1; // 1 for space
	const truncated = body.length > maxBody ? `${body.slice(0, maxBody - 3)}...` : body;
	return `${prefix} ${truncated}`;
}
