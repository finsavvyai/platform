import { describe, it, expect } from 'vitest';
import {
  toUniversalAlert,
  fromUniversalAlert,
  toUniversalControl,
} from './alert-adapter';
import type { CISControlResult } from './alert-adapter';
import type { Alert } from './types';
import type { UniversalAlert } from './cross-project';

// ============================================================
// Fixtures
// ============================================================

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-001',
    tenantId: 'tenant-abc',
    ruleId: 'rule-mfa-gap',
    severity: 'high',
    category: 'security',
    title: 'MFA not enforced for admins',
    description: 'Admin accounts lack multi-factor authentication.',
    businessImpact: 'Account takeover risk',
    affectedResources: [{ type: 'user', id: 'u1' }],
    recommendedAction: 'Enable MFA for all admin accounts',
    remediationType: 'automatic',
    status: 'active',
    createdAt: '2026-03-01T12:00:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
    ...overrides,
  };
}

function makeUniversalAlert(
  overrides: Partial<UniversalAlert> = {},
): UniversalAlert {
  return {
    id: 'tenantiq:alert-001',
    source: 'tenantiq',
    sourceId: 'alert-001',
    category: 'security',
    severity: 'high',
    title: 'MFA not enforced for admins',
    description: 'Admin accounts lack multi-factor authentication.',
    affectedResource: 'tenant:t-123',
    frameworks: [],
    remediationSteps: ['Enable MFA for all admin accounts'],
    autoRemediable: true,
    confidence: 0.85,
    detectedAt: 1740830400000,
    metadata: {},
    ...overrides,
  };
}

function makeCISResult(
  overrides: Partial<CISControlResult> = {},
): CISControlResult {
  return {
    id: 'cis-result-001',
    controlId: 'CIS-M365-1.1.1',
    framework: 'CIS-M365',
    title: 'Ensure MFA is enabled for all users',
    description: 'Multi-factor authentication should be enabled.',
    status: 'fail',
    severity: 'critical',
    evidence: 'Found 5 users without MFA',
    remediationScript: 'Set-MsolUser -EnableMFA $true',
    lastChecked: 1740830400000,
    ...overrides,
  };
}

// ============================================================
// toUniversalAlert
// ============================================================

describe('toUniversalAlert', () => {
  it('should map all core fields correctly', () => {
    const alert = makeAlert();
    const result = toUniversalAlert(alert, 'tenant-xyz');

    expect(result.id).toBe('tenantiq:alert-001');
    expect(result.source).toBe('tenantiq');
    expect(result.sourceId).toBe('alert-001');
    expect(result.severity).toBe('high');
    expect(result.title).toBe('MFA not enforced for admins');
    expect(result.description).toContain('multi-factor');
    expect(result.affectedResource).toBe('tenant:tenant-xyz');
  });

  it('should map category optimization -> cost', () => {
    const alert = makeAlert({ category: 'optimization' });
    const result = toUniversalAlert(alert, 't-1');
    expect(result.category).toBe('cost');
  });

  it('should map category operational -> performance', () => {
    const alert = makeAlert({ category: 'operational' });
    const result = toUniversalAlert(alert, 't-1');
    expect(result.category).toBe('performance');
  });

  it('should pass through security and compliance categories', () => {
    expect(
      toUniversalAlert(makeAlert({ category: 'security' }), 't').category,
    ).toBe('security');
    expect(
      toUniversalAlert(makeAlert({ category: 'compliance' }), 't').category,
    ).toBe('compliance');
  });

  it('should set autoRemediable true for automatic type', () => {
    const alert = makeAlert({ remediationType: 'automatic' });
    expect(toUniversalAlert(alert, 't').autoRemediable).toBe(true);
  });

  it('should set autoRemediable false for manual type', () => {
    const alert = makeAlert({ remediationType: 'manual' });
    expect(toUniversalAlert(alert, 't').autoRemediable).toBe(false);
  });

  it('should set autoRemediable false for semi_automatic type', () => {
    const alert = makeAlert({ remediationType: 'semi_automatic' });
    expect(toUniversalAlert(alert, 't').autoRemediable).toBe(false);
  });

  it('should populate remediationSteps from recommendedAction', () => {
    const alert = makeAlert({ recommendedAction: 'Do this now' });
    const result = toUniversalAlert(alert, 't');
    expect(result.remediationSteps).toEqual(['Do this now']);
  });

  it('should return empty remediationSteps when no action', () => {
    const alert = makeAlert({ recommendedAction: null });
    const result = toUniversalAlert(alert, 't');
    expect(result.remediationSteps).toEqual([]);
  });

  it('should convert createdAt to epoch ms', () => {
    const alert = makeAlert({ createdAt: '2026-01-15T00:00:00.000Z' });
    const result = toUniversalAlert(alert, 't');
    expect(result.detectedAt).toBe(
      new Date('2026-01-15T00:00:00.000Z').getTime(),
    );
  });

  it('should convert resolvedAt when present', () => {
    const alert = makeAlert({
      resolvedAt: '2026-01-16T00:00:00.000Z',
    });
    const result = toUniversalAlert(alert, 't');
    expect(result.resolvedAt).toBe(
      new Date('2026-01-16T00:00:00.000Z').getTime(),
    );
  });

  it('should leave resolvedAt undefined when null', () => {
    const alert = makeAlert({ resolvedAt: null });
    const result = toUniversalAlert(alert, 't');
    expect(result.resolvedAt).toBeUndefined();
  });

  it('should infer CIS-M365 framework for compliance category', () => {
    const alert = makeAlert({ category: 'compliance' });
    const result = toUniversalAlert(alert, 't');
    expect(result.frameworks).toContain('CIS-M365');
  });

  it('should infer HIPAA from title text', () => {
    const alert = makeAlert({ title: 'HIPAA violation detected' });
    const result = toUniversalAlert(alert, 't');
    expect(result.frameworks).toContain('HIPAA');
  });

  it('should store metadata with tenantId and ruleId', () => {
    const alert = makeAlert();
    const result = toUniversalAlert(alert, 'tenant-xyz');
    expect(result.metadata.tenantId).toBe('tenant-xyz');
    expect(result.metadata.ruleId).toBe('rule-mfa-gap');
    expect(result.metadata.status).toBe('active');
  });

  it('should assign confidence based on severity', () => {
    expect(
      toUniversalAlert(makeAlert({ severity: 'critical' }), 't').confidence,
    ).toBe(0.95);
    expect(
      toUniversalAlert(makeAlert({ severity: 'low' }), 't').confidence,
    ).toBe(0.5);
  });
});

// ============================================================
// fromUniversalAlert
// ============================================================

describe('fromUniversalAlert', () => {
  it('should map core fields back to TenantIQ format', () => {
    const universal = makeUniversalAlert();
    const result = fromUniversalAlert(universal);

    expect(result.id).toBe('alert-001');
    expect(result.severity).toBe('high');
    expect(result.title).toBe('MFA not enforced for admins');
    expect(result.status).toBe('active');
  });

  it('should map cost category back to optimization', () => {
    const universal = makeUniversalAlert({ category: 'cost' });
    const result = fromUniversalAlert(universal);
    expect(result.category).toBe('optimization');
  });

  it('should map performance category back to operational', () => {
    const universal = makeUniversalAlert({ category: 'performance' });
    const result = fromUniversalAlert(universal);
    expect(result.category).toBe('operational');
  });

  it('should downgrade info severity to low', () => {
    const universal = makeUniversalAlert({ severity: 'info' });
    const result = fromUniversalAlert(universal);
    expect(result.severity).toBe('low');
  });

  it('should join remediationSteps into recommendedAction', () => {
    const universal = makeUniversalAlert({
      remediationSteps: ['Step 1', 'Step 2'],
    });
    const result = fromUniversalAlert(universal);
    expect(result.recommendedAction).toBe('Step 1; Step 2');
  });

  it('should set recommendedAction null when no steps', () => {
    const universal = makeUniversalAlert({ remediationSteps: [] });
    const result = fromUniversalAlert(universal);
    expect(result.recommendedAction).toBeNull();
  });

  it('should set remediationType automatic when autoRemediable', () => {
    const universal = makeUniversalAlert({ autoRemediable: true });
    expect(fromUniversalAlert(universal).remediationType).toBe('automatic');
  });

  it('should set remediationType manual when not autoRemediable', () => {
    const universal = makeUniversalAlert({ autoRemediable: false });
    expect(fromUniversalAlert(universal).remediationType).toBe('manual');
  });

  it('should convert detectedAt to ISO string', () => {
    const ts = new Date('2026-02-20T00:00:00.000Z').getTime();
    const universal = makeUniversalAlert({ detectedAt: ts });
    const result = fromUniversalAlert(universal);
    expect(result.createdAt).toBe('2026-02-20T00:00:00.000Z');
  });

  it('should convert resolvedAt to ISO string when present', () => {
    const ts = new Date('2026-02-21T00:00:00.000Z').getTime();
    const universal = makeUniversalAlert({ resolvedAt: ts });
    const result = fromUniversalAlert(universal);
    expect(result.resolvedAt).toBe('2026-02-21T00:00:00.000Z');
  });

  it('should set resolvedAt null when undefined', () => {
    const universal = makeUniversalAlert({ resolvedAt: undefined });
    const result = fromUniversalAlert(universal);
    expect(result.resolvedAt).toBeNull();
  });
});

// ============================================================
// toUniversalControl
// ============================================================

describe('toUniversalControl', () => {
  it('should map all CIS result fields', () => {
    const cis = makeCISResult();
    const result = toUniversalControl(cis);

    expect(result.id).toBe('tenantiq:cis-result-001');
    expect(result.framework).toBe('CIS-M365');
    expect(result.controlId).toBe('CIS-M365-1.1.1');
    expect(result.title).toBe('Ensure MFA is enabled for all users');
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('critical');
    expect(result.evidence).toBe('Found 5 users without MFA');
    expect(result.remediationScript).toBe(
      'Set-MsolUser -EnableMFA $true',
    );
    expect(result.lastChecked).toBe(1740830400000);
  });

  it('should handle missing remediationScript', () => {
    const cis = makeCISResult({ remediationScript: undefined });
    const result = toUniversalControl(cis);
    expect(result.remediationScript).toBeUndefined();
  });

  it('should preserve pass status', () => {
    const cis = makeCISResult({ status: 'pass' });
    expect(toUniversalControl(cis).status).toBe('pass');
  });

  it('should preserve not_applicable status', () => {
    const cis = makeCISResult({ status: 'not_applicable' });
    expect(toUniversalControl(cis).status).toBe('not_applicable');
  });

  it('should preserve manual_review status', () => {
    const cis = makeCISResult({ status: 'manual_review' });
    expect(toUniversalControl(cis).status).toBe('manual_review');
  });
});
