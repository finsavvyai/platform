import type { RiskyUser, AnomalyEvent } from './types';

interface ApiAgent {
  id?: string;
  name?: string;
  riskScore?: number;
  events?: Array<{
    id?: string;
    type?: string;
    severity?: string;
    riskDelta?: number;
    timestamp?: string;
    description?: string;
  }>;
  status?: string;
  lastActivity?: string;
}

function mapSeverity(s?: string): 'Critical' | 'High' | 'Medium' | 'Low' {
  const v = (s ?? '').toLowerCase();
  if (v === 'critical') return 'Critical';
  if (v === 'high') return 'High';
  if (v === 'medium') return 'Medium';
  return 'Low';
}

function agentToUser(a: ApiAgent, idx: number): RiskyUser {
  const events = a.events ?? [];
  return {
    id: a.id ?? `agent-${idx}`,
    name: a.name ?? `Agent ${idx + 1}`,
    email: `agent-${idx}@org.local`,
    riskScore: a.riskScore ?? 0,
    anomalyCount: events.length,
    lastAnomaly: events[0]?.timestamp ?? a.lastActivity ?? '',
    status: a.status === 'suspended' ? 'Suspended' : 'Active',
  };
}

function agentToAnomalies(a: ApiAgent): AnomalyEvent[] {
  if (!Array.isArray(a.events)) return [];
  return a.events.map((ev, i) => ({
    id: ev.id ?? `${a.id}-ev-${i}`,
    userId: a.id ?? '',
    userName: a.name ?? 'Unknown',
    type: ev.type ?? 'Unknown event',
    severity: mapSeverity(ev.severity),
    riskDelta: ev.riskDelta ?? 0,
    time: ev.timestamp ?? new Date().toISOString(),
    description: ev.description ?? '',
  }));
}

interface BehaviorData {
  users: RiskyUser[];
  anomalies: AnomalyEvent[];
}

export async function fetchBehaviorData(): Promise<BehaviorData | null> {
  const res = await fetch('/api/proxy/agents');
  if (!res.ok) return null;
  const json = await res.json();

  const agents: ApiAgent[] = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json) ? json : [];

  if (!agents.length) return null;

  const users = agents
    .map(agentToUser)
    .sort((a, b) => b.riskScore - a.riskScore);

  const anomalies = agents
    .flatMap(agentToAnomalies)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { users, anomalies };
}
