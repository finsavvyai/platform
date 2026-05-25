import type { ThreatLevel, Factor } from './types';
import { getLevel } from './types';

interface SecurityDashboard {
  score?: { overall?: number };
}

interface IncidentSummary {
  data?: Array<{ status?: string }>;
}

const DEFAULT_FACTORS: Factor[] = [
  { name: 'Active Incidents', score: 0, weight: 25, trend: 'stable' },
  { name: 'Vulnerability Exposure', score: 0, weight: 20, trend: 'stable' },
  { name: 'Agent Risk', score: 0, weight: 15, trend: 'stable' },
  { name: 'Cloud Posture', score: 0, weight: 15, trend: 'stable' },
  { name: 'Identity Risk', score: 0, weight: 15, trend: 'stable' },
  { name: 'Compliance Gap', score: 0, weight: 10, trend: 'stable' },
];

function computeThreatFromApi(
  dashboard: SecurityDashboard,
  incidents: IncidentSummary,
): ThreatLevel | null {
  const secScore = dashboard?.score?.overall;
  if (typeof secScore !== 'number') return null;

  const threatScore = Math.max(0, Math.min(100, 100 - secScore));
  const openCount = Array.isArray(incidents?.data)
    ? incidents.data.filter((i) => i.status !== 'resolved').length
    : 0;

  const factors: Factor[] = DEFAULT_FACTORS.map((f) => {
    if (f.name === 'Active Incidents') {
      return { ...f, score: Math.min(100, openCount * 13) };
    }
    return f;
  });

  return {
    score: threatScore,
    level: getLevel(threatScore),
    delta: 0,
    factors,
  };
}

export async function fetchThreatLevel(): Promise<ThreatLevel | null> {
  const [dashRes, incRes] = await Promise.allSettled([
    fetch('/api/proxy/security/dashboard').then((r) => r.json()),
    fetch('/api/proxy/security/incidents').then((r) => r.json()),
  ]);

  const dashboard = dashRes.status === 'fulfilled' ? dashRes.value : null;
  const incidents = incRes.status === 'fulfilled' ? incRes.value : null;

  if (!dashboard && !incidents) return null;
  return computeThreatFromApi(dashboard ?? {}, incidents ?? {});
}
