/**
 * Specialized alert dispatchers
 *
 * Higher-level dispatch functions for violation alerts, CSPM alerts,
 * and test alerts. Built on top of the core dispatchAlerts function.
 */

import { eq } from 'drizzle-orm';
import { alertChannels } from '@opensyber/db';
import type { AlertMessage, AlertResult } from './types.js';
import { sendToChannel } from './index.js';
import type { Db, Kv, AlertChannelRecord, AlertFinding } from './dispatcher-types.js';
import type { DispatchResult } from './dispatcher-types.js';
import { dispatchAlerts, parseChannelConfig } from './dispatcher-core.js';

/**
 * Dispatch violation alerts from policy engine
 *
 * Called when agent policy violations are detected.
 * Creates alert message and dispatches to active channels.
 */
export async function dispatchViolationAlerts(
  db: Db,
  kv: Kv | undefined,
  params: {
    orgId: string | null;
    violations: Array<{
      policyId: string;
      policyName: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      resourceId: string;
      resourceType: string;
      description: string;
    }>;
    organization?: string;
    account?: string;
    dashboardUrl?: string;
    decryptFn?: (encrypted: string) => Promise<string>;
  },
): Promise<DispatchResult> {
  if (params.violations.length === 0) {
    return {
      totalChannels: 0, successful: 0, failed: 0, skipped: 0, results: new Map(),
    };
  }

  const severityOrder = ['critical', 'high', 'medium', 'low'] as const;
  const highestSeverity = severityOrder.find(
    (s) => params.violations.some((v) => v.severity === s),
  ) ?? 'low';

  const findings: AlertFinding[] = params.violations.map((v) => ({
    checkId: v.policyId,
    severity: v.severity,
    resourceId: v.resourceId,
    resourceType: v.resourceType,
    region: 'global',
    title: v.policyName,
    description: v.description,
    remediation: `Review policy settings in the dashboard.`,
  }));

  const count = params.violations.length;
  const title = `${count} Policy Violation${count > 1 ? 's' : ''} Detected`;

  return dispatchAlerts(db, kv, {
    orgId: params.orgId,
    severity: highestSeverity,
    title,
    description: `${count} agent policy violation${count > 1 ? 's have' : ' has'} been detected and requires attention.`,
    findings,
    organization: params.organization,
    account: params.account,
    dashboardUrl: params.dashboardUrl,
    decryptFn: params.decryptFn,
  });
}

/**
 * Dispatch CSPM scan alerts
 *
 * Called after CSPM scan completes with findings.
 * Creates alert message and dispatches to active channels.
 */
export async function dispatchCspmAlerts(
  db: Db,
  kv: Kv | undefined,
  params: {
    orgId: string | null;
    findings: Array<{
      id: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      resourceId: string;
      resourceType: string;
      region: string;
      title: string;
      description: string;
      remediation: string;
    }>;
    cloudAccountName?: string;
    organization?: string;
    dashboardUrl?: string;
    decryptFn?: (encrypted: string) => Promise<string>;
  },
): Promise<DispatchResult> {
  if (params.findings.length === 0) {
    return {
      totalChannels: 0, successful: 0, failed: 0, skipped: 0, results: new Map(),
    };
  }

  const severityOrder = ['critical', 'high', 'medium', 'low'] as const;
  const highestSeverity = severityOrder.find(
    (s) => params.findings.some((f) => f.severity === s),
  ) ?? 'low';

  const count = params.findings.length;
  const title = `${count} Security Finding${count > 1 ? 's' : ''} Detected`;

  return dispatchAlerts(db, kv, {
    orgId: params.orgId,
    severity: highestSeverity,
    title,
    description: `${count} security finding${count > 1 ? 's have' : ' has'} been detected in your cloud environment.`,
    findings: params.findings.map((f) => ({
      checkId: 'cspm',
      severity: f.severity,
      resourceId: f.resourceId,
      resourceType: f.resourceType,
      region: f.region ?? 'unknown',
      title: f.title,
      description: f.description ?? '',
      remediation: f.remediation ?? 'See dashboard for details.',
    })),
    organization: params.organization,
    account: params.cloudAccountName,
    dashboardUrl: params.dashboardUrl,
    decryptFn: params.decryptFn,
  });
}

/**
 * Send test alert to a specific channel
 *
 * Used by the test endpoint to verify channel configuration.
 */
export async function sendTestAlert(
  db: Db,
  channelId: string,
  decryptFn?: (encrypted: string) => Promise<string>,
): Promise<AlertResult> {
  const [channel] = await db
    .select()
    .from(alertChannels)
    .where(eq(alertChannels.id, channelId));

  if (!channel) {
    return { success: false, error: 'Channel not found' };
  }

  if (!channel.isActive) {
    return { success: false, error: 'Channel is not active' };
  }

  try {
    const config = await parseChannelConfig(
      channel as AlertChannelRecord,
      decryptFn,
    );
    const message: AlertMessage = {
      id: `test-alert-${Date.now()}`,
      severity: 'low',
      title: 'OpenSyber Test Alert',
      description: 'This is a test alert to verify your notification channel is configured correctly.',
      findings: [],
      timestamp: new Date().toISOString(),
      organization: 'OpenSyber',
      dashboardUrl: 'https://opensyber.cloud/dashboard',
    };
    return sendToChannel(message, config);
  } catch (error) {
    return {
      success: false,
      error: `Failed to send test alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
