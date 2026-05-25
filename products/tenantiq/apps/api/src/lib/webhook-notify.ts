/**
 * Webhook Notifications — send alerts to Slack, Teams, Discord, or custom webhooks.
 */

export interface WebhookPayload {
	type: 'alert' | 'scan_complete' | 'drift_detected' | 'sync_complete';
	title: string;
	message: string;
	severity?: string;
	url?: string;
	timestamp: string;
}

export interface WebhookConfig {
	url: string;
	enabled: boolean;
	channel?: 'slack' | 'teams' | 'discord' | 'generic';
}

export interface MultiChannelConfig {
	channels: WebhookConfig[];
}

function detectChannel(url: string): WebhookConfig['channel'] {
	if (url.includes('hooks.slack.com')) return 'slack';
	if (url.includes('webhook.office.com') || url.includes('workflows.microsoft.com')) return 'teams';
	if (url.includes('discord.com/api/webhooks')) return 'discord';
	return 'generic';
}

function severityColor(severity?: string): string {
	if (severity === 'critical') return '#FF3B30';
	if (severity === 'high') return '#FF9500';
	if (severity === 'medium') return '#FFCC00';
	return '#007AFF';
}

function formatSlack(payload: WebhookPayload): string {
	return JSON.stringify({
		blocks: [
			{ type: 'header', text: { type: 'plain_text', text: payload.title, emoji: true } },
			{ type: 'section', text: { type: 'mrkdwn', text: payload.message } },
			{ type: 'context', elements: [
				{ type: 'mrkdwn', text: `*Type:* ${payload.type} | *Severity:* ${payload.severity ?? 'info'} | *Time:* ${payload.timestamp}` },
			]},
			...(payload.url ? [{ type: 'actions', elements: [
				{ type: 'button', text: { type: 'plain_text', text: 'View in TenantIQ' }, url: payload.url, style: 'primary' },
			]}] : []),
		],
	});
}

function formatTeams(payload: WebhookPayload): string {
	return JSON.stringify({
		type: 'message',
		attachments: [{
			contentType: 'application/vnd.microsoft.card.adaptive',
			content: {
				$schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
				type: 'AdaptiveCard',
				version: '1.4',
				body: [
					{ type: 'TextBlock', text: payload.title, weight: 'Bolder', size: 'Medium', color: payload.severity === 'critical' ? 'Attention' : 'Default' },
					{ type: 'TextBlock', text: payload.message, wrap: true },
					{ type: 'FactSet', facts: [
						{ title: 'Type', value: payload.type },
						{ title: 'Severity', value: payload.severity ?? 'info' },
						{ title: 'Time', value: payload.timestamp },
					]},
				],
				actions: payload.url ? [{ type: 'Action.OpenUrl', title: 'View in TenantIQ', url: payload.url }] : [],
			},
		}],
	});
}

function formatDiscord(payload: WebhookPayload): string {
	return JSON.stringify({
		embeds: [{
			title: payload.title,
			description: payload.message,
			color: parseInt(severityColor(payload.severity).replace('#', ''), 16),
			fields: [
				{ name: 'Type', value: payload.type, inline: true },
				{ name: 'Severity', value: payload.severity ?? 'info', inline: true },
			],
			timestamp: payload.timestamp,
			footer: { text: 'TenantIQ' },
			...(payload.url ? { url: payload.url } : {}),
		}],
	});
}

function formatForChannel(channel: WebhookConfig['channel'], payload: WebhookPayload): string {
	switch (channel) {
		case 'slack': return formatSlack(payload);
		case 'teams': return formatTeams(payload);
		case 'discord': return formatDiscord(payload);
		default: return JSON.stringify(payload);
	}
}

async function sendToWebhook(
	url: string,
	body: string,
): Promise<{ sent: boolean; error?: string }> {
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		});
		return res.ok ? { sent: true } : { sent: false, error: `HTTP ${res.status}` };
	} catch (err) {
		return { sent: false, error: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function sendWebhookNotification(
	kv: KVNamespace,
	tenantId: string,
	payload: WebhookPayload,
): Promise<{ sent: boolean; error?: string }> {
	// Check for multi-channel config first
	const multi = await kv.get(`webhook_configs:${tenantId}`, 'json') as MultiChannelConfig | null;
	if (multi?.channels?.length) {
		return sendToAllChannels(multi.channels, payload);
	}

	// Fall back to single webhook config
	const config = await kv.get(`webhook:${tenantId}`, 'json') as WebhookConfig | null;
	if (!config?.enabled || !config.url) return { sent: false };

	const channel = config.channel ?? detectChannel(config.url);
	const body = formatForChannel(channel, payload);
	return sendToWebhook(config.url, body);
}

export async function sendToAllChannels(
	channels: WebhookConfig[],
	payload: WebhookPayload,
): Promise<{ sent: boolean; error?: string }> {
	const enabled = channels.filter((c) => c.enabled && c.url);
	if (enabled.length === 0) return { sent: false };

	const results = await Promise.allSettled(
		enabled.map((ch) => {
			const channel = ch.channel ?? detectChannel(ch.url);
			return sendToWebhook(ch.url, formatForChannel(channel, payload));
		}),
	);

	const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value.sent);
	const errors = results
		.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.sent))
		.map((r) => (r.status === 'rejected' ? String(r.reason) : (r as PromiseFulfilledResult<{ error?: string }>).value.error))
		.filter(Boolean);

	return { sent: anySuccess, error: errors.length ? errors.join('; ') : undefined };
}
