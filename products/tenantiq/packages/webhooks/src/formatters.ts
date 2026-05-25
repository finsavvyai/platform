/**
 * Platform-Specific Webhook Formatters
 * Routes events to the correct platform formatter
 */

import type { WebhookEvent } from './types';
import { formatForSlack, formatForTeams } from './format-slack-teams';
import { formatForDiscord, formatForMessaging } from './format-discord-messaging';

export type WebhookPlatform = 'whatsapp' | 'slack' | 'teams' | 'discord' | 'telegram' | 'generic';

export { formatForSlack, formatForTeams } from './format-slack-teams';
export { formatForDiscord, formatForMessaging } from './format-discord-messaging';

/**
 * Format event for a specific delivery platform
 */
export function formatForPlatform(event: WebhookEvent, platform: WebhookPlatform): WebhookEvent {
	switch (platform) {
		case 'slack':
			return formatForSlack(event);
		case 'teams':
			return formatForTeams(event);
		case 'discord':
			return formatForDiscord(event);
		case 'whatsapp':
		case 'telegram':
			return formatForMessaging(event);
		default:
			return event;
	}
}
