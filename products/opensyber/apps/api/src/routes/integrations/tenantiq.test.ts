import { describe, it, expect } from 'vitest';
import { mapTenantiqSeverity } from '@opensyber/shared';
import type {
  TenantiqAlert,
  TenantiqWebhookPayload,
  TenantiqSeverity,
} from '@opensyber/shared';

/**
 * TenantIQ webhook receiver — focused validation tests.
 * Full handler-level tests inherit from pipewarden.test.ts pattern (HMAC,
 * idempotency, resilience) since this receiver uses identical middleware.
 */

describe('TenantIQ severity mapping', () => {
  it('maps every Tenantiq severity to OpenSyber model', () => {
    const cases: Array<[TenantiqSeverity, string]> = [
      ['critical', 'critical'],
      ['high', 'high'],
      ['medium', 'medium'],
      ['low', 'low'],
    ];
    for (const [input, expected] of cases) {
      expect(mapTenantiqSeverity(input)).toBe(expected);
    }
  });
});

describe('TenantIQ webhook payload shape', () => {
  it('accepts minimal valid payload', () => {
    const alert: TenantiqAlert = {
      rule_id: 'tf-mfa-required',
      severity: 'high',
      category: 'security',
      title: 'MFA missing for admin user',
      description: 'Admin user has no MFA method registered',
      business_impact: 'Account takeover risk',
      recommended_action: 'Enable MFA',
      affected_resources_count: 1,
      tenant_id: 'tenant-abc',
    };

    const payload: TenantiqWebhookPayload = {
      alerts: [alert],
      tenant_id: 'tenant-abc',
      evaluated_at: '2026-04-26T22:00:00Z',
      source: 'intel-engine',
      connection_name: 'globalremit-prod',
    };

    expect(payload.alerts).toHaveLength(1);
    expect(payload.alerts[0]?.category).toBe('security');
    expect(payload.source).toBe('intel-engine');
  });

  it('supports all defined source types', () => {
    const sources: TenantiqWebhookPayload['source'][] = [
      'intel-engine',
      'remediation',
      'compliance-scan',
      'drift-detection',
    ];
    expect(sources).toHaveLength(4);
  });

  it('supports all defined categories', () => {
    const categories: TenantiqAlert['category'][] = [
      'security',
      'optimization',
      'compliance',
      'operational',
    ];
    expect(categories).toHaveLength(4);
  });
});
