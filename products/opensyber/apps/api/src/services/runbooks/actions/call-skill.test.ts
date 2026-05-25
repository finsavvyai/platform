import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callSkillAction } from './call-skill.js';
import type { RunbookContext } from '../types.js';

vi.mock('../../ai/claude-client.js', () => ({
  classifyRisk: vi.fn(async () => ({
    riskLevel: 'high',
    confidence: 0.92,
    reasoning: 'PII exposed in error logs',
  })),
  explainThreat: vi.fn(async () => 'A short natural-language explanation.'),
  generateComplianceNarrative: vi.fn(async () => 'SOC2 narrative paragraph...'),
}));

const ctxWithKey: RunbookContext = {
  runId: 'run-1', runbookId: 'rb-1', triggerAlertId: null,
  ownerUserId: 'u-1', orgId: 'org-1',
  prevOutputs: {}, params: {},
  services: { env: { ANTHROPIC_API_KEY: 'sk-test' } },
};

describe('call_skill action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails when no API key in services.env', async () => {
    const ctx = { ...ctxWithKey, services: { env: {} } };
    const r = await callSkillAction(
      {
        id: 's1', action: 'call_skill',
        params: { skill_id: 'ai-triage', event_description: 'leak' },
        on_error: { mode: 'fail' },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no Anthropic API key/);
  });

  it('rejects unknown skill_id', async () => {
    const r = await callSkillAction(
      {
        id: 's1', action: 'call_skill',
        params: { skill_id: 'invented-skill', x: 1 },
        on_error: { mode: 'fail' },
      },
      ctxWithKey,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid params/);
  });

  it('routes ai-triage to classifyRisk and returns its result', async () => {
    const r = await callSkillAction(
      {
        id: 's1', action: 'call_skill',
        params: { skill_id: 'ai-triage', event_description: 'PII leak' },
        on_error: { mode: 'fail' },
      },
      ctxWithKey,
    );
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({
      skill_id: 'ai-triage',
      run_id: 'run-1',
      step_id: 's1',
      result: { riskLevel: 'high', confidence: 0.92 },
    });
  });

  it('routes ai-explain to explainThreat', async () => {
    const r = await callSkillAction(
      {
        id: 's1', action: 'call_skill',
        params: {
          skill_id: 'ai-explain',
          event: { eventId: 'e1', eventType: 'phishing', details: 'header anomaly' },
        },
        on_error: { mode: 'fail' },
      },
      ctxWithKey,
    );
    expect(r.ok).toBe(true);
    expect((r.output as { text: string }).text).toContain('explanation');
  });

  it('routes ai-compliance-writer to generateComplianceNarrative', async () => {
    const r = await callSkillAction(
      {
        id: 's1', action: 'call_skill',
        params: {
          skill_id: 'ai-compliance-writer',
          controls: [{ controlId: 'CC1.1', status: 'satisfied', evidence: 'audit log' }],
        },
        on_error: { mode: 'fail' },
      },
      ctxWithKey,
    );
    expect(r.ok).toBe(true);
    expect((r.output as { text: string }).text).toContain('SOC2');
  });
});
