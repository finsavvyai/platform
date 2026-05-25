import { api } from './client';
import type { DashboardAnalytics } from '../types';

export const analyticsApi = {
  getDashboard: () => api.get<DashboardAnalytics>('/analytics'),
};
