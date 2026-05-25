// Luna skill manifests — register TenantIQ AI capabilities
export interface LunaSkillManifest {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'compliance' | 'cost' | 'analytics';
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  endpoint: string;
  requiredScopes: string[];
  pricing: {
    model: 'per-call' | 'per-tenant' | 'included';
    unitCost?: number;
  };
}

const BASE = '/api/v1/skills';
export const TENANTIQ_SKILLS: LunaSkillManifest[] = [
  {
    id: 'm365-security-scan',
    name: 'M365 Security Scan',
    description:
      'Full Microsoft 365 security posture analysis — secure score, risky users, conditional access, MFA gaps.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Target Azure tenant ID' },
        depth: {
          type: 'string',
          enum: ['quick', 'standard', 'deep'],
          default: 'standard',
        },
      },
      required: ['tenantId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        secureScore: { type: 'number' },
        findings: { type: 'array', items: { type: 'object' } },
        recommendations: { type: 'array', items: { type: 'string' } },
        riskLevel: { type: 'string' },
      },
    },
    endpoint: `${BASE}/m365-security-scan`,
    requiredScopes: ['tenant:read', 'security:read'],
    pricing: { model: 'per-call', unitCost: 0.25 },
  },
  {
    id: 'm365-license-optimizer',
    name: 'M365 License Optimizer',
    description:
      'Detect unused and underutilized licenses, calculate savings, recommend downgrades and deprovisioning.',
    category: 'cost',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Target Azure tenant ID' },
        includeRecommendations: { type: 'boolean', default: true },
      },
      required: ['tenantId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        totalSpend: { type: 'number' },
        potentialSavings: { type: 'number' },
        unusedLicenses: { type: 'array', items: { type: 'object' } },
        recommendations: { type: 'array', items: { type: 'object' } },
      },
    },
    endpoint: `${BASE}/m365-license-optimizer`,
    requiredScopes: ['tenant:read', 'licenses:read'],
    pricing: { model: 'per-tenant', unitCost: 2.0 },
  },
  {
    id: 'm365-compliance-audit',
    name: 'M365 Compliance Audit',
    description:
      'CIS benchmark automation with multi-framework support — SOC2, HIPAA, NIST, GDPR mapping.',
    category: 'compliance',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Target Azure tenant ID' },
        frameworks: {
          type: 'array',
          items: { type: 'string', enum: ['CIS-M365', 'SOC2', 'HIPAA', 'NIST', 'GDPR'] },
          default: ['CIS-M365'],
        },
      },
      required: ['tenantId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        overallScore: { type: 'number' },
        controlResults: { type: 'array', items: { type: 'object' } },
        frameworkScores: { type: 'object' },
        remediationPlan: { type: 'array', items: { type: 'object' } },
      },
    },
    endpoint: `${BASE}/m365-compliance-audit`,
    requiredScopes: ['tenant:read', 'compliance:read', 'security:read'],
    pricing: { model: 'per-call', unitCost: 0.5 },
  },
  {
    id: 'm365-copilot-readiness',
    name: 'M365 Copilot Readiness',
    description:
      'Assess tenant readiness for Microsoft Copilot — data governance, permissions, licensing, and sensitivity labels.',
    category: 'analytics',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Target Azure tenant ID' },
        exportPdf: { type: 'boolean', default: false },
      },
      required: ['tenantId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        readinessScore: { type: 'number' },
        categories: { type: 'object' },
        blockers: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
    },
    endpoint: `${BASE}/m365-copilot-readiness`,
    requiredScopes: ['tenant:read', 'compliance:read'],
    pricing: { model: 'per-call', unitCost: 0.35 },
  },
  {
    id: 'm365-config-drift',
    name: 'M365 Config Drift',
    description:
      'Capture M365 configuration snapshots and detect drift — conditional access, mail flow, sharing policies.',
    category: 'compliance',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Target Azure tenant ID' },
        baselineSnapshotId: {
          type: 'string',
          description: 'Snapshot ID to compare against (latest if omitted)',
        },
      },
      required: ['tenantId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        driftsDetected: { type: 'number' },
        changes: { type: 'array', items: { type: 'object' } },
        riskAssessment: { type: 'string' },
        snapshotId: { type: 'string' },
      },
    },
    endpoint: `${BASE}/m365-config-drift`,
    requiredScopes: ['tenant:read', 'config:read'],
    pricing: { model: 'per-tenant', unitCost: 1.5 },
  },
  {
    id: 'm365-user-lifecycle',
    name: 'M365 User Lifecycle',
    description:
      'Automated user provisioning and deprovisioning — onboard, offboard, license assignment, group membership.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Target Azure tenant ID' },
        action: {
          type: 'string',
          enum: ['provision', 'deprovision', 'audit', 'sync'],
        },
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Azure AD user IDs to act on',
        },
      },
      required: ['tenantId', 'action'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
        succeeded: { type: 'number' },
        failed: { type: 'number' },
        actions: { type: 'array', items: { type: 'object' } },
      },
    },
    endpoint: `${BASE}/m365-user-lifecycle`,
    requiredScopes: ['tenant:read', 'users:write', 'groups:write'],
    pricing: { model: 'per-call', unitCost: 0.1 },
  },
];
