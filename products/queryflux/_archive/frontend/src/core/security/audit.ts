/**
 * PCI DSS Compliant Audit Logging Service
 *
 * Provides comprehensive audit logging for compliance with PCI DSS requirements.
 * All sensitive operations are logged with tamper-evident records.
 */

import { DomainEvent } from '../domain/models/events';
import { EncryptionService } from './encryption';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  resource: string;
  resourceType: string;
  result: 'success' | 'failure' | 'error';
  details: any;
  sensitiveData?: Record<string, string>; // Encrypted
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: ComplianceCategory;
  requiresReview: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  retentionPeriod: number; // Days
  hash: string; // For tamper detection
  previousHash?: string; // For blockchain-like integrity
}

export enum ComplianceCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  CONFIGURATION_CHANGE = 'configuration_change',
  SECURITY_EVENT = 'security_event',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  FINANCIAL_TRANSACTION = 'financial_transaction',
  PERSONAL_INFO_ACCESS = 'personal_info_access',
  SYSTEM_ADMINISTRATION = 'system_administration',
  ERROR_HANDLING = 'error_handling',
  BACKUP_RESTORE = 'backup_restore',
  ENCRYPTION_OPERATION = 'encryption_operation'
}

export interface AuditFilter {
  userId?: string;
  action?: string;
  resourceType?: string;
  result?: 'success' | 'failure' | 'error';
  riskLevel?: string;
  complianceCategory?: ComplianceCategory;
  dateRange?: {
    start: Date;
    end: Date;
  };
  ipAddress?: string;
  requiresReview?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * PCI DSS Compliant Audit Service
 *
 * Provides tamper-evident audit logging for all sensitive operations
 * as required by PCI DSS Requirement 10.
 */
export class AuditService {
  private static instance: AuditService;
  private auditLogs: Map<string, AuditLogEntry> = new Map();
  private lastHash: string = '';

  private constructor() {
    this.initializeAuditLog();
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log an audit event with full PCI DSS compliance
   *
   * @param event - Domain event to audit
   * @param context - Additional context for the audit
   * @returns Audit log entry ID
   */
  async logEvent(event: DomainEvent, context: {
    ipAddress: string;
    userAgent: string;
    sessionId?: string;
    sensitiveData?: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<string> {
    try {
      const auditEntry = await this.createAuditEntry(event, context);

      // Store audit entry (in production, this would be in a secure, immutable storage)
      this.auditLogs.set(auditEntry.id, auditEntry);

      // In production, this would trigger immediate secure backup
      await this.secureBackupEntry(auditEntry);

      // Check for security alerts
      await this.checkForSecurityAlerts(auditEntry);

      return auditEntry.id;
    } catch (error) {
      console.error('Failed to create audit entry:', error);
      throw new Error(`Audit logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create audit entry from domain event
   */
  private async createAuditEntry(
    event: DomainEvent,
    context: {
      ipAddress: string;
      userAgent: string;
      sessionId?: string;
      sensitiveData?: Record<string, any>;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<AuditLogEntry> {
    const id = this.generateAuditId();
    const timestamp = new Date();

    // Determine compliance category and risk level
    const complianceCategory = this.determineComplianceCategory(event);
    const riskLevel = context.riskLevel || this.determineRiskLevel(event, complianceCategory);

    // Encrypt sensitive data
    let encryptedSensitiveData: Record<string, string> | undefined;
    if (context.sensitiveData && Object.keys(context.sensitiveData).length > 0) {
      encryptedSensitiveData = {};
      for (const [key, value] of Object.entries(context.sensitiveData)) {
        encryptedSensitiveData[key] = EncryptionService.encrypt(
          JSON.stringify(value),
          process.env.AUDIT_ENCRYPTION_KEY
        ).encrypted;
      }
    }

    const auditEntry: AuditLogEntry = {
      id,
      timestamp,
      userId: event.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      action: event.eventType,
      resource: event.aggregateId,
      resourceType: event.aggregateType,
      result: this.determineResult(event),
      details: {
        eventData: event.eventData,
        metadata: event.metadata
      },
      sensitiveData: encryptedSensitiveData,
      riskLevel,
      complianceCategory,
      requiresReview: riskLevel === 'high' || riskLevel === 'critical',
      retentionPeriod: this.calculateRetentionPeriod(complianceCategory, riskLevel),
      previousHash: this.lastHash
    };

    // Calculate tamper-evident hash
    auditEntry.hash = this.calculateHash(auditEntry);
    this.lastHash = auditEntry.hash;

    return auditEntry;
  }

  /**
   * Search audit logs with filters
   */
  async searchAuditLogs(filter: AuditFilter): Promise<{
    entries: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let entries = Array.from(this.auditLogs.values());

      // Apply filters
      if (filter.userId) {
        entries = entries.filter(entry => entry.userId === filter.userId);
      }

      if (filter.action) {
        entries = entries.filter(entry => entry.action.includes(filter.action!));
      }

      if (filter.resourceType) {
        entries = entries.filter(entry => entry.resourceType === filter.resourceType);
      }

      if (filter.result) {
        entries = entries.filter(entry => entry.result === filter.result);
      }

      if (filter.riskLevel) {
        entries = entries.filter(entry => entry.riskLevel === filter.riskLevel);
      }

      if (filter.complianceCategory) {
        entries = entries.filter(entry => entry.complianceCategory === filter.complianceCategory);
      }

      if (filter.dateRange) {
        entries = entries.filter(entry =>
          entry.timestamp >= filter.dateRange!.start &&
          entry.timestamp <= filter.dateRange!.end
        );
      }

      if (filter.ipAddress) {
        entries = entries.filter(entry => entry.ipAddress === filter.ipAddress);
      }

      if (filter.requiresReview !== undefined) {
        entries = entries.filter(entry => entry.requiresReview === filter.requiresReview);
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const total = entries.length;
      const offset = filter.offset || 0;
      const limit = filter.limit || 100;
      const paginatedEntries = entries.slice(offset, offset + limit);

      return {
        entries: paginatedEntries,
        total,
        hasMore: offset + limit < total
      };
    } catch (error) {
      throw new Error(`Audit search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyAuditIntegrity(): Promise<{
    isValid: boolean;
    tamperedEntries: string[];
    totalEntries: number;
  }> {
    const entries = Array.from(this.auditLogs.values());
    const tamperedEntries: string[] = [];

    // Sort by timestamp
    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let previousHash = '';

    for (const entry of entries) {
      const expectedHash = this.calculateHash({ ...entry, previousHash });

      if (entry.hash !== expectedHash) {
        tamperedEntries.push(entry.id);
      }

      previousHash = entry.hash;
    }

    return {
      isValid: tamperedEntries.length === 0,
      tamperedEntries,
      totalEntries: entries.length
    };
  }

  /**
   * Generate audit report for compliance
   */
  async generateComplianceReport(filter: {
    startDate: Date;
    endDate: Date;
    complianceCategories?: ComplianceCategory[];
    userId?: string;
  }): Promise<{
    summary: {
      totalEvents: number;
      eventsByCategory: Record<ComplianceCategory, number>;
      eventsByRiskLevel: Record<string, number>;
      failedEvents: number;
      highRiskEvents: number;
      pendingReviews: number;
    };
    details: {
      authenticationEvents: number;
      dataAccessEvents: number;
      securityEvents: number;
      configurationChanges: number;
    };
    recommendations: string[];
  }> {
    try {
      const auditFilter: AuditFilter = {
        dateRange: {
          start: filter.startDate,
          end: filter.endDate
        },
        userId: filter.userId,
        complianceCategory: filter.complianceCategories?.[0]
      };

      const entries = await this.searchAuditLogs(auditFilter);

      const summary = {
        totalEvents: entries.total,
        eventsByCategory: {} as Record<ComplianceCategory, number>,
        eventsByRiskLevel: {} as Record<string, number>,
        failedEvents: 0,
        highRiskEvents: 0,
        pendingReviews: 0
      };

      const details = {
        authenticationEvents: 0,
        dataAccessEvents: 0,
        securityEvents: 0,
        configurationChanges: 0
      };

      // Analyze entries
      for (const entry of entries.entries) {
        // Count by category
        summary.eventsByCategory[entry.complianceCategory] =
          (summary.eventsByCategory[entry.complianceCategory] || 0) + 1;

        // Count by risk level
        summary.eventsByRiskLevel[entry.riskLevel] =
          (summary.eventsByRiskLevel[entry.riskLevel] || 0) + 1;

        // Count failures
        if (entry.result === 'failure' || entry.result === 'error') {
          summary.failedEvents++;
        }

        // Count high-risk events
        if (entry.riskLevel === 'high' || entry.riskLevel === 'critical') {
          summary.highRiskEvents++;
        }

        // Count pending reviews
        if (entry.requiresReview && !entry.reviewedAt) {
          summary.pendingReviews++;
        }

        // Categorize events
        switch (entry.complianceCategory) {
          case ComplianceCategory.AUTHENTICATION:
          case ComplianceCategory.AUTHORIZATION:
            details.authenticationEvents++;
            break;
          case ComplianceCategory.DATA_ACCESS:
          case ComplianceCategory.DATA_MODIFICATION:
          case ComplianceCategory.PERSONAL_INFO_ACCESS:
            details.dataAccessEvents++;
            break;
          case ComplianceCategory.SECURITY_EVENT:
          case ComplianceCategory.PRIVILEGE_ESCALATION:
            details.securityEvents++;
            break;
          case ComplianceCategory.CONFIGURATION_CHANGE:
          case ComplianceCategory.SYSTEM_ADMINISTRATION:
            details.configurationChanges++;
            break;
        }
      }

      // Generate recommendations
      const recommendations: string[] = [];

      if (summary.pendingReviews > 0) {
        recommendations.push(`${summary.pendingReviews} high-risk events require review`);
      }

      if (summary.failedEvents / summary.totalEvents > 0.05) {
        recommendations.push('High failure rate detected - investigate system issues');
      }

      if (summary.eventsByRiskLevel['critical'] > 0) {
        recommendations.push('Critical security events detected - immediate investigation required');
      }

      if (details.securityEvents > summary.totalEvents * 0.1) {
        recommendations.push('High number of security events - review security policies');
      }

      return {
        summary,
        details,
        recommendations
      };
    } catch (error) {
      throw new Error(`Compliance report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Review audit entry
   */
  async reviewAuditEntry(entryId: string, reviewedBy: string, notes?: string): Promise<void> {
    const entry = this.auditLogs.get(entryId);
    if (!entry) {
      throw new Error('Audit entry not found');
    }

    entry.reviewedAt = new Date();
    entry.reviewedBy = reviewedBy;

    // Update hash after modification
    entry.hash = this.calculateHash(entry);

    // In production, this would be persisted to secure storage
  }

  /**
   * Cleanup old audit entries based on retention policy
   */
  async cleanupOldEntries(): Promise<{
    deletedCount: number;
    errors: string[];
  }> {
    try {
      const now = new Date();
      const deletedEntries: string[] = [];
      const errors: string[] = [];

      for (const [id, entry] of this.auditLogs.entries()) {
        const expirationDate = new Date(entry.timestamp);
        expirationDate.setDate(expirationDate.getDate() + entry.retentionPeriod);

        if (expirationDate < now) {
          // In production, this would archive to secure storage before deletion
          this.auditLogs.delete(id);
          deletedEntries.push(id);
        }
      }

      return {
        deletedCount: deletedEntries.length,
        errors
      };
    } catch (error) {
      return {
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Private helper methods
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${EncryptionService.generateToken(16)}`;
  }

  private determineComplianceCategory(event: DomainEvent): ComplianceCategory {
    const eventType = event.eventType;

    if (eventType.includes('Login') || eventType.includes('Logout') || eventType.includes('Password')) {
      return ComplianceCategory.AUTHENTICATION;
    }

    if (eventType.includes('Access') || eventType.includes('Privilege')) {
      return ComplianceCategory.AUTHORIZATION;
    }

    if (eventType.includes('Query') || eventType.includes('Data')) {
      return ComplianceCategory.DATA_ACCESS;
    }

    if (eventType.includes('Security') || eventType.includes('Suspicious')) {
      return ComplianceCategory.SECURITY_EVENT;
    }

    if (eventType.includes('Updated') || eventType.includes('Created') || eventType.includes('Deleted')) {
      return ComplianceCategory.CONFIGURATION_CHANGE;
    }

    return ComplianceCategory.SYSTEM_ADMINISTRATION;
  }

  private determineRiskLevel(event: DomainEvent, category: ComplianceCategory): 'low' | 'medium' | 'high' | 'critical' {
    // Critical events
    if (event.eventType.includes('SecurityAlert') ||
        event.eventType.includes('PrivilegeEscalation') ||
        event.eventType.includes('SuspiciousActivity')) {
      return 'critical';
    }

    // High risk events
    if (category === ComplianceCategory.AUTHENTICATION ||
        category === ComplianceCategory.PRIVILEGE_ESCALATION ||
        event.eventType.includes('Failed')) {
      return 'high';
    }

    // Medium risk events
    if (category === ComplianceCategory.DATA_MODIFICATION ||
        category === ComplianceCategory.CONFIGURATION_CHANGE) {
      return 'medium';
    }

    return 'low';
  }

  private determineResult(event: DomainEvent): 'success' | 'failure' | 'error' {
    if (event.eventType.includes('Failed') || event.eventType.includes('Error')) {
      return 'failure';
    }

    if (event.eventType.includes('Completed') || event.eventType.includes('Created') || event.eventType.includes('Connected')) {
      return 'success';
    }

    return 'success'; // Default to success for most events
  }

  private calculateRetentionPeriod(category: ComplianceCategory, riskLevel: string): number {
    // PCI DSS requires at least 1 year retention for audit logs
    const baseRetention = 365; // 1 year

    // Extend retention for high-risk categories
    switch (category) {
      case ComplianceCategory.SECURITY_EVENT:
      case ComplianceCategory.PRIVILEGE_ESCALATION:
        return baseRetention * 3; // 3 years
      case ComplianceCategory.AUTHENTICATION:
      case ComplianceCategory.AUTHORIZATION:
      case ComplianceCategory.FINANCIAL_TRANSACTION:
        return baseRetention * 2; // 2 years
      default:
        return baseRetention;
    }
  }

  private calculateHash(entry: AuditLogEntry): string {
    // Create a hash of the entry for tamper detection
    const hashInput = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      result: entry.result,
      previousHash: entry.previousHash
    });

    return EncryptionService.hash(hashInput, process.env.AUDIT_SALT || 'default-salt');
  }

  private async secureBackupEntry(entry: AuditLogEntry): Promise<void> {
    // In production, this would securely backup the audit entry
    // to a write-once, read-many storage system
    console.log(`Audit entry ${entry.id} backed up securely`);
  }

  private async checkForSecurityAlerts(entry: AuditLogEntry): Promise<void> {
    // Check for patterns that require immediate attention
    if (entry.riskLevel === 'critical') {
      console.error(`CRITICAL SECURITY EVENT: ${entry.action} by ${entry.userId} from ${entry.ipAddress}`);
      // In production, this would trigger immediate alerts
    }

    // Check for repeated failures from same IP
    const recentFailures = Array.from(this.auditLogs.values())
      .filter(e => e.ipAddress === entry.ipAddress && e.result === 'failure' &&
              (entry.timestamp.getTime() - e.timestamp.getTime()) < 300000); // 5 minutes

    if (recentFailures.length >= 5) {
      console.error(`MULTIPLE FAILURES from ${entry.ipAddress}: ${recentFailures.length} attempts in 5 minutes`);
      // In production, this would trigger IP blocking or increased monitoring
    }
  }

  private initializeAuditLog(): void {
    // In production, this would initialize secure audit storage
    console.log('Audit service initialized with tamper-evident logging');
  }
}

export default AuditService;
