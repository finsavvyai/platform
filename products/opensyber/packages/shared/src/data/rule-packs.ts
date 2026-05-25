export type {
  RuleCondition,
  RuleAction,
  RuleDefinition,
  RulePackCategory,
  RulePack,
} from './rule-pack-types.js';

export {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_COLORS,
} from './rule-pack-types.js';

import type { RulePack } from './rule-pack-types.js';

export const BUILT_IN_RULE_PACKS: RulePack[] = [
  {
    id: 'pack-prompt-injection',
    name: 'Prompt Injection Detection',
    description: 'Detect prompt injection attempts against AI models and LLM-based agents.',
    category: 'ai_security',
    severity: 'critical',
    rules: [
      { name: 'Prompt injection event', conditions: [{ field: 'eventType', operator: 'contains', value: 'prompt_injection' }], actions: [{ type: 'alert', config: { severity: 'critical' } }, { type: 'block', config: {} }] },
    ],
  },
  {
    id: 'pack-exposed-secrets',
    name: 'Exposed Secrets',
    description: 'Alert on secrets detected in code repositories or runtime environments.',
    category: 'dev_environment',
    severity: 'critical',
    rules: [
      { name: 'Secret detected in repo', conditions: [{ field: 'eventType', operator: 'equals', value: 'secret_detected' }, { field: 'source', operator: 'in', value: ['github', 'gitlab'] }], actions: [{ type: 'alert', config: { severity: 'critical' } }, { type: 'notify', config: { channel: 'pagerduty' } }] },
    ],
  },
  {
    id: 'pack-anomalous-ai-usage',
    name: 'Anomalous AI Usage',
    description: 'Detect unusually high AI model invocations that may indicate abuse or compromise.',
    category: 'ai_security',
    severity: 'high',
    rules: [
      { name: 'High Bedrock invocation rate', conditions: [{ field: 'eventType', operator: 'equals', value: 'bedrock_invoke' }, { field: 'threshold', operator: 'gt', value: 100 }], actions: [{ type: 'alert', config: { severity: 'high' } }] },
    ],
  },
  {
    id: 'pack-public-s3',
    name: 'Public S3 Buckets',
    description: 'Identify publicly accessible S3 buckets in connected cloud accounts.',
    category: 'cloud_posture',
    severity: 'critical',
    rules: [
      { name: 'Public S3 bucket found', conditions: [{ field: 'eventType', operator: 'equals', value: 'cspm_finding' }, { field: 'checkId', operator: 'equals', value: 's3_public' }], actions: [{ type: 'alert', config: { severity: 'critical' } }] },
    ],
  },
  {
    id: 'pack-unauthorized-network',
    name: 'Unauthorized Network',
    description: 'Flag unauthorized network connections from agent containers.',
    category: 'dev_environment',
    severity: 'high',
    rules: [
      { name: 'Repeated unauthorized connections', conditions: [{ field: 'eventType', operator: 'equals', value: 'unauthorized_network' }, { field: 'count', operator: 'gt', value: 5 }], actions: [{ type: 'alert', config: { severity: 'high' } }, { type: 'block', config: {} }] },
    ],
  },
  {
    id: 'pack-file-integrity',
    name: 'File Integrity Violation',
    description: 'Monitor sensitive file modifications such as .env or private key files.',
    category: 'dev_environment',
    severity: 'critical',
    rules: [
      { name: 'Sensitive file modified', conditions: [{ field: 'eventType', operator: 'equals', value: 'file_modified' }, { field: 'path', operator: 'matches', value: '*.env|*.key|*.pem' }], actions: [{ type: 'alert', config: { severity: 'critical' } }] },
    ],
  },
  {
    id: 'pack-failed-auth',
    name: 'Failed Auth Attempts',
    description: 'Detect brute-force login attempts with configurable thresholds.',
    category: 'compliance',
    severity: 'high',
    rules: [
      { name: 'Brute force detection', conditions: [{ field: 'eventType', operator: 'equals', value: 'auth_failure' }, { field: 'count', operator: 'gt', value: 10 }], actions: [{ type: 'alert', config: { severity: 'high' } }, { type: 'notify', config: { channel: 'slack' } }] },
    ],
  },
  {
    id: 'pack-compliance-drift',
    name: 'Compliance Drift',
    description: 'Alert when compliance checks fail, indicating drift from baseline.',
    category: 'compliance',
    severity: 'medium',
    rules: [
      { name: 'Compliance check failed', conditions: [{ field: 'eventType', operator: 'equals', value: 'compliance_check_failed' }], actions: [{ type: 'alert', config: { severity: 'medium' } }] },
    ],
  },
  {
    id: 'pack-iam-misconfiguration',
    name: 'IAM Misconfiguration',
    description: 'Detect overly permissive IAM roles and policies in cloud accounts.',
    category: 'cloud_posture',
    severity: 'high',
    rules: [
      { name: 'Overly permissive IAM role', conditions: [{ field: 'eventType', operator: 'equals', value: 'cspm_finding' }, { field: 'checkId', operator: 'equals', value: 'iam_wildcard_policy' }], actions: [{ type: 'alert', config: { severity: 'high' } }] },
    ],
  },
  {
    id: 'pack-data-exfiltration',
    name: 'Data Exfiltration Prevention',
    description: 'Detect large outbound data transfers that may indicate exfiltration.',
    category: 'ai_security',
    severity: 'critical',
    rules: [
      { name: 'Large outbound transfer', conditions: [{ field: 'eventType', operator: 'equals', value: 'data_transfer' }, { field: 'bytesOut', operator: 'gt', value: 104857600 }], actions: [{ type: 'alert', config: { severity: 'critical' } }, { type: 'block', config: {} }] },
    ],
  },
];
