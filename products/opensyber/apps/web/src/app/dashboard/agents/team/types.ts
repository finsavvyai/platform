export interface TeamSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  secretsDetected: number;
  uniqueUsers: number;
}

export interface TeamMember {
  userId: string;
  name?: string;
  email?: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  secretsDetected: number;
  riskScore?: number;
  lastActivityAt?: string | null;
}

export interface RiskScore {
  combined: number;
  agent: number;
  cspm: number;
  grade: string;
}

export function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-green-400';
  if (grade === 'B') return 'text-info';
  if (grade === 'C') return 'text-amber-400';
  if (grade === 'D') return 'text-orange-400';
  return 'text-red-400';
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
