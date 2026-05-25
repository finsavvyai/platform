import { Entity, Identifier } from './entity';

export type AlertStatus = 'open' | 'investigating' | 'resolved' | 'archived';
export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';
export type AlertResolution = 'true_positive' | 'false_positive' | 'escalated' | 'pending';

export interface Alert {
  id: string;
  entity: Entity;
  screeningId: string;
  matchedCount: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  status: AlertStatus;
  priority: AlertPriority;
  resolution?: AlertResolution;
  investigator?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  duoAt?: string;
  aiDraftReason?: string;
  evidenceCount: number;
}

export interface AlertFilter {
  status?: AlertStatus[];
  priority?: AlertPriority[];
  riskLevel?: string[];
  dateRange?: [string, string];
  search?: string;
}
