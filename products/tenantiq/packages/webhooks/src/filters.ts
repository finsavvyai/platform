/**
 * Webhook Delivery Filters
 * Determines whether an event should be delivered based on config rules
 */

import type { WebhookConfig, WebhookEvent } from './types';

/**
 * Check if event should be delivered based on config filters
 * Evaluates: enabled state, quiet hours, severity threshold, category whitelist
 */
export function shouldDeliver(config: WebhookConfig, event: WebhookEvent): boolean {
	if (!config.enabled) {
		return false;
	}

	if (isInQuietHours(config) && event.data?.severity !== 'critical') {
		return false;
	}

	if (!meetsSeverityThreshold(config, event)) {
		return false;
	}

	if (!matchesCategory(config, event)) {
		return false;
	}

	return true;
}

function isInQuietHours(config: WebhookConfig): boolean {
	if (!config.quietHoursStart || !config.quietHoursEnd) {
		return false;
	}

	const now = new Date();
	const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

	return currentTime >= config.quietHoursStart && currentTime <= config.quietHoursEnd;
}

function meetsSeverityThreshold(config: WebhookConfig, event: WebhookEvent): boolean {
	if (!config.minSeverity || !event.data?.severity) {
		return true;
	}

	const severityLevels = ['low', 'medium', 'high', 'critical'];
	const minLevel = severityLevels.indexOf(config.minSeverity);
	const eventLevel = severityLevels.indexOf(event.data.severity as string);

	return eventLevel >= minLevel;
}

function matchesCategory(config: WebhookConfig, event: WebhookEvent): boolean {
	if (!config.categories || config.categories.length === 0) {
		return true;
	}

	return config.categories.includes(event.data?.category as string);
}
