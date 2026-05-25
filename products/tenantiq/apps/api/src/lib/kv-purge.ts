/**
 * KV pattern-delete helper. Cloudflare KV doesn't support prefix delete natively,
 * so we list-then-delete in pages. Used by account deletion + tenant offboarding.
 */

export interface PurgeResult {
	scanned: number;
	deleted: number;
	prefixes: string[];
}

const PAGE_SIZE = 1000;

export async function purgeKvByPrefix(
	kv: KVNamespace,
	prefix: string,
): Promise<{ scanned: number; deleted: number }> {
	let cursor: string | undefined;
	let scanned = 0;
	let deleted = 0;
	do {
		const list = await kv.list({ prefix, limit: PAGE_SIZE, cursor });
		scanned += list.keys.length;
		await Promise.all(list.keys.map((k) => kv.delete(k.name)));
		deleted += list.keys.length;
		cursor = list.list_complete ? undefined : list.cursor;
	} while (cursor);
	return { scanned, deleted };
}

export async function purgeKvByPrefixes(
	kv: KVNamespace,
	prefixes: string[],
): Promise<PurgeResult> {
	let scanned = 0;
	let deleted = 0;
	for (const p of prefixes) {
		const r = await purgeKvByPrefix(kv, p);
		scanned += r.scanned;
		deleted += r.deleted;
	}
	return { scanned, deleted, prefixes };
}
