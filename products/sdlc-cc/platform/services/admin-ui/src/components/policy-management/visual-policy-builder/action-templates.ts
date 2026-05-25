// @ts-nocheck
/**
 * Action-type security rule templates
 */

import { PolicyNode } from '@/types/policy-management';

export const actionTemplates: Record<string, Partial<PolicyNode>> = {
  rateLimit: {
    type: 'action',
    data: {
      label: 'Apply Rate Limit',
      description: 'Enforce rate limiting',
      parameters: {
        requests: 100, window: 60, strategy: 'sliding', burst: 10
      },
      logic: 'rate_limit(input.user.id, input.requests, input.window)'
    },
    config: { timeout: 1000, cacheable: true },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'rate_limit:apply'],
      auditLog: true, encryptionRequired: false,
      validateInput: true, sanitizeOutput: true
    }
  },
  audit: {
    type: 'action',
    data: {
      label: 'Log Audit Event',
      description: 'Record audit trail',
      parameters: {
        event: input.context.event,
        user: input.user.id,
        resource: input.resource.id,
        outcome: 'allow',
        metadata: input.context.metadata
      },
      logic: 'audit_log({ event: input.context.event, user: input.user.id, timestamp: time.now_ns() })'
    },
    config: { timeout: 1000, async: true },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'audit:log'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  },
  transform: {
    type: 'transform',
    data: {
      label: 'Transform Data',
      description: 'Apply data transformation',
      parameters: {
        masking: ['ssn', 'credit_card'],
        encryption: ['pii', 'phi'],
        anonymization: ['ip_address', 'email']
      },
      logic: 'transform(input.data, { mask: ["ssn", "credit_card"], encrypt: ["pii", "phi"] })'
    },
    config: { timeout: 3000, cacheable: false },
    security: {
      accessLevel: 'confidential',
      requiredPermissions: ['policy:evaluate', 'data:transform'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  },
  decision: {
    type: 'decision',
    data: {
      label: 'Policy Decision',
      description: 'Make final policy decision',
      parameters: {
        default: 'deny', allowConditions: [], denyConditions: []
      },
      logic: 'decision = { allow: true, reason: "All checks passed" }'
    },
    config: { timeout: 1000, cacheable: false },
    security: {
      accessLevel: 'internal',
      requiredPermissions: ['policy:evaluate', 'decision:make'],
      auditLog: true, encryptionRequired: true,
      validateInput: true, sanitizeOutput: true
    }
  }
};
