'use strict';

/**
 * Audit Action Types
 * All trackable actions in the system
 */
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'test.created'
  | 'test.updated'
  | 'test.executed'
  | 'test.deleted'
  | 'webhook.created'
  | 'webhook.updated'
  | 'webhook.deleted'
  | 'api_key.generated'
  | 'api_key.revoked'
  | 'settings.changed'
  | 'role.assigned'
  | 'permission.granted'
  | 'permission.revoked'
  | 'report.generated'
  | 'export.executed';

/**
 * Audit Category
 * Grouping of related audit actions
 */
export type AuditCategory =
  | 'authentication'
  | 'user_management'
  | 'project_management'
  | 'test_execution'
  | 'configuration'
  | 'security'
  | 'api_access'
  | 'data_export'
  | 'compliance';

/**
 * Audit Entry
 * Individual audit log record
 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail?: string;
  action: AuditAction;
  category: AuditCategory;
  projectId?: string;
  resourceId?: string;
  resourceType?: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  changes?: Record<string, { before: any; after: any }>;
  metadata?: Record<string, any>;
}

/**
 * Audit Filter
 * Query criteria for audit logs
 */
export interface AuditFilter {
  userId?: string;
  projectId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  status?: 'success' | 'failure';
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

/**
 * Compliance Report
 * Aggregated audit data for compliance purposes
 */
export interface ComplianceReport {
  id: string;
  organizationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    uniqueUsers: number;
    uniqueProjects: number;
  };
  actionBreakdown: Record<AuditCategory, number>;
  userActivity: Array<{
    userId: string;
    email: string;
    actionCount: number;
    categories: string[];
    lastActivity: Date;
  }>;
  securityEvents: Array<{
    timestamp: Date;
    action: AuditAction;
    userId: string;
    details: string;
  }>;
  dataAccess: Array<{
    timestamp: Date;
    userId: string;
    resourceType: string;
    resourceId: string;
    action: 'read' | 'write' | 'delete';
  }>;
  generatedAt: Date;
  generatedBy: string;
}

/**
 * Audit Query Result
 */
export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}
