/**
 * AuditLogger - DLP audit logging for scans, rule changes, and policy changes
 */

import crypto from 'crypto';
import {
  DLPConfig,
  DLPScanResult,
  DLPAction,
  DLPScanRequest,
  DLPViolation,
  AuditLog,
  RuleChangeEntry,
  PolicyChangeEntry,
} from '../../types/dlp';

export class AuditLogger {
  private config: DLPConfig['audit'];
  private logs: AuditLog[] = [];

  constructor(config: DLPConfig['audit']) {
    this.config = config;
  }

  async logScan(result: DLPScanResult): Promise<void> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'SCAN',
      userId: result.userId,
      dataSource: result.dataSource,
      riskLevel: result.riskLevel,
      classification: result.classification,
      violations: result.violations.length,
      actions: result.actions.length,
      duration: result.metrics.scanDuration,
      metadata: {
        scanId: result.scanId,
        policies: result.actions.map(a => a.id)
      }
    };

    this.logs.push(log);

    if (this.config.storage === 'database') {
      await this.persistToDatabase(log);
    }
  }

  async logRuleChange(change: RuleChangeEntry): Promise<void> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: change.timestamp,
      type: 'RULE_CHANGE',
      userId: change.userId,
      action: change.action,
      ruleId: change.ruleId,
      metadata: {
        rule: change.rule || change.updatedRule,
        previousRule: change.previousRule
      }
    };

    this.logs.push(log);
  }

  async logPolicyChange(change: PolicyChangeEntry): Promise<void> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: change.timestamp,
      type: 'POLICY_CHANGE',
      userId: change.userId,
      action: change.action,
      policyId: change.policyId,
      metadata: {
        policy: change.policy || change.updatedPolicy,
        previousPolicy: change.previousPolicy
      }
    };

    this.logs.push(log);
  }

  async logCustomAction(action: DLPAction, request: DLPScanRequest): Promise<void> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'CUSTOM_ACTION',
      userId: request.userId,
      dataSource: request.dataSource,
      action: action.type,
      metadata: {
        actionId: action.id,
        params: action.params
      }
    };

    this.logs.push(log);
  }

  async getScans(timeRange?: { start: string; end: string }): Promise<DLPScanResult[]> {
    // In production, query from database
    return [];
  }

  async getViolations(timeRange?: { start: string; end: string }): Promise<DLPViolation[]> {
    // In production, query from database
    return [];
  }

  private async persistToDatabase(log: AuditLog): Promise<void> {
    // Implement database persistence
  }
}
