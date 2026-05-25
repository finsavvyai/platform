/**
 * Teams Backup
 *
 * Backs up Microsoft Teams channel messages and file metadata via Graph API.
 * Stores structured backup data to R2 with per-tenant prefix.
 */

import type { Env } from '../../app/types';
import type { BackupResult } from './types';
import { updateJobStatus } from './orchestrator';

type GraphFetcher = (path: string) => Promise<any>;

interface TeamInfo {
	id: string;
	displayName: string;
	description: string;
}

interface ChannelInfo {
	id: string;
	displayName: string;
	membershipType: string;
}

interface ChannelMessage {
	id: string;
	createdDateTime: string;
	from: { user?: { displayName: string } } | null;
	body: { contentType: string; content: string };
}

interface GraphPagedResponse<T> {
	value: T[];
	'@odata.nextLink'?: string;
}

/** Backup Teams channels and messages for a tenant */
export async function backupTeamsChannels(
	env: Env,
	graphFetch: GraphFetcher,
	tenantId: string,
	jobId: string
): Promise<BackupResult> {
	await updateJobStatus(env, jobId, { status: 'running' });

	try {
		const teams = await fetchTeams(graphFetch);
		const backupData: { teamId: string; teamName: string; channels: any[] }[] = [];
		let totalItems = 0;

		for (const team of teams) {
			const channels = await fetchChannels(graphFetch, team.id);
			const channelData: { channelId: string; name: string; messages: ChannelMessage[] }[] = [];

			for (const channel of channels) {
				const messages = await fetchChannelMessages(graphFetch, team.id, channel.id);
				channelData.push({ channelId: channel.id, name: channel.displayName, messages });
				totalItems += messages.length;
			}

			backupData.push({ teamId: team.id, teamName: team.displayName, channels: channelData });
		}

		const data = JSON.stringify({ teams: backupData, backedUpAt: new Date().toISOString() });
		const sizeBytes = new TextEncoder().encode(data).byteLength;

		const r2Key = `backups/${tenantId}/teams/${jobId}.json`;
		await env.R2.put(r2Key, data, {
			customMetadata: { tenantId, jobId, type: 'teams', timestamp: new Date().toISOString() },
		});

		const result: BackupResult = { itemsCount: totalItems, sizeBytes };
		await updateJobStatus(env, jobId, {
			status: 'completed',
			itemsCount: result.itemsCount,
			sizeBytes: result.sizeBytes,
		});

		return result;
	} catch (err: any) {
		await updateJobStatus(env, jobId, { status: 'failed', error: err.message });
		throw err;
	}
}

/** Fetch all teams the app has access to */
async function fetchTeams(graphFetch: GraphFetcher): Promise<TeamInfo[]> {
	const response: GraphPagedResponse<TeamInfo> = await graphFetch('/groups?$filter=resourceProvisioningOptions/Any(x:x eq \'Team\')&$top=100');
	return response.value ?? [];
}

/** Fetch channels for a specific team */
async function fetchChannels(graphFetch: GraphFetcher, teamId: string): Promise<ChannelInfo[]> {
	const response: GraphPagedResponse<ChannelInfo> = await graphFetch(`/teams/${teamId}/channels`);
	return response.value ?? [];
}

/** Fetch messages from a channel with pagination */
async function fetchChannelMessages(
	graphFetch: GraphFetcher,
	teamId: string,
	channelId: string
): Promise<ChannelMessage[]> {
	const messages: ChannelMessage[] = [];
	let url: string | undefined = `/teams/${teamId}/channels/${channelId}/messages?$top=50`;

	while (url) {
		const response: GraphPagedResponse<ChannelMessage> = await graphFetch(url);
		messages.push(...response.value);
		url = response['@odata.nextLink'];
	}

	return messages;
}

/** Get the R2 key prefix for Teams backups */
export function getTeamsBackupPrefix(tenantId: string): string {
	return `backups/${tenantId}/teams/`;
}
