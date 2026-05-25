/**
 * DLP Rules and Policies Type Definitions
 */

import type {
  ViolationSeverity,
  DataType,
  RiskLevel,
  DLPActionType,
  DLPConditionValue,
} from "./core-types";

// DLP Condition Types
export interface DLPCondition {
  id: string;
  type: "REGEX" | "KEYWORD" | "ML_MODEL" | "ENTROPY" | "FORMAT" | "CUSTOM";
  operator:
    | "MATCHES" | "CONTAINS" | "EQUALS"
    | "GREATER_THAN" | "LESS_THAN" | "NOT_EQUAL";
  value: DLPConditionValue;
  parameters?: {
    flags?: string;
    threshold?: number;
    modelId?: string;
    caseSensitive?: boolean;
    minLength?: number;
    maxLength?: number;
  };
  weight: number;
}

// DLP Exception
export interface DLPException {
  id: string;
  description: string;
  condition: DLPCondition;
  justification: string;
  approver: string;
  expiresAt?: string;
  active: boolean;
}

// DLP Rule Definition
export interface DLPRule {
  id: string;
  name: string;
  description: string;
  severity: ViolationSeverity;
  enabled: boolean;
  priority: number;
  conditions: DLPCondition[];
  dataTypes?: DataType[];
  tags?: string[];
  actions: string[];
  exceptions?: DLPException[];
  metadata: {
    category: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    lastTriggered?: string;
    triggerCount: number;
    falsePositiveRate: number;
  };
}

// DLP Action
export interface DLPAction {
  id: string;
  type: DLPActionType;
  params: Record<string, unknown>;
  conditions?: DLPCondition[];
  order: number;
  async: boolean;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// DLP Policy Definition
export interface DLPPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: {
    dataTypes?: DataType[];
    riskLevels?: RiskLevel[];
    users?: string[];
    roles?: string[];
    departments?: string[];
    locations?: string[];
    violationTypes?: string[];
    dataSources?: string[];
    customConditions?: DLPCondition[];
  };
  actions: DLPAction[];
  exemptions: DLPPolicyExemption[];
  metadata: {
    category: string;
    owner: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    reviewDate?: string;
    complianceImpact: string[];
  };
}

// DLP Policy Exemption
export interface DLPPolicyExemption {
  id: string;
  description: string;
  condition: DLPCondition;
  reason: string;
  approver: string;
  approvedAt: string;
  expiresAt?: string;
  active: boolean;
  usageCount: number;
  maxUses?: number;
}

// Evidence collected during rule evaluation
export interface RuleEvidence {
  type: string;
  pattern?: string;
  matches: string[];
  location?: {
    line?: number;
    column?: number;
    offset?: number;
  };
  context?: string;
}

// Evidence collection result
export interface CollectedEvidence {
  ruleId: string;
  timestamp: string;
  dataHash: string;
  matches: Array<{
    type: string;
    pattern: string;
    matches: string[];
  }>;
}

// Rule change audit entry
export interface RuleChangeEntry {
  action: 'ADD' | 'UPDATE' | 'REMOVE';
  ruleId: string;
  rule?: DLPRule;
  previousRule?: DLPRule;
  updatedRule?: DLPRule;
  timestamp: string;
  userId: string;
}

// Policy change audit entry
export interface PolicyChangeEntry {
  action: 'ADD' | 'UPDATE' | 'REMOVE';
  policyId: string;
  policy?: DLPPolicy;
  previousPolicy?: DLPPolicy;
  updatedPolicy?: DLPPolicy;
  timestamp: string;
  userId: string;
}
