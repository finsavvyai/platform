/**
 * Exchange Backup
 *
 * Backs up Exchange mailbox messages via Microsoft Graph delta queries.
 * Stores backup data to R2 with per-tenant prefix.
 */

import type { Env } from '../../app/types';
import type { BackupResult } from './types';
import { updateJobStatus } from './orchestrator';

type GraphFetcher = (path: string) => Promise<any>;

interface MailMessage {
	id: string;
	subject: string;
	from: { emailAddress: { name: string; address: string } };
	receivedDateTime: string;
	bodyPreview: string;
	hasAttachments: boolean;
}

interface GraphDeltaResponse {
	value: MailMessage[];
	'@odata.deltaLink'?: string;
	'@odata.nextLink'?: string;
}

/** Backup Exchange mailboxes for a tenant using Graph delta queries */
export async function backupExchangeMailboxes(
	env: Env,
	graphFetch: GraphFetcher,
	tenantId: string,
	jobId: string
): Promise<BackupResult> {
	await updateJobStatus(env, jobId, { status: 'running' });

	try {
		const messages = await fetchMailboxMessages(graphFetch, tenantId, env.KV);
		const data = JSON.stringify(messages);
		const sizeBytes = new TextEncoder().encode(data).byteLength;

		const r2Key = `backups/${tenantId}/exchange/${jobId}.json`;
		await env.R2.put(r2Key, data, {
			customMetadata: { tenantId, jobId, type: 'exchange', timestamp: new Date().toISOString() },
		});

		const result: BackupResult = { itemsCount: messages.length, sizeBytes };
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

/** Fetch mailbox messages using delta queries for incremental backup */
async function fetchMailboxMessages(
	graphFetch: GraphFetcher,
	tenantId: string,
	kv: KVNamespace
): Promise<MailMessage[]> {
	const deltaKey = `backup:exchange:delta:${tenantId}`;
	const savedDelta = await kv.get(deltaKey);
	const messages: MailMessage[] = [];

	let url = savedDelta ?? '/me/mailFolders/inbox/messages/delta?$top=50';

	while (url) {
		const response: GraphDeltaResponse = await graphFetch(url);
		messages.push(...response.value);

		if (response['@odata.deltaLink']) {
			await kv.put(deltaKey, response['@odata.deltaLink']);
			break;
		}

		url = response['@odata.nextLink'] ?? '';
	}

	return messages;
}

/** Get the R2 key prefix for exchange backups */
export function getExchangeBackupPrefix(tenantId: string): string {
	return `backups/${tenantId}/exchange/`;
}
