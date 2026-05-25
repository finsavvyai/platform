/**
 * Compliance Narrative Generator Tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
  generateComplianceNarrative,
  generateComplianceNarrativeWithAI,
  type OasfControl,
} from './compliance-narrative.js';

const SAMPLE_CONTROLS: OasfControl[] = [
  { controlId: 'OASF-01', name: 'Runtime Logging', status: 'pass', evidenceCount: 5 },
  { controlId: 'OASF-02', name: 'Secret Access Control', status: 'pass', evidenceCount: 3 },
  { controlId: 'OASF-03', name: 'Activity Review', status: 'fail', evidenceCount: 0 },
];

describe('Compliance Narrative Generator', () => {
  it('generates narrative with score and grade', () => {
    const result = generateComplianceNarrative(SAMPLE_CONTROLS);
    expect(result.overallScore).toBe(67);
    expect(result.grade).toBe('C');
    expect(result.controlNarratives).toHaveLength(3);
    expect(result.summary).toContain('2/3');
  });

  it('handles all controls passing', () => {
    const controls: OasfControl[] = [
      { controlId: 'OASF-01', name: 'Logging', status: 'pass', evidenceCount: 10 },
      { controlId: 'OASF-02', name: 'Access', status: 'pass', evidenceCount: 5 },
    ];
    const result = generateComplianceNarrative(controls);
    expect(result.overallScore).toBe(100);
    expect(result.grade).toBe('A+');
  });

  it('excludes not_applicable from score', () => {
    const controls: OasfControl[] = [
      { controlId: 'OASF-01', name: 'Logging', status: 'pass', evidenceCount: 5 },
      { controlId: 'OASF-02', name: 'N/A Control', status: 'not_applicable', evidenceCount: 0 },
    ];
    const result = generateComplianceNarrative(controls);
    expect(result.overallScore).toBe(100);
  });

  it('generates narratives with evidence counts', () => {
    const controls: OasfControl[] = [
      { controlId: 'OASF-01', name: 'Logging', status: 'pass', evidenceCount: 7 },
    ];
    const result = generateComplianceNarrative(controls);
    expect(result.controlNarratives[0]!.narrative).toContain('7 evidence items');
  });

  it('handles empty controls list', () => {
    const result = generateComplianceNarrative([]);
    expect(result.overallScore).toBe(0);
    expect(result.grade).toBe('F');
  });
});

describe('AI Compliance Narrative', () => {
  function createMockAI(response: string) {
    return { run: vi.fn().mockResolvedValue({ response }) };
  }

  it('generates AI-enhanced narratives', async () => {
    const ai = createMockAI('The control demonstrates full implementation with robust evidence.');
    const result = await generateComplianceNarrativeWithAI(SAMPLE_CONTROLS, ai);
    expect(result.overallScore).toBe(67);
    expect(result.grade).toBe('C');
    expect(result.controlNarratives).toHaveLength(3);
    expect(ai.run).toHaveBeenCalledTimes(3);
    for (const cn of result.controlNarratives) {
      expect(cn.narrative).toContain('robust evidence');
    }
  });

  it('falls back to template when AI is null', async () => {
    const result = await generateComplianceNarrativeWithAI(SAMPLE_CONTROLS, null);
    const templateResult = generateComplianceNarrative(SAMPLE_CONTROLS);
    expect(result).toEqual(templateResult);
  });

  it('falls back to template for individual control when AI fails', async () => {
    const ai = {
      run: vi.fn()
        .mockResolvedValueOnce({ response: 'AI narrative for control 1.' })
        .mockRejectedValueOnce(new Error('AI unavailable'))
        .mockResolvedValueOnce({ response: 'AI narrative for control 3.' }),
    };
    const result = await generateComplianceNarrativeWithAI(SAMPLE_CONTROLS, ai);
    expect(result.controlNarratives[0]!.narrative).toContain('AI narrative for control 1');
    expect(result.controlNarratives[1]!.narrative).toContain('fully implemented');
    expect(result.controlNarratives[2]!.narrative).toContain('AI narrative for control 3');
  });

  it('falls back when AI returns empty response', async () => {
    const ai = createMockAI('');
    const result = await generateComplianceNarrativeWithAI(SAMPLE_CONTROLS, ai);
    const templateResult = generateComplianceNarrative(SAMPLE_CONTROLS);
    expect(result.controlNarratives[0]!.narrative).toBe(templateResult.controlNarratives[0]!.narrative);
  });

  it('preserves score and grade from template logic', async () => {
    const ai = createMockAI('AI-generated compliance assessment narrative here.');
    const result = await generateComplianceNarrativeWithAI(SAMPLE_CONTROLS, ai);
    expect(result.overallScore).toBe(67);
    expect(result.grade).toBe('C');
    expect(result.summary).toContain('2/3');
  });

  it('sends correct prompt to AI model', async () => {
    const ai = createMockAI('Detailed compliance narrative.');
    await generateComplianceNarrativeWithAI(
      [{ controlId: 'OASF-05', name: 'Data Encryption', status: 'pass', evidenceCount: 12 }],
      ai,
    );
    expect(ai.run).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', expect.objectContaining({
      messages: [{ role: 'user', content: expect.stringContaining('Data Encryption') }],
      max_tokens: 200,
    }));
  });
});
