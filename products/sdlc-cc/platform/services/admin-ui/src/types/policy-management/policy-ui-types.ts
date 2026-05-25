/**
 * Policy UI Component Props Types
 *
 * Types for policy management UI components including
 * builder, editor, test panel, deployment, and version management
 */

import type {
  Policy,
  PolicyVersion,
  VisualPolicy,
} from './policy-types';
import type { PolicyImpact } from './impact-types';
import type {
  ValidatePolicyResponse,
  ValidationError,
  DeployPolicyRequest,
  RollbackPolicyRequest,
  TestPolicyResponse,
} from './policy-api-types';
import type {
  PolicyDeployment,
  DeploymentEnvironment,
} from './deployment-types';
import type { PolicyTestSuite, TestScenario } from './test-types';
import type { PolicyTemplate } from './template-types';
import type {
  PolicyApproval,
  ApprovalDecision,
} from './approval-types';

export interface PolicyBuilderProps {
  policy?: Policy;
  template?: PolicyTemplate;
  readOnly?: boolean;
  onSave?: (policy: Partial<Policy>) => void;
  onValidate?: (valid: boolean, errors: ValidationError[]) => void;
  onTest?: (policy: Policy) => void;
  onDeploy?: (policy: Policy) => void;
}

export interface RegoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  fontSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  validation?: ValidatePolicyResponse;
  onValidationChange?: (validation: ValidatePolicyResponse) => void;
}

export interface PolicyTestPanelProps {
  policyId: string;
  version?: number;
  testSuites?: PolicyTestSuite[];
  onTestRun?: (results: TestPolicyResponse) => void;
  onTestSelect?: (scenario: TestScenario) => void;
}

export interface PolicyDeploymentPanelProps {
  policy: Policy;
  deployments: PolicyDeployment[];
  environments: DeploymentEnvironment[];
  onDeploy?: (request: DeployPolicyRequest) => void;
  onRollback?: (request: RollbackPolicyRequest) => void;
  onApproval?: (approval: PolicyApproval) => void;
}

export interface PolicyImpactAnalysisProps {
  policy: Policy;
  compareTo?: Policy;
  onAnalyze?: (impact: PolicyImpact) => void;
}

export interface PolicyVersionHistoryProps {
  policyId: string;
  versions: PolicyVersion[];
  onVersionSelect?: (version: PolicyVersion) => void;
  onVersionCompare?: (v1: PolicyVersion, v2: PolicyVersion) => void;
  onVersionRestore?: (version: PolicyVersion) => void;
}

export interface PolicyApprovalWorkflowProps {
  policy: Policy;
  approval?: PolicyApproval;
  onSubmit?: (approval: PolicyApproval) => void;
  onApprove?: (decision: ApprovalDecision) => void;
  onReject?: (decision: ApprovalDecision) => void;
  onRequestChanges?: (decision: ApprovalDecision) => void;
  onEscalate?: (reason: string) => void;
}
