/**
 * Activity-CSPM Linking Strategies
 *
 * Heuristic matching strategies for finding CSPM findings
 * related to agent activity events.
 */

import { and, or, like, eq, sql } from 'drizzle-orm';
import { escapeLike } from '../utils/escape-like.js';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { cspmFindings, agentActivity } from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;
type AgentActivity = typeof agentActivity.$inferSelect;

/**
 * Strategy 1: AWS credentials file access -> IAM findings
 */
export async function strategy1_CredentialsFile(
  db: Db,
  activity: AgentActivity,
  orgId: string | null,
): Promise<string[]> {
  if (activity.type !== 'file_read') {
    return [];
  }

  const path = activity.path || '';
  if (!path.includes('.aws/') || !path.includes('credentials')) {
    return [];
  }

  const findings = await db
    .select({ id: cspmFindings.id })
    .from(cspmFindings)
    .where(
      and(
        orgId ? sql`${cspmFindings.orgId} = ${orgId}` : undefined,
        sql`${cspmFindings.status} = 'open'`,
        like(cspmFindings.resourceType, '%iam%'),
      ),
    )
    .limit(5);

  return findings.map((f) => (f as { id: string }).id);
}

/**
 * Strategy 2: AWS CLI commands -> service-specific findings
 */
export async function strategy2_AwsCliCommands(
  db: Db,
  activity: AgentActivity,
  orgId: string | null,
): Promise<string[]> {
  if (activity.type !== 'bash_exec') {
    return [];
  }

  const summary = activity.summary.toLowerCase();
  if (!summary.startsWith('aws ')) {
    return [];
  }

  const servicePatterns: Record<string, string> = {
    'aws s3': '%s3%',
    'aws ec2': '%ec2%',
    'aws rds': '%rds%',
    'aws iam': '%iam%',
    'aws lambda': '%lambda%',
    'aws cloudtrail': '%cloudtrail%',
    'aws guardduty': '%guardduty%',
  };

  for (const [cliService, resourcePattern] of Object.entries(servicePatterns)) {
    if (summary.includes(cliService)) {
      const findings = await db
        .select({ id: cspmFindings.id })
        .from(cspmFindings)
        .where(
          and(
            orgId ? sql`${cspmFindings.orgId} = ${orgId}` : undefined,
            sql`${cspmFindings.status} = 'open'`,
            like(cspmFindings.resourceType, resourcePattern),
          ),
        )
        .limit(5);

      return findings.map((f) => (f as { id: string }).id);
    }
  }

  return [];
}

/**
 * Strategy 3: Resource ID extraction -> exact match
 */
export async function strategy3_ResourceExtraction(
  db: Db,
  activity: AgentActivity,
  orgId: string | null,
): Promise<string[]> {
  const text = (activity.summary + ' ' + (activity.path || '')).toLowerCase();

  const patterns = {
    securityGroup: /(?:sg-)[a-z0-9\-]+/gi,
    s3Bucket: /(?:s3:\/\/)[a-z0-9.\-]+/gi,
    iamUser: /(?:user\/)[a-z0-9\-]+/gi,
    iamRole: /(?:role\/)[a-z0-9\-]+/gi,
    ec2Instance: /(?:i-)[a-z0-9]+/gi,
    rdsInstance: /(?:db-)[a-z0-9]+/gi,
  };

  const extractedIds: string[] = [];

  for (const pattern of Object.values(patterns)) {
    const matches = text.match(pattern);
    if (matches) {
      extractedIds.push(...matches);
    }
  }

  if (extractedIds.length === 0) {
    return [];
  }

  const conditions = extractedIds.map((id) =>
    like(cspmFindings.resourceId, `%${escapeLike(id)}%`),
  );

  const findings = await db
    .select({ id: cspmFindings.id })
    .from(cspmFindings)
    .where(
      and(
        orgId ? sql`${cspmFindings.orgId} = ${orgId}` : undefined,
        sql`${cspmFindings.status} = 'open'`,
        or(...conditions),
      ),
    )
    .limit(5);

  return findings.map((f) => (f as { id: string }).id);
}

/**
 * Strategy 4: Secrets detection -> IAM access key findings
 */
export async function strategy4_SecretsDetection(
  db: Db,
  activity: AgentActivity,
  orgId: string | null,
): Promise<string[]> {
  if (activity.secretsCount === 0) {
    return [];
  }

  const findings = await db
    .select({ id: cspmFindings.id })
    .from(cspmFindings)
    .where(
      and(
        orgId ? sql`${cspmFindings.orgId} = ${orgId}` : undefined,
        sql`${cspmFindings.status} = 'open'`,
        like(cspmFindings.checkId, '%access%'),
      ),
    )
    .limit(5);

  return findings.map((f) => (f as { id: string }).id);
}
