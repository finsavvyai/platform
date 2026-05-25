// @ts-nocheck
/**
 * Combined security rule templates for the Visual Policy Builder
 */

import { PolicyNode } from '@/types/policy-management';
import { conditionTemplates } from './condition-templates';
import { actionTemplates } from './action-templates';

export const securityRuleTemplates: Record<string, Partial<PolicyNode>> = {
  ...conditionTemplates,
  ...actionTemplates
};
