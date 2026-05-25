export interface Alert {
  id: string;
  tenantId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  component: string;
  threshold?: number;
  current?: number;
  createdAt: Date;
  resolvedAt?: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertRule {
  id: string;
  tenantId: string;
  metric: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  createdAt: Date;
}
