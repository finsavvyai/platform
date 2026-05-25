/**
 * Processes incoming Microsoft Graph change notifications.
 * Routes notifications to appropriate queues for async handling.
 * Also forwards events to the event bridge for workflow triggers.
 */

import { notificationToEvent, processEvent } from './event-bridge';

export interface GraphNotification {
	subscriptionId: string;
	clientState: string;
	changeType: string;
	resource: string;
	resourceData: {
		id: string;
		'@odata.type': string;
	};
}

export const ALLOWED_RESOURCES = [
	'/users',
	'/groups',
	'/security/alerts_v2',
	'/communications/callRecords',
	'/teams/getAllMessages',
];

export async function processNotification(env: any, notification: GraphNotification) {
	const tenantId = notification.clientState?.replace('tenantiq-', '');
	if (!tenantId) return;

	if (notification.resource.includes('security/alerts')) {
		await env.SCAN_QUEUE.send({
			type: 'graph_alert',
			tenantId,
			alertId: notification.resourceData.id,
			changeType: notification.changeType,
		});
	} else if (notification.resource.includes('users')) {
		await env.NOTIFICATION_QUEUE.send({
			type: 'user_change',
			tenantId,
			userId: notification.resourceData.id,
			changeType: notification.changeType,
		});
	}

	// Forward to event bridge for workflow trigger matching
	const event = notificationToEvent(notification);
	if (event) {
		try {
			await processEvent(env, event);
		} catch (err) {
			console.error('[Webhook] Event bridge error:', err);
		}
	}

	console.log(`[Webhook] Processed ${notification.changeType} on ${notification.resource}`);
}
