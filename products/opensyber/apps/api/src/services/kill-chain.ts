/**
 * Kill Chain Correlation Engine
 *
 * Detect multi-stage attacks across multiple integrations.
 * Rule 1: Phishing + MFA Anomaly = Critical
 * Rule 2: Supply Chain Attack
 * Rule 3: AI Agent Compromise
 */

export interface KillChainStage {
  integrationSlug: string;
  eventType: string;
  field?: string;
  value?: string | string[];
}

export interface KillChainRule {
  id: string;
  name: string;
  description: string;
  stages: KillChainStage[];
  timeWindowMinutes: number;
  severity: 'high' | 'critical';
}

export interface CorrelatedEvent {
  eventId: string;
  integrationSlug: string;
  eventType: string;
  createdAt: string;
  summary?: string;
}

export interface UnifiedIncident {
  id: string;
  ruleId: string;
  severity: string;
  status: 'open' | 'investigating' | 'resolved';
  correlatedEventIds: string[];
  summary: string;
  createdAt: string;
}

export const KILL_CHAIN_RULES: KillChainRule[] = [
  {
    id: 'kc-phishing-mfa',
    name: 'Phishing + MFA Anomaly',
    description: 'Phishing detected + risky signin within 30 min = critical incident',
    stages: [
      { integrationSlug: 'outlook', eventType: 'phishing_detected' },
      { integrationSlug: 'entra', eventType: 'risky_signin' },
    ],
    timeWindowMinutes: 30,
    severity: 'critical',
  },
  {
    id: 'kc-supply-chain',
    name: 'Supply Chain Attack',
    description: 'Dependabot alert + npm install + IAM change within 72hr = supply chain alert',
    stages: [
      { integrationSlug: 'github', eventType: 'dependabot_alert' },
      { integrationSlug: 'ide', eventType: 'npm_install' },
      { integrationSlug: 'cloudtrail', eventType: 'iam_change' },
    ],
    timeWindowMinutes: 4320,
    severity: 'critical',
  },
  {
    id: 'kc-ai-compromise',
    name: 'AI Agent Compromise',
    description: 'Suspicious command + filesystem enum + credential theft within 1hr = AI compromise',
    stages: [
      { integrationSlug: 'ide', eventType: 'suspicious_command' },
      { integrationSlug: 'agent', eventType: 'filesystem_enum' },
      { integrationSlug: 'cloudtrail', eventType: 'credential_theft' },
    ],
    timeWindowMinutes: 60,
    severity: 'critical',
  },
];

/**
 * Evaluate kill chain rules for a new event.
 * Check if event completes any multi-stage attack pattern.
 */
export async function evaluateKillChain(
  db: any,
  newEvent: {
    integrationSlug: string;
    eventType: string;
    userId?: string;
    createdAt: string;
  },
): Promise<UnifiedIncident[]> {
  const incidents: UnifiedIncident[] = [];

  for (const rule of KILL_CHAIN_RULES) {
    const correlated = await findCorrelatedEvents(db, rule, newEvent);
    if (correlated.length === rule.stages.length) {
      const incident = await createUnifiedIncident(db, rule, correlated);
      incidents.push(incident);
    }
  }

  return incidents;
}

/**
 * Find events from other stages of a kill chain rule within the time window.
 */
export async function findCorrelatedEvents(
  db: any,
  rule: KillChainRule,
  newEvent: { integrationSlug: string; eventType: string; createdAt: string; userId?: string },
): Promise<CorrelatedEvent[]> {
  const windowStart = new Date(new Date(newEvent.createdAt).getTime() - rule.timeWindowMinutes * 60 * 1000);

  // In a real implementation, query integrationEvents table
  // For now, return events that match stages
  const events: CorrelatedEvent[] = [
    {
      eventId: crypto.randomUUID(),
      integrationSlug: newEvent.integrationSlug,
      eventType: newEvent.eventType,
      createdAt: newEvent.createdAt,
    },
  ];

  // Pseudo-code: db.select().from(integrationEvents).where(
  //   and(
  //     inArray(integrationSlug, rule.stages.map(s => s.integrationSlug)),
  //     gte(createdAt, windowStart.toISOString()),
  //     lte(createdAt, newEvent.createdAt)
  //   )
  // )

  return events;
}

/**
 * Create a unified incident from correlated kill chain events.
 */
export async function createUnifiedIncident(
  db: any,
  rule: KillChainRule,
  events: CorrelatedEvent[],
): Promise<UnifiedIncident> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // In a real implementation, insert into killChainIncidents table
  // await db.insert(killChainIncidents).values({
  //   id, ruleId: rule.id, userId: events[0]?.userId, severity: rule.severity,
  //   status: 'open', correlatedEventIds: JSON.stringify(events.map(e => e.eventId)),
  //   summary: rule.description, createdAt: now
  // })

  return {
    id,
    ruleId: rule.id,
    severity: rule.severity,
    status: 'open',
    correlatedEventIds: events.map((e) => e.eventId),
    summary: rule.description,
    createdAt: now,
  };
}
