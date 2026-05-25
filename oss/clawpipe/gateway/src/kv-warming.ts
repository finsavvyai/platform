/** KV cache warming — pre-populate hot keys after a cold start.
 *
 * Called from scheduled() and (idempotently) from the first request of a
 * fresh isolate. Hits the top-N most-frequent prompt hashes from the last
 * hour and writes them to KV so the next request returns a CACHE HIT
 * without going to D1.
 *
 * KV is already replicated globally by Cloudflare; this module exists so
 * that a freshly-rolled-out worker doesn't pay D1 round-trip on every
 * warm-up request.
 */

import type { Env } from './types';

const WARM_KEY_LIMIT = 25;
const WARM_TTL_SEC = 600;
const KV_PREFIX = 'warm:';

interface CacheRow { prompt_hash: string; response: string; project_id: string }

/** Read the N most-frequently-accessed prompt hashes from D1 (last hour). */
export async function loadHotEntries(env: Env, limit: number = WARM_KEY_LIMIT): Promise<CacheRow[]> {
  const rows = await env.DB.prepare(`
    SELECT c.prompt_hash, c.response, c.project_id
    FROM cache_entries c
    JOIN (
      SELECT prompt_hash, COUNT(*) AS hits
        FROM requests
       WHERE created_at > datetime('now', '-1 hour')
       GROUP BY prompt_hash
       ORDER BY hits DESC
       LIMIT ?
    ) hot ON hot.prompt_hash = c.prompt_hash
  `).bind(limit).all<CacheRow>();
  return rows.results ?? [];
}

/** Write each hot entry to KV under `warm:<projectId>:<hash>` for WARM_TTL_SEC. */
export async function pushToKv(env: Env, rows: CacheRow[]): Promise<number> {
  let written = 0;
  for (const row of rows) {
    if (!row.prompt_hash || !row.response) continue;
    await env.CACHE.put(
      `${KV_PREFIX}${row.project_id}:${row.prompt_hash}`,
      row.response,
      { expirationTtl: WARM_TTL_SEC },
    );
    written++;
  }
  return written;
}

/** Run a warming pass. Returns counts for logging. Errors are caught so a
 *  KV/D1 hiccup doesn't crash the scheduled handler. */
export async function warmCache(env: Env): Promise<{ scanned: number; written: number }> {
  try {
    const rows = await loadHotEntries(env);
    const written = await pushToKv(env, rows);
    return { scanned: rows.length, written };
  } catch {
    return { scanned: 0, written: 0 };
  }
}

/** Read a previously-warmed entry. Returns null on miss. */
export async function readWarm(env: Env, projectId: string, hash: string): Promise<string | null> {
  return await env.CACHE.get(`${KV_PREFIX}${projectId}:${hash}`);
}
