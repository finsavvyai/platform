/**
 * Admin Panel Type Definitions
 */

import type { Plan } from './user.js';

export interface AdminStats {
  totalUsers: number;
  totalInstances: number;
  totalOrgs: number;
  totalEvents: number;
  activeInstances: number;
  trustFunnel: TrustFunnelSnapshot;
}

export interface TrustFunnelSnapshot {
  totalLeads: number;
  recentLeads7d: number;
  trustPageViews: number;
  recentViews7d: number;
  trustTrialStarts: number;
  trustSignupViews: number;
  trustDemoRequests: number;
  topSources: Array<{ source: string; count: number }>;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  isAdmin: boolean;
  isSuspended: boolean;
  instanceCount: number;
  orgCount: number;
  createdAt: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
}

export interface SkillModerationItem {
  id: string;
  name: string;
  description: string;
  submitterId: string;
  submitterName: string | null;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
}

export interface AdminBillingData {
  mrr: number;
  planDistribution: Record<Plan, number>;
  recentSubscriptions: AdminSubscriptionItem[];
}

export interface AdminSubscriptionItem {
  userId: string;
  userName: string | null;
  plan: Plan;
  startedAt: string;
}
