/**
 * DLP Default Rules and Policies
 */

import {
  DLPRule,
  DLPPolicy,
} from '../../types/dlp';

export function getDefaultRules(): Map<string, DLPRule> {
  const rules = new Map<string, DLPRule>();

  rules.set('credit-card-detection', {
    id: 'credit-card-detection',
    name: 'Credit Card Number Detection',
    description: 'Detects potential credit card numbers',
    severity: 'HIGH',
    enabled: true,
    conditions: [
      {
        type: 'REGEX',
        pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
        flags: 'g'
      }
    ],
    dataTypes: ['UNKNOWN', 'PUBLIC', 'INTERNAL'],
    actions: ['MASK', 'ALERT']
  });

  rules.set('ssn-detection', {
    id: 'ssn-detection',
    name: 'Social Security Number Detection',
    description: 'Detects SSN patterns',
    severity: 'CRITICAL',
    enabled: true,
    conditions: [
      {
        type: 'REGEX',
        pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
        flags: 'g'
      }
    ],
    dataTypes: ['UNKNOWN', 'PUBLIC', 'INTERNAL'],
    actions: ['MASK', 'ALERT', 'QUARANTINE']
  });

  rules.set('email-detection', {
    id: 'email-detection',
    name: 'Email Address Detection',
    description: 'Detects email addresses',
    severity: 'MEDIUM',
    enabled: true,
    conditions: [
      {
        type: 'REGEX',
        pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
        flags: 'g'
      }
    ],
    dataTypes: ['UNKNOWN', 'PUBLIC', 'INTERNAL'],
    actions: ['MASK']
  });

  rules.set('high-entropy-detection', {
    id: 'high-entropy-detection',
    name: 'High Entropy Data Detection',
    description: 'Detects potential API keys or tokens',
    severity: 'HIGH',
    enabled: true,
    conditions: [
      {
        type: 'ENTROPY',
        threshold: 4.5,
        minLength: 20
      }
    ],
    dataTypes: ['UNKNOWN', 'INTERNAL'],
    actions: ['ALERT', 'QUARANTINE']
  });

  return rules;
}

export function getDefaultPolicies(): Map<string, DLPPolicy> {
  const policies = new Map<string, DLPPolicy>();

  policies.set('pii-protection', {
    id: 'pii-protection',
    name: 'PII Data Protection Policy',
    description: 'Protects personally identifiable information',
    enabled: true,
    priority: 1,
    conditions: {
      dataTypes: ['PII'],
      riskLevels: ['HIGH', 'CRITICAL']
    },
    actions: [
      {
        id: 'pii-mask',
        type: 'MASK',
        params: {
          method: 'PARTIAL',
          preserveFormat: true
        }
      },
      {
        id: 'pii-alert',
        type: 'ALERT',
        params: {
          severity: 'HIGH',
          recipients: ['security@company.com']
        }
      }
    ]
  });

  policies.set('financial-protection', {
    id: 'financial-protection',
    name: 'Financial Data Protection Policy',
    description: 'Protects financial information',
    enabled: true,
    priority: 2,
    conditions: {
      dataTypes: ['FINANCIAL'],
      riskLevels: ['MEDIUM', 'HIGH', 'CRITICAL']
    },
    actions: [
      {
        id: 'financial-encrypt',
        type: 'ENCRYPT',
        params: {
          algorithm: 'AES-256-GCM',
          keyRotation: true
        }
      },
      {
        id: 'financial-log',
        type: 'LOG',
        params: {
          level: 'INFO',
          includeMetadata: true
        }
      }
    ]
  });

  return policies;
}

export function validateRule(rule: DLPRule): void {
  if (!rule.id || !rule.name) {
    throw new Error('Rule must have id and name');
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    throw new Error('Rule must have at least one condition');
  }

  for (const condition of rule.conditions) {
    if (!condition.type) {
      throw new Error('Rule condition must have type');
    }
  }
}

export function validatePolicy(policy: DLPPolicy): void {
  if (!policy.id || !policy.name) {
    throw new Error('Policy must have id and name');
  }

  if (!policy.actions || policy.actions.length === 0) {
    throw new Error('Policy must have at least one action');
  }

  for (const action of policy.actions) {
    if (!action.type) {
      throw new Error('Policy action must have type');
    }
  }
}
