/**
 * Policy Evaluator.
 *
 * Evaluates scan results against policy rules to determine the
 * appropriate action (ALLOW, BLOCK, MASK, QUARANTINE).
 *
 * Supports rules like:
 * - "block if SSN found"
 * - "mask if email found"
 * - "quarantine if >5 PII matches"
 */

import {
  PIIType,
  PolicyAction,
  PolicyEvalResult,
  PolicyRule,
  ScanResult,
} from './types';

/**
 * Check whether a single rule matches the scan result.
 */
function ruleMatches(rule: PolicyRule, scanResult: ScanResult): boolean {
  const { matches } = scanResult;

  // Check PII type triggers
  if (rule.triggerTypes && rule.triggerTypes.length > 0) {
    const hasMatchingType = matches.some((m) =>
      rule.triggerTypes!.includes(m.piiType),
    );
    if (!hasMatchingType) return false;
  }

  // Check minimum match count threshold
  if (rule.minMatchCount !== undefined) {
    const relevantCount = rule.triggerTypes?.length
      ? matches.filter((m) => rule.triggerTypes!.includes(m.piiType)).length
      : matches.length;
    if (relevantCount < rule.minMatchCount) return false;
  }

  // Check minimum confidence threshold
  if (rule.minConfidence !== undefined) {
    const relevantMatches = rule.triggerTypes?.length
      ? matches.filter((m) => rule.triggerTypes!.includes(m.piiType))
      : matches;
    const hasHighConfidence = relevantMatches.some(
      (m) => m.confidence >= rule.minConfidence!,
    );
    if (!hasHighConfidence) return false;
  }

  return true;
}

/**
 * Policy evaluator that determines action based on scan results
 * and configured policy rules.
 */
export class PolicyEvaluator {
  private readonly rules: PolicyRule[];

  constructor(rules: PolicyRule[] = []) {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
  }

  /** Add a rule to the evaluator. */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /** Remove a rule by ID. */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }

  /** Get all configured rules. */
  getRules(): readonly PolicyRule[] {
    return this.rules;
  }

  /**
   * Evaluate a scan result against all rules.
   *
   * Returns the action from the highest-priority matching rule.
   * If no rules match, returns ALLOW.
   */
  evaluate(scanResult: ScanResult): PolicyEvalResult {
    if (scanResult.matchCount === 0) {
      return {
        action: PolicyAction.ALLOW,
        triggeredRule: null,
        matchedRules: [],
        scanResult,
      };
    }

    const matchedRules: PolicyRule[] = [];

    for (const rule of this.rules) {
      if (ruleMatches(rule, scanResult)) {
        matchedRules.push(rule);
      }
    }

    if (matchedRules.length === 0) {
      return {
        action: PolicyAction.ALLOW,
        triggeredRule: null,
        matchedRules: [],
        scanResult,
      };
    }

    // Highest priority rule (lowest number) determines the action
    const triggeredRule = matchedRules[0];

    return {
      action: triggeredRule.action,
      triggeredRule,
      matchedRules,
      scanResult,
    };
  }
}

/** Create common policy rules for quick setup. */
export function createDefaultRules(): PolicyRule[] {
  return [
    {
      id: 'block-ssn',
      description: 'Block content containing SSN',
      action: PolicyAction.BLOCK,
      triggerTypes: [PIIType.SSN],
      priority: 1,
    },
    {
      id: 'block-credit-card',
      description: 'Block content containing credit card numbers',
      action: PolicyAction.BLOCK,
      triggerTypes: [PIIType.CREDIT_CARD],
      priority: 2,
    },
    {
      id: 'quarantine-mass-pii',
      description: 'Quarantine content with more than 5 PII matches',
      action: PolicyAction.QUARANTINE,
      minMatchCount: 5,
      priority: 3,
    },
    {
      id: 'mask-email',
      description: 'Mask email addresses',
      action: PolicyAction.MASK,
      triggerTypes: [PIIType.EMAIL],
      priority: 10,
    },
    {
      id: 'mask-phone',
      description: 'Mask phone numbers',
      action: PolicyAction.MASK,
      triggerTypes: [PIIType.PHONE],
      priority: 11,
    },
  ];
}
