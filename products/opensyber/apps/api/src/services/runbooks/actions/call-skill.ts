import { z } from 'zod';
import type { ActionFn } from '../types.js';
import {
  explainThreat,
  classifyRisk,
  generateComplianceNarrative,
  type ThreatEvent,
  type ControlEvidence,
} from '../../ai/claude-client.js';

/**
 * call_skill action — invoke a registered AI skill via the existing Claude
 * client. Skills today are typed entry points into the same Anthropic-backed
 * pipeline, so we route through the existing service rather than duplicating
 * a Claude wrapper.
 *
 * Supported skill ids (kebab-case, matches the on-disk skill manifests):
 *   - ai-triage             → classifyRisk: returns {riskLevel, confidence, reasoning}
 *   - ai-explain            → explainThreat: returns natural-language summary
 *   - ai-compliance-writer  → generateComplianceNarrative: returns SOC2 prose
 *
 * env.ANTHROPIC_API_KEY is read from ctx.services.env. Returns ok=false with
 * a clear error when the key is missing — fail-closed on missing config.
 *
 * Adding a new skill: branch on params.skill_id and dispatch to the existing
 * AI service. Do NOT add a new Claude client here.
 */

const triageParams = z.object({
  skill_id: z.literal('ai-triage'),
  event_description: z.string().min(1),
});

const explainParams = z.object({
  skill_id: z.literal('ai-explain'),
  event: z.object({
    eventId: z.string(),
    eventType: z.string(),
    details: z.string(),
    severity: z.string().optional(),
    source: z.string().optional(),
  }),
});

const complianceParams = z.object({
  skill_id: z.literal('ai-compliance-writer'),
  controls: z.array(
    z.object({
      controlId: z.string(),
      status: z.string(),
      evidence: z.string(),
    }),
  ),
});

const skillParams = z.discriminatedUnion('skill_id', [
  triageParams,
  explainParams,
  complianceParams,
]);

export const callSkillAction: ActionFn = async (step, ctx) => {
  const parsed = skillParams.safeParse(step.params);
  if (!parsed.success) {
    return { ok: false, error: `call_skill: invalid params: ${parsed.error.message}` };
  }

  const env = ctx.services.env as Record<string, string> | undefined;
  const apiKey = env?.ANTHROPIC_API_KEY ?? env?.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'call_skill: no Anthropic API key configured (env.ANTHROPIC_API_KEY)',
    };
  }

  try {
    if (parsed.data.skill_id === 'ai-triage') {
      const result = await classifyRisk(apiKey, parsed.data.event_description);
      return {
        ok: true,
        output: { skill_id: 'ai-triage', step_id: step.id, run_id: ctx.runId, result },
      };
    }
    if (parsed.data.skill_id === 'ai-explain') {
      const text = await explainThreat(apiKey, parsed.data.event as ThreatEvent);
      return {
        ok: true,
        output: { skill_id: 'ai-explain', step_id: step.id, run_id: ctx.runId, text },
      };
    }
    const text = await generateComplianceNarrative(
      apiKey,
      parsed.data.controls as ControlEvidence[],
    );
    return {
      ok: true,
      output: { skill_id: 'ai-compliance-writer', step_id: step.id, run_id: ctx.runId, text },
    };
  } catch (err) {
    return {
      ok: false,
      error: `call_skill: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};
