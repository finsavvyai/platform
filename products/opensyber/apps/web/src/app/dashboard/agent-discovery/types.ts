export interface DiscoveredAgentRow {
  id: string;
  name: string;
  framework: string;
  runtime: string;
  surfaceType: string;
  locationPath: string | null;
  status: 'unsecured' | 'protected' | 'ignored';
  lastSeenAt: string;
  riskScore: number;
  riskSeverity: 'low' | 'medium' | 'high' | 'critical';
  ownerUserId: string | null;
  ownerTeamId: string | null;
  protected: boolean;
}
