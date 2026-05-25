/**
 * Default SDLC policies for PipeWarden
 */

import type { OPAPolicy } from './pipewarden-types';

/** Get the default SDLC policies to seed PipeWarden with. */
export function getDefaultPolicies(): OPAPolicy[] {
  return [
    {
      id: 'sdlc-require-tests',
      name: 'Require Tests (SDLC)',
      description: 'Pipeline must include test execution',
      severity: 'high',
      enforced: true,
      rules: [
        {
          id: 'rule-1',
          description: 'Check for test step in pipeline',
          action: 'audit',
          conditions: { stepExists: 'test' },
        },
      ],
    },
    {
      id: 'sdlc-no-hardcoded-secrets',
      name: 'No Hardcoded Secrets (SDLC)',
      description: 'Detect and prevent hardcoded secrets in pipeline',
      severity: 'critical',
      enforced: true,
      rules: [
        {
          id: 'rule-1',
          description: 'Scan for API keys, tokens, credentials',
          action: 'deny',
          conditions: { dlpEnabled: true },
        },
      ],
    },
    {
      id: 'sdlc-require-sast',
      name: 'Require SAST (SDLC)',
      description: 'Pipeline must include static application security testing',
      severity: 'high',
      enforced: true,
      rules: [
        {
          id: 'rule-1',
          description: 'Check for SAST step',
          action: 'audit',
          conditions: { stepExists: 'sast' },
        },
      ],
    },
    {
      id: 'sdlc-require-code-review',
      name: 'Require Code Review (SDLC)',
      description: 'Code changes require approval before merge',
      severity: 'high',
      enforced: true,
      rules: [
        {
          id: 'rule-1',
          description: 'Enforce pull request reviews',
          action: 'deny',
          conditions: { prRequired: true },
        },
      ],
    },
  ];
}
