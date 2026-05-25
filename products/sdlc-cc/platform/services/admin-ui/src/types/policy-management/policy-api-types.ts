/**
 * Policy API Request/Response Types
 */

import type { Policy, PolicyCategory, PolicyPriority, PolicyStatus,
  VisualPolicy, ApprovalStatus } from './policy-types';
import type { PolicyImpact } from './impact-types';
import type { PolicyMetadata } from './policy-metadata-types';
import type { PolicyTestResult, TestCoverage, TestConfig } from './test-types';
import type { DeploymentStatus, DeploymentEnvironment, DeploymentConfig,
  DeploymentMonitoring, PolicyDeployment, RollbackInfo, RollbackConfig,
} from './deployment-types';

export interface CreatePolicyRequest {
  name: string;
  description: string;
  category: PolicyCategory;
  priority: PolicyPriority;
  regoCode: string;
  visualPolicy?: VisualPolicy;
  tags: string[];
  metadata: Partial<PolicyMetadata>;
  templateId?: string;
  parameters?: Record<string, unknown>;
}

export interface UpdatePolicyRequest {
  name?: string;
  description?: string;
  category?: PolicyCategory;
  priority?: PolicyPriority;
  regoCode?: string;
  visualPolicy?: VisualPolicy;
  tags?: string[];
  metadata?: Partial<PolicyMetadata>;
  version?: number;
}

export interface PolicyListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: PolicyFilter;
  search?: string;
}

export interface PolicyFilter {
  category?: PolicyCategory[];
  status?: PolicyStatus[];
  priority?: PolicyPriority[];
  tenantId?: string;
  tags?: string[];
  createdBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  approvalStatus?: ApprovalStatus[];
  deploymentStatus?: DeploymentStatus[];
}

export interface PolicyListResponse {
  policies: Policy[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ValidatePolicyRequest {
  regoCode: string;
  category: PolicyCategory;
  context?: Record<string, unknown>;
  strict?: boolean;
}

export interface ValidatePolicyResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metrics: ValidationMetrics;
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  type: 'syntax' | 'semantic' | 'security' | 'performance';
  severity: 'error' | 'warning';
  rule?: string;
  fix?: string;
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  type: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  type: string;
  message: string;
  code: string;
  description: string;
}

export interface ValidationMetrics {
  complexity: number;
  maintainability: number;
  testability: number;
  security: number;
  performance: number;
}

export interface TestPolicyRequest {
  policyId: string;
  version?: number;
  testSuite?: string;
  scenarios?: string[];
  context?: Record<string, unknown>;
  config?: TestConfig;
}

export interface TestPolicyResponse {
  testRun: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  results: PolicyTestResult[];
  summary: TestSummary;
  coverage: TestCoverage;
  artifacts: TestArtifact[];
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  passRate: number;
  coverage: number;
}

export interface TestArtifact {
  type: 'log' | 'report' | 'trace' | 'screenshot';
  name: string;
  url: string;
  size: number;
  createdAt: Date;
}

export interface DeployPolicyRequest {
  policyId: string;
  version: number;
  environment: DeploymentEnvironment;
  config: Partial<DeploymentConfig>;
  approvalRequired?: boolean;
  approvers?: string[];
}

export interface DeployPolicyResponse {
  deployment: PolicyDeployment;
  status: DeploymentStatus;
  estimatedDuration: number;
  rollbackDeadline: Date;
  monitoring: DeploymentMonitoring;
}

export interface RollbackPolicyRequest {
  deploymentId: string;
  reason: string;
  strategy: 'immediate' | 'graceful' | 'scheduled';
  scheduledAt?: Date;
  config?: Partial<RollbackConfig>;
}

export interface RollbackPolicyResponse {
  rollback: RollbackInfo;
  status: DeploymentStatus;
  estimatedDuration: number;
  impact: PolicyImpact;
}