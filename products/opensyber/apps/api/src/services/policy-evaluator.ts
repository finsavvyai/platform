/**
 * Agent policy evaluator.
 *
 * Checks each agent activity event against all active policies
 * for the org and creates violation records.
 */

import { eq, and } from 'drizzle-orm';
import { agentPolicies, agentPolicyViolations } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type Db = DrizzleD1Database<Record<string, unknown>>;
type Severity = 'critical' | 'high' | 'medium' | 'low';
type RuleType = 'file_pattern' | 'command_pattern' | 'risk_threshold' | 'secrets_threshold';

interface ActivityEvent {
  id: string;
  userId: string;
  type: string;
  risk: string;
  path: string | null;
  summary: string;
  secretsCount: number;
}

interface PolicyRow {
  id: string;
  orgId: string;
  name: string;
  ruleType: string;
  ruleConfig: string;
  severity: string;
  isActive: boolean | number;
}

interface Violation {
  id: string;
  policyId: string;
  orgId: string;
  activityId: string;
  userId: string;
  severity: Severity;
  summary: string;
}

const RISK_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function matchesPattern(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(text);
  } catch {
    return text.includes(pattern);
  }
}

function checkViolation(
  policy: PolicyRow,
  event: ActivityEvent,
): string | null {
  const ruleType = policy.ruleType as RuleType;
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(policy.ruleConfig) as Record<string, unknown>;
  } catch {
    return null;
  }

  switch (ruleType) {
    case 'file_pattern': {
      if (event.type !== 'file_read' || !event.path) return null;
      const pattern = config.pattern as string | undefined;
      if (!pattern) return null;
      if (matchesPattern(event.path, pattern)) {
        return `File access matched policy "${policy.name}": ${event.path}`;
      }
      return null;
    }
    case 'command_pattern': {
      if (event.type !== 'bash_exec') return null;
      const pattern = config.pattern as string | undefined;
      if (!pattern) return null;
      if (matchesPattern(event.summary, pattern)) {
        return `Command matched policy "${policy.name}": ${event.summary}`;
      }
      return null;
    }
    case 'risk_threshold': {
      const maxRisk = config.maxRisk as string | undefined;
      if (!maxRisk) return null;
      const threshold = RISK_ORDER[maxRisk] ?? 2;
      const eventLevel = RISK_ORDER[event.risk] ?? 0;
      if (eventLevel > threshold) {
        return `Risk level "${event.risk}" exceeds threshold "${maxRisk}" (policy: ${policy.name})`;
      }
      return null;
    }
    case 'secrets_threshold': {
      const maxSecrets = config.maxSecrets as number | undefined;
      if (maxSecrets === undefined) return null;
      if (event.secretsCount > maxSecrets) {
        return `Secrets count ${event.secretsCount} exceeds limit ${maxSecrets} (policy: ${policy.name})`;
      }
      return null;
    }
    default:
      return null;
  }
}

export async function evaluateActivity(
  db: Db,
  orgId: string,
  event: ActivityEvent,
): Promise<Violation[]> {
  const policies = await db
    .select()
    .from(agentPolicies)
    .where(
      and(eq(agentPolicies.orgId, orgId), eq(agentPolicies.isActive, true)),
    );

  const violations: Violation[] = [];

  for (const policy of policies) {
    const reason = checkViolation(policy, event);
    if (reason) {
      violations.push({
        id: crypto.randomUUID(),
        policyId: policy.id,
        orgId,
        activityId: event.id,
        userId: event.userId,
        severity: policy.severity as Severity,
        summary: reason,
      });
    }
  }

  if (violations.length > 0) {
    await db.insert(agentPolicyViolations).values(violations);
  }

  return violations;
}
