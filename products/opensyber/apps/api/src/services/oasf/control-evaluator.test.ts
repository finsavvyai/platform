import { describe, it, expect } from 'vitest';
import { evaluateControls } from './control-evaluator.js';
import type { OasfEvidenceContext } from './types.js';

function makeCtx(overrides: Partial<OasfEvidenceContext> = {}): OasfEvidenceContext {
  return {
    activityCount24h: 0, jitAccessRequestCount: 0,
    ackedViolationCount: 0, violationCount24h: 0,
    secretsDetectedCount: 0, fileAccessCount: 0,
    sandboxPolicyCount: 0, networkPolicyCount: 0,
    rotationPolicyCount: 0, scannedSubmissionCount: 0,
    verifiedSkillCount: 0, totalSubmissionCount: 0,
    alertRuleCount: 0, auditLogCount90d: 0,
    orgMemberCount: 0, rbacMemberCount: 0,
    attackPathSnapshotCount: 0, assetCount: 0,
    recentAssessmentCount: 0,
    ...overrides,
  };
}

describe('OASF Control Evaluator', () => {
  it('returns 15 controls', () => {
    const results = evaluateControls(makeCtx());
    expect(results).toHaveLength(15);
  });

  it('all fail with empty context', () => {
    const results = evaluateControls(makeCtx());
    const failing = results.filter((r) => r.status === 'fail');
    // OASF-03 returns partial when no violations exist
    expect(failing.length).toBe(14);
  });

  it('OASF-01: passes with activity in 24h', () => {
    const r = evaluateControls(makeCtx({ activityCount24h: 5 }));
    expect(r.find((c) => c.controlId === 'OASF-01')!.status).toBe('pass');
  });

  it('OASF-02: passes with JIT access configured', () => {
    const r = evaluateControls(makeCtx({ jitAccessRequestCount: 2 }));
    expect(r.find((c) => c.controlId === 'OASF-02')!.status).toBe('pass');
  });

  it('OASF-03: passes with acknowledged violations', () => {
    const r = evaluateControls(makeCtx({ ackedViolationCount: 3 }));
    expect(r.find((c) => c.controlId === 'OASF-03')!.status).toBe('pass');
  });

  it('OASF-03: fails with unreviewed violations', () => {
    const r = evaluateControls(makeCtx({ violationCount24h: 5 }));
    expect(r.find((c) => c.controlId === 'OASF-03')!.status).toBe('fail');
  });

  it('OASF-04: passes with file access events', () => {
    const r = evaluateControls(makeCtx({ fileAccessCount: 10 }));
    expect(r.find((c) => c.controlId === 'OASF-04')!.status).toBe('pass');
  });

  it('OASF-05: passes with sandbox policies', () => {
    const r = evaluateControls(makeCtx({ sandboxPolicyCount: 2 }));
    expect(r.find((c) => c.controlId === 'OASF-05')!.status).toBe('pass');
  });

  it('OASF-06: passes with network policies', () => {
    const r = evaluateControls(makeCtx({ networkPolicyCount: 1 }));
    expect(r.find((c) => c.controlId === 'OASF-06')!.status).toBe('pass');
  });

  it('OASF-07: passes with rotation policies', () => {
    const r = evaluateControls(makeCtx({ rotationPolicyCount: 3 }));
    expect(r.find((c) => c.controlId === 'OASF-07')!.status).toBe('pass');
  });

  it('OASF-08: passes with scanned submissions', () => {
    const r = evaluateControls(makeCtx({ scannedSubmissionCount: 5 }));
    expect(r.find((c) => c.controlId === 'OASF-08')!.status).toBe('pass');
  });

  it('OASF-09: passes when 90%+ skills verified', () => {
    const r = evaluateControls(makeCtx({ verifiedSkillCount: 9, totalSubmissionCount: 10 }));
    expect(r.find((c) => c.controlId === 'OASF-09')!.status).toBe('pass');
  });

  it('OASF-09: partial when some skills verified', () => {
    const r = evaluateControls(makeCtx({ verifiedSkillCount: 3, totalSubmissionCount: 10 }));
    expect(r.find((c) => c.controlId === 'OASF-09')!.status).toBe('partial');
  });

  it('OASF-10: passes with alert rules', () => {
    const r = evaluateControls(makeCtx({ alertRuleCount: 2 }));
    expect(r.find((c) => c.controlId === 'OASF-10')!.status).toBe('pass');
  });

  it('OASF-11: passes with sufficient audit logs', () => {
    const r = evaluateControls(makeCtx({ auditLogCount90d: 200 }));
    expect(r.find((c) => c.controlId === 'OASF-11')!.status).toBe('pass');
  });

  it('OASF-11: partial with few audit logs', () => {
    const r = evaluateControls(makeCtx({ auditLogCount90d: 10 }));
    expect(r.find((c) => c.controlId === 'OASF-11')!.status).toBe('partial');
  });

  it('OASF-12: passes with org members (MFA via Clerk)', () => {
    const r = evaluateControls(makeCtx({ orgMemberCount: 3 }));
    expect(r.find((c) => c.controlId === 'OASF-12')!.status).toBe('pass');
  });

  it('OASF-13: passes with multiple RBAC members', () => {
    const r = evaluateControls(makeCtx({ rbacMemberCount: 3 }));
    expect(r.find((c) => c.controlId === 'OASF-13')!.status).toBe('pass');
  });

  it('OASF-13: partial with single RBAC member', () => {
    const r = evaluateControls(makeCtx({ rbacMemberCount: 1 }));
    expect(r.find((c) => c.controlId === 'OASF-13')!.status).toBe('partial');
  });

  it('OASF-14: passes with snapshots and assets', () => {
    const r = evaluateControls(makeCtx({ attackPathSnapshotCount: 2, assetCount: 10 }));
    expect(r.find((c) => c.controlId === 'OASF-14')!.status).toBe('pass');
  });

  it('OASF-14: partial with only assets', () => {
    const r = evaluateControls(makeCtx({ assetCount: 10 }));
    expect(r.find((c) => c.controlId === 'OASF-14')!.status).toBe('partial');
  });

  it('OASF-15: passes with recent assessment', () => {
    const r = evaluateControls(makeCtx({ recentAssessmentCount: 1 }));
    expect(r.find((c) => c.controlId === 'OASF-15')!.status).toBe('pass');
  });

  it('full passing context scores all pass', () => {
    const r = evaluateControls(makeCtx({
      activityCount24h: 10, jitAccessRequestCount: 2,
      ackedViolationCount: 5, violationCount24h: 0,
      secretsDetectedCount: 3, fileAccessCount: 20,
      sandboxPolicyCount: 2, networkPolicyCount: 1,
      rotationPolicyCount: 3, scannedSubmissionCount: 5,
      verifiedSkillCount: 9, totalSubmissionCount: 10,
      alertRuleCount: 2, auditLogCount90d: 500,
      orgMemberCount: 5, rbacMemberCount: 5,
      attackPathSnapshotCount: 3, assetCount: 20,
      recentAssessmentCount: 2,
    }));
    const passing = r.filter((c) => c.status === 'pass');
    expect(passing.length).toBe(15);
  });

  it('each result has evidence summary and source table', () => {
    const r = evaluateControls(makeCtx({ activityCount24h: 1 }));
    for (const ctrl of r) {
      expect(ctrl.evidenceSummary).toBeTruthy();
      expect(ctrl.sourceTable).toBeTruthy();
    }
  });
});
