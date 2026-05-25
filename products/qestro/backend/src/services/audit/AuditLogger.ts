'use strict';

import crypto from 'crypto';
import {
  AuditEntry,
  AuditAction,
  AuditCategory,
  AuditFilter,
  ComplianceReport,
  AuditQueryResult,
} from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Audit Logger Service
 * Logs and queries user actions, API calls, and system events
 */
export class AuditLogger {
  private entries: Map<string, AuditEntry>;
  private indexByUser: Map<string, string[]>;
  private indexByProject: Map<string, string[]>;
  private indexByAction: Map<AuditAction, string[]>;

  constructor() {
    this.entries = new Map();
    this.indexByUser = new Map();
    this.indexByProject = new Map();
    this.indexByAction = new Map();
  }

  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    const auditEntry: AuditEntry = {
      ...entry,
      id,
      timestamp,
    };

    this.entries.set(id, auditEntry);

    // Update indexes
    this.indexByUser
      .set(entry.userId, [...(this.indexByUser.get(entry.userId) || []), id]);
    if (entry.projectId) {
      this.indexByProject
        .set(entry.projectId, [...(this.indexByProject.get(entry.projectId) || []), id]);
    }
    this.indexByAction
      .set(entry.action, [...(this.indexByAction.get(entry.action) || []), id]);

    logger.info(
      `Audit: ${entry.action} by ${entry.userId} (${entry.status})`
    );

    return auditEntry;
  }

  /**
   * Query audit logs with filtering
   */
  async query(filter: AuditFilter): Promise<AuditQueryResult> {
    let results = Array.from(this.entries.values());

    // Apply filters
    if (filter.userId) {
      results = results.filter((e) => e.userId === filter.userId);
    }
    if (filter.projectId) {
      results = results.filter((e) => e.projectId === filter.projectId);
    }
    if (filter.action) {
      results = results.filter((e) => e.action === filter.action);
    }
    if (filter.category) {
      results = results.filter((e) => e.category === filter.category);
    }
    if (filter.status) {
      results = results.filter((e) => e.status === filter.status);
    }
    if (filter.ipAddress) {
      results = results.filter((e) => e.ipAddress === filter.ipAddress);
    }
    if (filter.startDate) {
      results = results.filter((e) => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      results = results.filter((e) => e.timestamp <= filter.endDate!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = results.length;
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    const paginatedResults = results.slice(offset, offset + limit);

    return {
      entries: paginatedResults,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get user activity for a time period
   */
  async getUserActivity(userId: string, days: number = 30): Promise<AuditEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.query({
      userId,
      startDate,
      limit: 1000,
    });

    return result.entries;
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<ComplianceReport> {
    const result = await this.query({
      startDate,
      endDate,
      limit: 10000,
    });

    const entries = result.entries;

    // Build summary
    const uniqueUsers = new Set(entries.map((e) => e.userId));
    const uniqueProjects = new Set(entries.map((e) => e.projectId).filter(Boolean));

    const summary = {
      totalActions: entries.length,
      successfulActions: entries.filter((e) => e.status === 'success').length,
      failedActions: entries.filter((e) => e.status === 'failure').length,
      uniqueUsers: uniqueUsers.size,
      uniqueProjects: uniqueProjects.size,
    };

    // Category breakdown
    const actionBreakdown: Record<AuditCategory, number> = {
      authentication: 0,
      user_management: 0,
      project_management: 0,
      test_execution: 0,
      configuration: 0,
      security: 0,
      api_access: 0,
      data_export: 0,
      compliance: 0,
    };

    entries.forEach((e) => {
      actionBreakdown[e.category]++;
    });

    // User activity summary
    const userMap = new Map<string, {
      actionCount: number;
      categories: Set<AuditCategory>;
      lastActivity: Date;
    }>();

    entries.forEach((e) => {
      const existing = userMap.get(e.userId) || {
        actionCount: 0,
        categories: new Set(),
        lastActivity: e.timestamp,
      };
      existing.actionCount++;
      existing.categories.add(e.category);
      if (e.timestamp > existing.lastActivity) {
        existing.lastActivity = e.timestamp;
      }
      userMap.set(e.userId, existing);
    });

    const userActivity = Array.from(userMap.entries()).map(([userId, data]) => ({
      userId,
      email: entries.find((e) => e.userId === userId)?.userEmail || '',
      actionCount: data.actionCount,
      categories: Array.from(data.categories),
      lastActivity: data.lastActivity,
    }));

    // Security events
    const securityEvents = entries
      .filter((e) => e.category === 'security')
      .map((e) => ({
        timestamp: e.timestamp,
        action: e.action,
        userId: e.userId,
        details: e.description,
      }));

    // Data access events
    const dataAccess = entries
      .filter((e) => ['test.executed', 'report.generated', 'export.executed'].includes(e.action))
      .map((e) => ({
        timestamp: e.timestamp,
        userId: e.userId,
        resourceType: e.resourceType || 'unknown',
        resourceId: e.resourceId || '',
        action: e.action.includes('delete') ? 'delete' as const :
                e.action.includes('write') ? 'write' as const : 'read' as const,
      }));

    return {
      id: crypto.randomUUID(),
      organizationId,
      period: { startDate, endDate },
      summary,
      actionBreakdown,
      userActivity,
      securityEvents,
      dataAccess,
      generatedAt: new Date(),
      generatedBy: userId,
    };
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV(filter: AuditFilter): Promise<string> {
    const result = await this.query({ ...filter, limit: 100000 });
    const entries = result.entries;

    const headers = [
      'Timestamp',
      'User ID',
      'Email',
      'Action',
      'Category',
      'Project ID',
      'Status',
      'IP Address',
      'Description',
      'Error Message',
    ];

    const rows = entries.map((e) => [
      e.timestamp.toISOString(),
      e.userId,
      e.userEmail || '',
      e.action,
      e.category,
      e.projectId || '',
      e.status,
      e.ipAddress,
      e.description,
      e.errorMessage || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return csv;
  }

  /**
   * Get statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalActions: number;
    successRate: number;
    categories: Record<AuditCategory, number>;
    lastActivity: Date | null;
  }> {
    const activities = await this.getUserActivity(userId, 90);

    const categories: Record<AuditCategory, number> = {
      authentication: 0,
      user_management: 0,
      project_management: 0,
      test_execution: 0,
      configuration: 0,
      security: 0,
      api_access: 0,
      data_export: 0,
      compliance: 0,
    };

    activities.forEach((a) => {
      categories[a.category]++;
    });

    const successCount = activities.filter((a) => a.status === 'success').length;
    const successRate = activities.length > 0 ? (successCount / activities.length) * 100 : 0;

    return {
      totalActions: activities.length,
      successRate,
      categories,
      lastActivity: activities[0]?.timestamp || null,
    };
  }
}
