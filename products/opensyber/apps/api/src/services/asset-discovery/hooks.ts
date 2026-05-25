/**
 * Discovery Integration Hooks
 *
 * Triggers asset discovery after activity sync and CSPM scan completion.
 * These functions are designed to be called inline (sync) since the discovery
 * functions are pure and fast (< 50ms for 200 events).
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AgentActivityRecord, CspmFindingRecord } from './types.js';
import { discoverFromActivity } from './agent-activity-discoverer.js';
import { discoverFromCspmFindings } from './cspm-discoverer.js';
import { runDiscoveryPipeline } from './discovery-pipeline.js';

type Db = DrizzleD1Database<typeof import('@opensyber/db')>;

/**
 * Run asset discovery after an agent activity sync.
 * Call after inserting activity rows — discovers files, env vars, secrets.
 */
export async function discoverAfterActivitySync(
  db: Db,
  orgId: string,
  sessionId: string,
  agentName: string,
  activities: AgentActivityRecord[],
): Promise<{ assetsUpserted: number; relationsCreated: number }> {
  try {
    const { assets, relations } = discoverFromActivity(sessionId, agentName, activities);
    if (assets.length === 0) return { assetsUpserted: 0, relationsCreated: 0 };
    return await runDiscoveryPipeline(db, orgId, assets, relations);
  } catch (error) {
    console.error('[Discovery] Activity discovery failed:', error);
    return { assetsUpserted: 0, relationsCreated: 0 };
  }
}

/**
 * Run asset discovery after a CSPM scan completes.
 * Call after inserting CSPM findings — discovers cloud resources.
 */
export async function discoverAfterCspmScan(
  db: Db,
  orgId: string,
  findings: CspmFindingRecord[],
): Promise<{ assetsUpserted: number; relationsCreated: number }> {
  try {
    const { assets, relations } = discoverFromCspmFindings(findings);
    if (assets.length === 0) return { assetsUpserted: 0, relationsCreated: 0 };
    return await runDiscoveryPipeline(db, orgId, assets, relations);
  } catch (error) {
    console.error('[Discovery] CSPM discovery failed:', error);
    return { assetsUpserted: 0, relationsCreated: 0 };
  }
}
