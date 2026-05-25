/**
 * Discord & Messaging Platform Webhook Formatters
 */

import type { WebhookEvent } from './types';

/**
 * Format for Discord (Embeds)
 */
export function formatForDiscord(event: WebhookEvent): WebhookEvent {
	const alert = event.data as any;

	const severityColors: Record<string, number> = {
		critical: 0xFF0000,
		high: 0xFF6600,
		medium: 0xFFCC00,
		low: 0x00FF00
	};

	return {
		...event,
		discord: {
			embeds: [
				{
					title: alert.title || 'New Alert',
					description: alert.description || 'No description',
					color: severityColors[alert.severity as string] || 0x808080,
					fields: [
						{ name: 'Severity', value: alert.severity || 'Unknown', inline: true },
						{ name: 'Category', value: alert.category || 'Unknown', inline: true }
					],
					timestamp: event.timestamp,
					footer: { text: 'TenantIQ' }
				}
			]
		}
	};
}

/**
 * Format for messaging platforms (WhatsApp, Telegram)
 */
export function formatForMessaging(event: WebhookEvent): WebhookEvent {
	const alert = event.data as any;

	const severityEmoji: Record<string, string> = {
		critical: '🔴',
		high: '🟠',
		medium: '🟡',
		low: '⚪'
	};

	const message = `${severityEmoji[alert.severity as string] || '⚪'} *${alert.title || 'New Alert'}*

${alert.description || 'No description'}

*Severity:* ${alert.severity || 'Unknown'}
*Category:* ${alert.category || 'Unknown'}

View: https://tenantiq.app/alerts/${alert.id}`;

	return {
		...event,
		text: message
	};
}
