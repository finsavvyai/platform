import type { ExecutiveDashboardData } from './types';

interface ApiDashboard {
  score?: { overall?: number };
}

interface ApiIncidents {
  data?: Array<{ severity?: string; status?: string }>;
}


function gradeFromScore(s: number): string {
  if (s >= 95) return 'A+';
  if (s >= 90) return 'A';
  if (s >= 85) return 'A-';
  if (s >= 80) return 'B+';
  if (s >= 75) return 'B';
  if (s >= 70) return 'B-';
  return 'C';
}

function riskFromScore(s: number): string {
  if (s >= 85) return 'Low';
  if (s >= 65) return 'Medium';
  return 'High';
}

export async function fetchExecutiveData(): Promise<ExecutiveDashboardData | null> {
  const [dashRes, incRes] = await Promise.allSettled([
    fetch('/api/proxy/security/dashboard').then((r) => r.json()),
    fetch('/api/proxy/security/incidents').then((r) => r.json()),
    fetch('/api/proxy/cloud/findings').then((r) => r.json()),
  ]);

  const dash: ApiDashboard | null = dashRes.status === 'fulfilled' ? dashRes.value : null;
  const inc: ApiIncidents | null = incRes.status === 'fulfilled' ? incRes.value : null;

  const score = dash?.score?.overall;
  if (typeof score !== 'number') return null;

  const openCritical = Array.isArray(inc?.data)
    ? inc.data.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length
    : 0;

  return {
    securityScore: score,
    securityScoreDelta: 0,
    grade: gradeFromScore(score),
    riskLevel: riskFromScore(score),
    kpis: {
      mttdHours: 0,
      mttdDelta: 0,
      mttrHours: 0,
      mttrDelta: 0,
      openCritical,
      openCriticalDelta: 0,
      complianceScore: score,
      complianceDelta: 0,
    },
    scoreTrend: [],
    riskDistribution: [],
    leaderboard: [],
    compliance: [],
    milestones: [],
  };
}
