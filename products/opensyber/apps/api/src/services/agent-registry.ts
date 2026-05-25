/**
 * Agent Registry Service
 * Centralized tracking of all AI agents across IDE, Copilot, OpenAI, LangSmith, MCP
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import { agentRegistry } from '@opensyber/db';
import { eq } from 'drizzle-orm';

export interface Agent {
  id: string;
  userId: string;
  instanceId?: string;
  name: string;
  source: 'ide' | 'copilot' | 'openai-sdk' | 'langsmith' | 'mcp';
  owner?: string;
  permissions: string[];
  riskScore: number;
  status: 'active' | 'inactive' | 'suspended';
  lastActiveAt?: string;
  createdAt: string;
}

export interface RiskProfile {
  agentId: string;
  riskScore: number;
  factors: string[];
  recommendations: string[];
}

export const AGENT_SOURCES = {
  IDE: 'ide',
  COPILOT: 'copilot',
  OPENAI_SDK: 'openai-sdk',
  LANGSMITH: 'langsmith',
  MCP: 'mcp',
} as const;

export const AGENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export async function getAgentInventory(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
): Promise<Agent[]> {
  const agents = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.userId, userId));

  return agents
    .filter((a): a is NonNullable<typeof a> => a != null)
    .map((a) => ({
      id: a.id,
      userId: a.userId,
      instanceId: a.instanceId ?? undefined,
      name: a.name,
      source: a.source as Agent['source'],
      owner: a.owner ?? undefined,
      permissions: JSON.parse(a.permissions) as string[],
      riskScore: a.riskScore,
      status: a.status as Agent['status'],
      lastActiveAt: a.lastActiveAt ?? undefined,
      createdAt: a.createdAt,
    }));
}

export async function registerAgent(
  db: DrizzleD1Database<typeof schema>,
  agent: Omit<Agent, 'id' | 'createdAt'>,
): Promise<Agent> {
  const id = crypto.getRandomValues(new Uint8Array(16)).toString();
  const now = new Date().toISOString();

  await db.insert(agentRegistry).values({
    id,
    userId: agent.userId,
    instanceId: agent.instanceId,
    name: agent.name,
    source: agent.source,
    owner: agent.owner,
    permissions: JSON.stringify(agent.permissions),
    riskScore: agent.riskScore,
    status: agent.status,
    lastActiveAt: agent.lastActiveAt,
    createdAt: now,
  });

  return { ...agent, id, createdAt: now };
}

export async function updateAgentRisk(
  db: DrizzleD1Database<typeof schema>,
  agentId: string,
  riskScore: number,
): Promise<void> {
  await db
    .update(agentRegistry)
    .set({ riskScore: Math.min(100, Math.max(0, riskScore)) })
    .where(eq(agentRegistry.id, agentId));
}

export async function getAgentDetail(
  db: DrizzleD1Database<typeof schema>,
  agentId: string,
): Promise<Agent | null> {
  const result = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.id, agentId));

  const a = result[0];
  if (!a) return null;

  return {
    id: a.id,
    userId: a.userId,
    instanceId: a.instanceId ?? undefined,
    name: a.name,
    source: a.source as Agent['source'],
    owner: a.owner ?? undefined,
    permissions: JSON.parse(a.permissions) as string[],
    riskScore: a.riskScore,
    status: a.status as Agent['status'],
    lastActiveAt: a.lastActiveAt ?? undefined,
    createdAt: a.createdAt,
  };
}

export function assessAgentRisk(agent: Agent): RiskProfile {
  const factors: string[] = [];
  let score = agent.riskScore;

  if (agent.status === 'suspended') {
    factors.push('suspended-status');
  }

  if (agent.source === 'openai-sdk' || agent.source === 'langsmith') {
    factors.push('external-sdk-source');
    score = Math.min(100, score + 10);
  }

  if (!agent.instanceId) {
    factors.push('unbound-instance');
    score = Math.min(100, score + 5);
  }

  const recommendations: string[] = [];
  if (score >= 75) {
    recommendations.push('Review permissions and consider suspension');
  }
  if (score >= 50) {
    recommendations.push('Increase monitoring frequency');
  }
  if (agent.permissions.length === 0) {
    recommendations.push('Define explicit permissions for this agent');
  }

  return {
    agentId: agent.id,
    riskScore: score,
    factors,
    recommendations,
  };
}
