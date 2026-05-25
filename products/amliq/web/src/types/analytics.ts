export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface DashboardAnalytics {
  screeningVolume: ChartDataPoint[];
  dispositionBreakdown: Array<{ name: string; value: number; color: string }>;
  riskDistribution: Array<{ level: string; count: number; percentage: number }>;
  topEntities: Array<{ name: string; alerts: number; risk: string }>;
  avgResolutionTime: number;
  totalAlerts: number;
  clearedAlerts: number;
  escalatedAlerts: number;
}
