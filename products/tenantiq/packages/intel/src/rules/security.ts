import type { Rule } from '@tenantiq/shared';
import { policyRules } from './security-policy-rules';
import { signInRules } from './security-signin-rules';

export const securityRules: Rule[] = [...policyRules, ...signInRules];
