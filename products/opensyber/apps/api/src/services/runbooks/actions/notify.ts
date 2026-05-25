import { z } from 'zod';
import type { ActionFn } from '../types.js';
import { dispatchAlerts } from '../../alerts/dispatcher-core.js';
import type { Db, Kv, AlertFinding } from '../../alerts/dispatcher-types.js';

/**
 * Notify action — dispatch a runbook event to the org's configured alert
 * channels (email, Slack, Teams, PagerDuty, OpsGenie, Discord).
 *
 * Routes through the existing services/alerts/dispatcher-core::dispatchAlerts
 * which handles channel resolution, severity filtering, rate limiting, config
 * decryption, and per-channel send. We do NOT add a parallel dispatch path —
 * one source of truth.
 *
 * Example step:
 *   { action: "notify",
 *     params: { severity: "high", title: "Phishing detected",
 *               description: "Flagged by ai-triage",
 *               findings: [{ id, title, severity }] } }
 *
 * Severity is required (the dispatcher enforces minSeverity per channel).
 */

const findingSchema = z.object({
  checkId: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  resourceId: z.string(),
  resourceType: z.string(),
  region: z.string(),
  title: z.string(),
  description: z.string(),
  remediation: z.string(),
});

const paramsSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string().min(1),
  description: z.string().min(1),
  findings: z.array(findingSchema).default([]),
  organization: z.string().optional(),
  account: z.string().optional(),
  dashboardUrl: z.string().url().optional(),
});

export const notifyAction: ActionFn = async (step, ctx) => {
  const parsed = paramsSchema.safeParse(step.params);
  if (!parsed.success) {
    return { ok: false, error: `notify: invalid params: ${parsed.error.message}` };
  }

  const db = ctx.services.db as Db | undefined;
  if (!db) {
    return { ok: false, error: 'notify: services.db not provided' };
  }
  const kv = ctx.services.kv as Kv | undefined;
  const decryptFn = ctx.services.decryptFn;

  const result = await dispatchAlerts(db, kv, {
    orgId: ctx.orgId,
    severity: parsed.data.severity,
    title: parsed.data.title,
    description: parsed.data.description,
    findings: parsed.data.findings as AlertFinding[],
    organization: parsed.data.organization,
    account: parsed.data.account,
    dashboardUrl: parsed.data.dashboardUrl,
    decryptFn,
  });

  return {
    ok: true,
    output: {
      run_id: ctx.runId,
      step_id: step.id,
      total_channels: result.totalChannels,
      successful: result.successful,
      failed: result.failed,
      skipped: result.skipped,
    },
  };
};
