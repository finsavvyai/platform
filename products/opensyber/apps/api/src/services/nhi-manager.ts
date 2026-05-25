/**
 * NHI (Non-Human Identity) Manager Service
 *
 * Manages AI agent identities: registration, risk scoring, orphan detection.
 */

export type NhiAgentType =
  | 'claude_code' | 'cursor' | 'windsurf' | 'copilot'
  | 'custom' | 'mcp_server' | 'ci_runner' | 'service_account';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface NhiAgent {
  id: string;
  name: string;
  type: NhiAgentType;
  ownerId: string | null;
  status: 'active' | 'suspended' | 'orphaned';
  riskLevel: RiskLevel;
  riskScore: number;
  lastActiveAt: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  tokenHash: string | null;
}

export interface NhiSummary {
  total: number;
  active: number;
  suspended: number;
  orphaned: number;
  riskDistribution: Record<RiskLevel, number>;
}

const TYPE_BASE_RISK: Record<NhiAgentType, number> = {
  claude_code: 10,
  cursor: 10,
  windsurf: 10,
  copilot: 10,
  custom: 40,
  mcp_server: 30,
  ci_runner: 20,
  service_account: 25,
};

/** Calculate risk score (0-100) based on agent type and properties */
export function calculateRiskScore(agent: {
  type: NhiAgentType;
  ownerId: string | null;
  lastActiveAt: string;
  tokenHash: string | null;
}): { score: number; level: RiskLevel } {
  let score = TYPE_BASE_RISK[agent.type] ?? 20;

  if (!agent.ownerId) score += 30;
  if (!agent.tokenHash) score += 15;

  const daysSinceActive = getDaysSince(agent.lastActiveAt);
  if (daysSinceActive > 90) score += 25;
  else if (daysSinceActive > 30) score += 15;
  else if (daysSinceActive > 7) score += 5;

  score = Math.min(100, Math.max(0, score));
  return { score, level: scoreToLevel(score) };
}

/** Detect orphaned agents: no owner or inactive 30+ days */
export function isOrphaned(agent: {
  ownerId: string | null;
  lastActiveAt: string;
}): boolean {
  if (!agent.ownerId) return true;
  return getDaysSince(agent.lastActiveAt) >= 30;
}

/** Build summary from a list of agents */
export function buildSummary(agents: NhiAgent[]): NhiSummary {
  const riskDistribution: Record<RiskLevel, number> = {
    low: 0, medium: 0, high: 0, critical: 0,
  };

  let active = 0;
  let suspended = 0;
  let orphaned = 0;

  for (const agent of agents) {
    riskDistribution[agent.riskLevel]++;
    if (agent.status === 'active') active++;
    else if (agent.status === 'suspended') suspended++;
    else if (agent.status === 'orphaned') orphaned++;
  }

  return {
    total: agents.length,
    active,
    suspended,
    orphaned,
    riskDistribution,
  };
}

/** Create a new NHI agent record */
export function createNhiAgent(input: {
  id: string;
  name: string;
  type: NhiAgentType;
  ownerId: string;
  metadata?: Record<string, unknown>;
}): NhiAgent {
  const now = new Date().toISOString();
  const risk = calculateRiskScore({
    type: input.type,
    ownerId: input.ownerId,
    lastActiveAt: now,
    tokenHash: null,
  });

  return {
    id: input.id,
    name: input.name,
    type: input.type,
    ownerId: input.ownerId,
    status: 'active',
    riskLevel: risk.level,
    riskScore: risk.score,
    lastActiveAt: now,
    createdAt: now,
    metadata: input.metadata ?? {},
    tokenHash: null,
  };
}

function getDaysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}
