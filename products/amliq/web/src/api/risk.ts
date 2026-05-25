import { api } from './client';

export interface RiskScoreRequest {
  entity_name: string;
  entity_type?: string;
  country?: string;
  factors?: Record<string, unknown>;
}

export interface RiskScoreResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  weight: number;
  contribution: number;
  description: string;
}

export const riskApi = {
  score: (payload: RiskScoreRequest) =>
    api.post<RiskScoreResult>('/risk/score', payload),
};
