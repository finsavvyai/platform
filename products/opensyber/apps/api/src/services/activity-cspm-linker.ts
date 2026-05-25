/**
 * Activity-CSPM Cross-Linker Service
 *
 * Finds related CSPM findings for agent activity events using
 * heuristic matching strategies.
 */

import { and, inArray, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { cspmFindings, agentActivity } from '@opensyber/db';
import {
  strategy1_CredentialsFile,
  strategy2_AwsCliCommands,
  strategy3_ResourceExtraction,
  strategy4_SecretsDetection,
} from './activity-cspm-strategies.js';

type Db = DrizzleD1Database<Record<string, unknown>>;
type AgentActivity = typeof agentActivity.$inferSelect;

/**
 * Related CSPM finding result
 */
export interface RelatedFinding {
  id: string;
  severity: string;
  resourceId: string;
  resourceType: string;
  title: string;
}

/**
 * Find CSPM findings related to an agent activity event
 *
 * Uses multiple heuristic strategies to match activity to findings:
 * 1. AWS credentials file access -> IAM findings
 * 2. AWS CLI commands -> service-specific findings
 * 3. Resource ID extraction (sg-xxx, s3://xxx) -> exact match
 * 4. Secrets detected -> IAM access key findings
 */
export async function findRelatedFindings(
  db: Db,
  activity: AgentActivity,
  orgId: string | null,
): Promise<RelatedFinding[]> {
  const strategies = [
    strategy1_CredentialsFile,
    strategy2_AwsCliCommands,
    strategy3_ResourceExtraction,
    strategy4_SecretsDetection,
  ];

  // Run all strategies and collect unique finding IDs
  const findingIds = new Set<string>();

  for (const strategy of strategies) {
    const ids = await strategy(db, activity, orgId);
    ids.forEach((id) => findingIds.add(id));

    // Stop early if we have enough findings
    if (findingIds.size >= 5) {
      break;
    }
  }

  // No findings found
  if (findingIds.size === 0) {
    return [];
  }

  // Fetch the findings (max 5)
  const idArray = Array.from(findingIds).slice(0, 5);
  const findings = await db
    .select({
      id: cspmFindings.id,
      severity: cspmFindings.severity,
      resourceId: cspmFindings.resourceId,
      resourceType: cspmFindings.resourceType,
      title: cspmFindings.title,
    })
    .from(cspmFindings)
    .where(
      and(
        orgId ? eq(cspmFindings.orgId, orgId) : undefined,
        eq(cspmFindings.status, 'open'),
        idArray.length > 0 ? inArray(cspmFindings.id, idArray) : undefined,
      ),
    )
    .orderBy(cspmFindings.severity)
    .limit(5);

  return findings as RelatedFinding[];
}
