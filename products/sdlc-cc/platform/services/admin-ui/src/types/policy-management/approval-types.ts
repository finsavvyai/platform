/**
 * Policy Approval Types
 *
 * Types for approval workflows, reviewers, decisions,
 * escalation policies, and approval comments
 */

import type { ApprovalStatus } from './policy-types';

export type ApprovalType =
  | 'deployment'
  | 'change'
  | 'security'
  | 'compliance'
  | 'emergency';

export interface PolicyApproval {
  id: string;
  policyId: string;
  version: number;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  reviewers: Reviewer[];
  decisions: ApprovalDecision[];
  deadline?: Date;
  escalationPolicy?: EscalationPolicy;
  conditions: ApprovalCondition[];
  comments: ApprovalComment[];
}

export interface Reviewer {
  id: string;
  name: string;
  email: string;
  role: string;
  required: boolean;
  order?: number;
  delegatedTo?: string;
  votedAt?: Date;
}

export interface ApprovalDecision {
  reviewerId: string;
  decision: 'approve' | 'reject' | 'request_changes';
  comment?: string;
  conditions?: string[];
  timestamp: Date;
  signature?: string;
}

export interface ApprovalCondition {
  type: string;
  description: string;
  required: boolean;
  met: boolean;
  evidence?: string;
}

export interface ApprovalComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: Date;
  type: 'comment' | 'suggestion' | 'issue' | 'approval';
  visibility: 'public' | 'reviewers' | 'private';
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
  enabled: boolean;
  notifyStakeholders: boolean;
  autoApproveAfter?: Date;
  conditions: EscalationCondition[];
}

export interface EscalationLevel {
  level: number;
  delay: number;
  recipients: string[];
  message?: string;
  requireAll: boolean;
}

export interface EscalationCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  action: 'notify' | 'escalate' | 'auto_approve';
}
