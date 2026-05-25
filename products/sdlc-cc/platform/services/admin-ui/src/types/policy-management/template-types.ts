/**
 * Policy Template Types
 *
 * Types for policy templates, parameters, metadata,
 * security configurations, and usage tracking
 */

import type { PolicyCategory, SecurityLevel } from './policy-types';
import type { VisualPolicy } from './policy-types';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  templateType: TemplateType;
  regoTemplate: string;
  visualTemplate?: VisualPolicy;
  parameters: TemplateParameter[];
  metadata: TemplateMetadata;
  security: TemplateSecurity;
  usage: TemplateUsage;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
}

export type TemplateType =
  | 'starter'
  | 'advanced'
  | 'compliance'
  | 'security'
  | 'custom';

export interface TemplateParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: unknown;
  description: string;
  validation: ParameterValidation;
  options?: ParameterOption[];
  group?: string;
}

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum'
  | 'json'
  | 'rego';

export interface ParameterValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  required: boolean;
  custom?: string;
}

export interface ParameterOption {
  value: unknown;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface TemplateMetadata {
  version: string;
  compatibility: string[];
  dependencies: string[];
  limitations: string[];
  examples: TemplateExample[];
  documentation: string;
  changelog: TemplateChangelog[];
}

export interface TemplateExample {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  result: string;
}

export interface TemplateChangelog {
  version: string;
  date: Date;
  changes: string[];
  breaking: boolean;
}

export interface TemplateSecurity {
  classification: SecurityLevel;
  requiredPermissions: string[];
  accessControls: string[];
  auditRequirements: string[];
  complianceFrameworks: string[];
  securityReview: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface TemplateUsage {
  usedBy: number;
  lastUsed?: Date;
  popularity: number;
  rating: number;
  feedback: TemplateFeedback[];
}

export interface TemplateFeedback {
  userId: string;
  rating: number;
  comment?: string;
  timestamp: Date;
  helpful: boolean;
}
