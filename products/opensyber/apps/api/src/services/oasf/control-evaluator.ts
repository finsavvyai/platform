/**
 * OASF Control Evaluator
 *
 * Maps each of the 15 OASF controls to an evaluation function
 * that checks real evidence context and returns pass/fail/partial.
 */
import { OASF_CONTROLS } from '@opensyber/shared';
import type { OasfStatus } from '@opensyber/shared';
import type { OasfEvidenceContext, ControlEvaluation } from './types.js';
import { evaluators } from './evaluator-rules.js';

export function evaluateControls(ctx: OasfEvidenceContext): ControlEvaluation[] {
  return OASF_CONTROLS.map((control) => {
    const evalFn = evaluators[control.id];
    if (!evalFn) {
      return {
        controlId: control.id,
        status: 'not_applicable' as OasfStatus,
        evidenceSummary: 'No evaluator defined',
        evidenceDetails: null,
        sourceTable: 'unknown',
        recordCount: 0,
      };
    }
    const { status, summary, source, count } = evalFn(ctx);
    return {
      controlId: control.id,
      status,
      evidenceSummary: summary,
      evidenceDetails: JSON.stringify({
        controlName: control.name,
        category: control.category,
        soc2: control.soc2Mapping,
        iso27001: control.iso27001Mapping,
        nistCsf: control.nistCsfMapping,
      }),
      sourceTable: source,
      recordCount: count,
    };
  });
}
