export interface ExecutiveKpi {
  mttdHours: number;
  mttdDelta: number;
  mttrHours: number;
  mttrDelta: number;
  openCritical: number;
  openCriticalDelta: number;
  complianceScore: number;
  complianceDelta: number;
}

export interface SecurityScoreTrend {
  date: string;
  score: number;
}

export interface RiskDistribution {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TeamMember {
  name: string;
  role: string;
  findingsResolved: number;
  avgResolutionHours: number;
}

export interface ComplianceFramework {
  name: string;
  shortName: string;
  score: number;
  passed: number;
  failed: number;
  partial: number;
}

export interface Milestone {
  title: string;
  date: string;
  icon: 'shield' | 'check' | 'star' | 'lock' | 'award' | 'zap';
}

export interface ExecutiveDashboardData {
  securityScore: number;
  securityScoreDelta: number;
  grade: string;
  riskLevel: string;
  kpis: ExecutiveKpi;
  scoreTrend: SecurityScoreTrend[];
  riskDistribution: RiskDistribution[];
  leaderboard: TeamMember[];
  compliance: ComplianceFramework[];
  milestones: Milestone[];
}
