/**
 * Slack & Microsoft Teams Webhook Formatters
 */

import type { WebhookEvent } from './types';

/**
 * Format for Slack (Blocks API)
 */
export function formatForSlack(event: WebhookEvent): WebhookEvent {
	const alert = event.data as any;

	return {
		...event,
		slack: {
			blocks: [
				{
					type: 'header',
					text: {
						type: 'plain_text',
						text: `🚨 ${alert.title || 'New Alert'}`,
						emoji: true
					}
				},
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: alert.description || 'No description'
					}
				},
				{
					type: 'section',
					fields: [
						{
							type: 'mrkdwn',
							text: `*Severity:*\n${alert.severity || 'Unknown'}`
						},
						{
							type: 'mrkdwn',
							text: `*Category:*\n${alert.category || 'Unknown'}`
						}
					]
				},
				{
					type: 'actions',
					elements: [
						{
							type: 'button',
							text: { type: 'plain_text', text: 'View Details' },
							url: `https://tenantiq.app/alerts/${alert.id}`,
							action_id: 'view_alert'
						},
						{
							type: 'button',
							text: { type: 'plain_text', text: 'Remediate' },
							style: 'primary',
							action_id: 'remediate_alert',
							value: alert.id
						}
					]
				}
			]
		}
	};
}

/**
 * Format for Microsoft Teams (Adaptive Cards)
 */
export function formatForTeams(event: WebhookEvent): WebhookEvent {
	const alert = event.data as any;

	return {
		...event,
		teams: {
			type: 'message',
			attachments: [
				{
					contentType: 'application/vnd.microsoft.card.adaptive',
					content: {
						type: 'AdaptiveCard',
						version: '1.4',
						body: [
							{
								type: 'TextBlock',
								text: alert.title || 'New Alert',
								size: 'Large',
								weight: 'Bolder'
							},
							{
								type: 'TextBlock',
								text: alert.description || 'No description',
								wrap: true
							},
							{
								type: 'FactSet',
								facts: [
									{ title: 'Severity', value: alert.severity || 'Unknown' },
									{ title: 'Category', value: alert.category || 'Unknown' }
								]
							}
						],
						actions: [
							{
								type: 'Action.OpenUrl',
								title: 'View Details',
								url: `https://tenantiq.app/alerts/${alert.id}`
							}
						]
					}
				}
			]
		}
	};
}
