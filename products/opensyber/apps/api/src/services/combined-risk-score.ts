/**
 * Combined risk score computation.
 *
 * Merges agent activity risk and CSPM findings risk into
 * a single 0-100 score with a letter grade.
 */

export interface AgentSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  secretsDetected: number;
}

export interface CspmSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface CombinedScore {
  agentScore: number;
  cspmScore: number;
  combined: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

function computeGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export function computeAgentScore(s: AgentSummary): number {
  return Math.max(
    0,
    100 - s.critical * 20 - s.high * 8 - s.medium * 2 - s.secretsDetected * 5,
  );
}

export function computeCspmScore(s: CspmSummary): number {
  return Math.max(0, 100 - s.critical * 15 - s.high * 5 - s.medium * 1);
}

export function computeCombinedRiskScore(
  agent: AgentSummary,
  cspm: CspmSummary,
): CombinedScore {
  const agentScore = computeAgentScore(agent);
  const cspmScore = computeCspmScore(cspm);
  const combined = Math.round(agentScore * 0.6 + cspmScore * 0.4);
  return { agentScore, cspmScore, combined, grade: computeGrade(combined) };
}
