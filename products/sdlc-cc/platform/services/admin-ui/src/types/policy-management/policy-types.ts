/**
 * Core Policy Types - policy interfaces, visual builder, and enums
 */

import type {
  PolicyMetadata,
  PolicySecurityContext,
} from './policy-metadata-types';
import type { PolicyTestResult } from './test-types';
import type { DeploymentStatus, DeploymentInfo } from './deployment-types';
import type { PolicyImpact } from './impact-types';

export interface Policy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  status: PolicyStatus;
  priority: PolicyPriority;
  regoCode: string;
  visualPolicy?: VisualPolicy;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  tenantId: string;
  tags: string[];
  metadata: PolicyMetadata;
  approvalStatus: ApprovalStatus;
  deploymentStatus: DeploymentStatus;
  lastTested?: Date;
  testResults?: PolicyTestResult[];
  versionHistory: PolicyVersion[];
  dependencies: PolicyDependency[];
  impact: PolicyImpact;
  securityContext: PolicySecurityContext;
}

export interface VisualPolicy {
  nodes: PolicyNode[];
  edges: PolicyEdge[];
  layout: LayoutConfig;
}

export interface PolicyNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  config: NodeConfig;
  security: NodeSecurity;
}

export interface PolicyEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  condition?: string;
  config: EdgeConfig;
  security: EdgeSecurity;
}

export type NodeType =
  | 'input'
  | 'condition'
  | 'action'
  | 'rule'
  | 'function'
  | 'transform'
  | 'validation'
  | 'output'
  | 'decision'
  | 'compliance';

export type EdgeType =
  | 'success'
  | 'failure'
  | 'conditional'
  | 'transform'
  | 'validate';

export interface NodeData {
  label: string;
  description?: string;
  parameters: Record<string, unknown>;
  logic?: string;
  output?: unknown;
  errors?: string[];
}

export interface NodeConfig {
  timeout?: number;
  retries?: number;
  cacheable?: boolean;
  parallel?: boolean;
  async?: boolean;
}

export interface NodeSecurity {
  accessLevel: SecurityLevel;
  requiredPermissions: string[];
  auditLog: boolean;
  encryptionRequired: boolean;
  validateInput: boolean;
  sanitizeOutput: boolean;
}

export interface EdgeConfig {
  weight?: number;
  priority?: number;
  condition?: string;
  transform?: string;
}

export interface EdgeSecurity {
  validateData: boolean;
  encryptTransit: boolean;
  auditTransit: boolean;
  rateLimit?: number;
}

export interface LayoutConfig {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  spacing: { x: number; y: number };
  alignment: 'center' | 'left' | 'right';
  zoom: number;
  viewport: { x: number; y: number; zoom: number };
}

export type PolicyCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'api_security'
  | 'compliance'
  | 'privacy'
  | 'resource_management'
  | 'audit'
  | 'custom';

export type PolicyStatus =
  | 'draft'
  | 'testing'
  | 'review'
  | 'approved'
  | 'deployed'
  | 'deprecated'
  | 'disabled';

export type PolicyPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type ApprovalStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'requires_changes'
  | 'escalated';

export type SecurityLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'secret'
  | 'top_secret';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PolicyVersion {
  version: number;
  createdAt: Date;
  createdBy: string;
  changelog: string;
  regoCode: string;
  visualPolicy?: VisualPolicy;
  metadata: PolicyMetadata;
  testResults?: PolicyTestResult[];
  checksum: string;
  signature?: string;
  approvedBy?: string;
  approvedAt?: Date;
  deploymentInfo?: DeploymentInfo;
}

export interface PolicyDependency {
  policyId: string;
  policyName: string;
  version: string;
  type: 'hard' | 'soft';
  required: boolean;
  impact: string;
}
