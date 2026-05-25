/**
 * Compliance Narrative Generator
 *
 * Generates human-readable compliance narratives from OASF assessment data.
 * Used in PDF reports and SOC2 evidence packages.
 */

export interface OasfControl {
  controlId: string;
  name: string;
  status: 'pass' | 'fail' | 'partial' | 'not_applicable';
  evidenceCount: number;
}

export interface ComplianceNarrative {
  summary: string;
  controlNarratives: ControlNarrative[];
  overallScore: number;
  grade: string;
}

export interface ControlNarrative {
  controlId: string;
  name: string;
  status: string;
  narrative: string;
}

const STATUS_NARRATIVES: Record<string, string> = {
  pass: 'This control is fully implemented and verified through automated evidence collection.',
  fail: 'This control has not been adequately implemented. Remediation is required.',
  partial: 'This control is partially implemented. Additional measures are needed for full compliance.',
  not_applicable: 'This control is not applicable to the current organizational context.',
};

export function generateComplianceNarrative(controls: OasfControl[]): ComplianceNarrative {
  const applicable = controls.filter((c) => c.status !== 'not_applicable');
  const passing = applicable.filter((c) => c.status === 'pass');
  const score = applicable.length > 0
    ? Math.round((passing.length / applicable.length) * 100)
    : 0;

  const controlNarratives: ControlNarrative[] = controls.map((c) => ({
    controlId: c.controlId,
    name: c.name,
    status: c.status,
    narrative: `${c.name} (${c.controlId}): ${STATUS_NARRATIVES[c.status] ?? STATUS_NARRATIVES.fail} `
      + `${c.evidenceCount > 0 ? `${c.evidenceCount} evidence items collected.` : 'No evidence collected.'}`,
  }));

  const grade = scoreToGrade(score);
  const summary = `AI Agent Compliance Assessment: ${passing.length}/${applicable.length} controls passing `
    + `(${score}%, Grade ${grade}). `
    + `${controls.filter((c) => c.status === 'fail').length} controls require remediation.`;

  return { summary, controlNarratives, overallScore: score, grade };
}

export async function generateComplianceNarrativeWithAI(
  controls: OasfControl[],
  ai: unknown,
): Promise<ComplianceNarrative> {
  const templateResult = generateComplianceNarrative(controls);
  if (!ai) return templateResult;

  const aiNarratives = await Promise.all(
    controls.map(async (control) => {
      try {
        return await generateControlNarrativeAI(control, ai);
      } catch {
        return null;
      }
    }),
  );

  const controlNarratives: ControlNarrative[] = controls.map((c, i) => ({
    controlId: c.controlId,
    name: c.name,
    status: c.status,
    narrative: aiNarratives[i] ?? templateResult.controlNarratives[i]!.narrative,
  }));

  return { ...templateResult, controlNarratives };
}

async function generateControlNarrativeAI(
  control: OasfControl,
  ai: unknown,
): Promise<string> {
  const prompt = [
    'You are a compliance auditor writing an assessment narrative.',
    `Control: ${control.name} (${control.controlId})`,
    `Status: ${control.status}`,
    `Evidence items collected: ${control.evidenceCount}`,
    'Write a 2-3 sentence audit-quality compliance narrative for this control.',
    'Be specific, professional, and reference the evidence count.',
  ].join('\n');

  const response = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
  });

  const text = response?.response?.trim();
  if (!text || text.length < 10) throw new Error('Empty AI response');
  return `${control.name} (${control.controlId}): ${text}`;
}

function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}
