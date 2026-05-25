/**
 * Alert dispatcher types and message builder
 *
 * Shared types used by the dispatcher, rate limiter, and specialized dispatchers.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AlertMessage, AlertResult, AlertSeverity } from './types.js';

export type Db = DrizzleD1Database<Record<string, unknown>>;
export type Kv = KVNamespace;

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Channel record from database
 */
export interface AlertChannelRecord {
  id: string;
  orgId: string;
  channelType: string;
  name: string;
  config: string;
  minSeverity: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dispatch result summary
 */
export interface DispatchResult {
  totalChannels: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Map<string, AlertResult>;
}

/**
 * Findings for alert
 */
export interface AlertFinding {
  checkId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resourceId: string;
  resourceType: string;
  region: string;
  title: string;
  description: string;
  remediation: string;
}

/**
 * Build alert message from findings
 */
export function buildAlertMessage(params: {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  findings: AlertFinding[];
  organization?: string;
  account?: string;
  dashboardUrl?: string;
}): AlertMessage {
  return {
    id: params.id,
    severity: params.severity,
    title: params.title,
    description: params.description,
    findings: params.findings,
    timestamp: new Date().toISOString(),
    organization: params.organization,
    account: params.account,
    dashboardUrl: params.dashboardUrl,
  };
}
