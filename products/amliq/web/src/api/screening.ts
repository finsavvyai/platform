import { api } from './client';
import type { ScreenResponse } from '../types';

export interface ScreenPayload {
  entity_name: string;
  entity_type?: string;
  dob?: string;
  nationality?: string;
  lists?: string[];
  threshold?: number;
}

export interface FastScreenResult {
  match: boolean;
  confidence: number;
  matched_name?: string;
  list_id?: string;
}

export interface ScreeningQuota {
  used: number;
  limit: number;
  remaining: number;
  plan_name: string;
  has_subscription: boolean;
}

export const screeningApi = {
  screen: (data: ScreenPayload) =>
    api.post<ScreenResponse>('/screen', data),
  screenFast: (name: string) =>
    api.post<FastScreenResult>('/screen/fast', { name }),
  getResult: (id: string) =>
    api.get<ScreenResponse>(`/screen/${id}`),
  getQuota: () =>
    api.get<ScreeningQuota>(`/screening/quota?t=${Date.now()}`),
};
