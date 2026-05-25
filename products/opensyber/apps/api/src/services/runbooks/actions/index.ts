import type { ActionFn } from '../types.js';
import { callSkillAction } from './call-skill.js';
import { httpRequestAction } from './http-request.js';
import { dbUpdateAction } from './db-update.js';
import { notifyAction } from './notify.js';

/**
 * Registry of built-in runbook actions.
 *
 *  call_skill    — routes ai-triage / ai-explain / ai-compliance-writer
 *                  through services/ai/claude-client.ts
 *  http_request  — fetch with timeout + body cap + zod-shaped response
 *  db_update     — gated by services/runbooks/actions/db-update-allowlist.ts;
 *                  empty allowlist by default = fail-closed
 *  notify        — routes through services/alerts/dispatcher-core::dispatchAlerts
 *
 * Adding a new action:
 *   1. Implement an ActionFn in actions/<name>.ts
 *   2. Import here and register the kebab-case key
 *   3. Engine looks the action up by the exact string in step.action
 */
export const ACTIONS: Record<string, ActionFn> = {
  call_skill: callSkillAction,
  http_request: httpRequestAction,
  db_update: dbUpdateAction,
  notify: notifyAction,
};

export { callSkillAction, httpRequestAction, dbUpdateAction, notifyAction };
