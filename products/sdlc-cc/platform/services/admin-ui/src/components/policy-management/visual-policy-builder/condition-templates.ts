// @ts-nocheck
/**
 * Condition-type security rule templates
 */

import { PolicyNode } from '@/types/policy-management';

export const conditionTemplates: Record<string, Partial<PolicyNode>> = {
  authentication: {
    type: 'condition',
    data: {
      label: 'Verify Authentication',
      description: 'Check if user is authenticated',
      parameters: {
        requireMFA: true,
        allowedProviders: ['oauth2', 'saml', 'oidc'],
        sessionTimeout: 3600
      },
      logic: 'input.user.authenticated == true && input.user.mfa_verified == true'
    },
    config: { timeout: 5000, retries: 3, cacheable: true },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  },
  authorization: {
    type: 'condition',
    data: {
      label: 'Check Authorization',
      description: 'Verify user permissions',
      parameters: {
        resource: input.user.resource,
        action: input.user.action,
        role: input.user.role
      },
      logic: 'data.roles[_].users[_] == input.user.id && data.resources[_].permissions[_] == input.user.action'
    },
    config: { timeout: 3000, cacheable: true, parallel: false },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'rbac:check'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  },
  dataAccess: {
    type: 'validation',
    data: {
      label: 'Validate Data Access',
      description: 'Check data access permissions',
      parameters: {
        dataClassification: input.data.classification,
        userClearance: input.user.clearance,
        purpose: input.context.purpose
      },
      logic: 'input.user.clearance >= input.data.classification && data.purpose_allowed[input.context.purpose]'
    },
    config: { timeout: 2000, cacheable: true },
    security: {
      accessLevel: 'confidential',
      requiredPermissions: ['policy:evaluate', 'data:access'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  },
  compliance: {
    type: 'compliance',
    data: {
      label: 'Compliance Check',
      description: 'Verify compliance requirements',
      parameters: {
        framework: input.context.framework,
        controls: input.context.controls,
        evidence: input.context.evidence
      },
      logic: 'data.compliance[input.context.framework].controls[_] == input.context.control'
    },
    config: { timeout: 5000, cacheable: true },
    security: {
      accessLevel: 'confidential',
      requiredPermissions: ['policy:evaluate', 'compliance:check'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  }
};
