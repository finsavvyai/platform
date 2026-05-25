/**
 * DLP Helper utilities - risk assessment, policy evaluation, action execution
 */

import crypto from 'crypto';
import { logger } from '../../utils/logger';
import {
  DLPScanRequest,
  DataClassification,
  DLPAction,
  DLPActionResult,
  DLPViolation,
  RiskLevel,
  DataType,
  ViolationSeverity,
  ProcessedData,
  DLPAlertParams,
  DLPScanContext,
  DLPPolicy,
} from '../../types/dlp';
import { EventEmitter } from 'events';
import { MaskingEngine } from './masking-engine';
import { EncryptionEngine } from './encryption-engine';
import { AuditLogger } from './audit-logger';
import { QuarantineManager } from './quarantine-manager';

export function preprocessData(data: ProcessedData | string | Buffer | unknown): ProcessedData {
  if (typeof data === 'string') {
    return { text: data };
  } else if (Buffer.isBuffer(data)) {
    return {
      binary: data,
      text: data.toString('utf8', 0, Math.min(1024, data.length))
    };
  } else if (typeof data === 'object') {
    return data as ProcessedData;
  }
  return { value: data };
}

export function assessRisk(classification: DataClassification, violations: DLPViolation[]): RiskLevel {
  let riskScore = getBaseRiskScore(classification.type);
  for (const violation of violations) {
    riskScore += getViolationRiskScore(violation.severity);
  }
  if (riskScore >= 90) return 'CRITICAL';
  if (riskScore >= 70) return 'HIGH';
  if (riskScore >= 40) return 'MEDIUM';
  if (riskScore >= 20) return 'LOW';
  return 'NONE';
}

function getBaseRiskScore(dataType: DataType): number {
  const scores = {
    'PII': 80, 'PHI': 90, 'FINANCIAL': 75, 'CONFIDENTIAL': 60,
    'INTERNAL': 30, 'PUBLIC': 0, 'UNKNOWN': 10
  };
  return scores[dataType] || 10;
}

function getViolationRiskScore(severity: ViolationSeverity): number {
  const scores: Record<ViolationSeverity, number> = {
    'CRITICAL': 30, 'HIGH': 20, 'MEDIUM': 10, 'LOW': 5
  };
  return scores[severity] ?? 0;
}

export async function applyPolicies(
  policies: Map<string, DLPPolicy>,
  classification: DataClassification,
  violations: DLPViolation[],
  context: DLPScanContext | undefined
): Promise<DLPAction[]> {
  const actions: DLPAction[] = [];
  for (const policy of policies.values()) {
    if (policyApplies(policy, classification, violations, context)) {
      actions.push(...policy.actions);
    }
  }
  return actions;
}

function policyApplies(
  policy: DLPPolicy, classification: DataClassification,
  violations: DLPViolation[], context: DLPScanContext | undefined
): boolean {
  if (policy.conditions.dataTypes && !policy.conditions.dataTypes.includes(classification.type)) {
    return false;
  }
  const riskLevel = assessRisk(classification, violations);
  if (policy.conditions.riskLevels && !policy.conditions.riskLevels.includes(riskLevel)) {
    return false;
  }
  if (policy.conditions.users && !policy.conditions.users.includes(context.userId)) {
    return false;
  }
  if (policy.conditions.roles && !context.roles?.some(role => policy.conditions.roles.includes(role))) {
    return false;
  }
  if (policy.conditions.violationTypes && violations.length === 0) {
    return false;
  }
  return true;
}

export async function executeActions(
  data: ProcessedData, actions: DLPAction[], request: DLPScanRequest,
  maskingEngine: MaskingEngine, encryptionEngine: EncryptionEngine,
  auditLogger: AuditLogger, quarantineManager: QuarantineManager,
  emitter: EventEmitter
): Promise<DLPActionResult[]> {
  const results: DLPActionResult[] = [];

  for (const action of actions) {
    try {
      let result;
      switch (action.type) {
        case 'MASK':
          result = await maskingEngine.mask(data, action.params);
          break;
        case 'ENCRYPT':
          result = await encryptionEngine.encrypt(data, action.params);
          break;
        case 'BLOCK':
          result = { blocked: true, reason: action.params?.reason };
          break;
        case 'ALERT':
          await sendAlert(action.params, request, emitter);
          result = { alerted: true };
          break;
        case 'QUARANTINE':
          await quarantineManager.quarantineData(data, action.params);
          result = { quarantined: true };
          break;
        case 'LOG':
          await auditLogger.logCustomAction(action, request);
          result = { logged: true };
          break;
        default:
          result = { skipped: true, reason: `Unknown action type: ${action.type}` };
      }
      results.push({ actionId: action.id, type: action.type, status: 'success', result });
    } catch (error) {
      results.push({ actionId: action.id, type: action.type, status: 'error', error: error.message });
    }
  }
  return results;
}

async function sendAlert(
  params: DLPAlertParams, request: DLPScanRequest, emitter: EventEmitter
): Promise<void> {
  const alert = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: request.userId,
    dataSource: request.dataSource,
    severity: params.severity || 'MEDIUM',
    message: params.message || 'DLP policy violation detected',
    recipients: params.recipients || [],
    metadata: params.metadata || {}
  };
  emitter.emit('alert', alert);
  logger.warn('DLP alert sent', alert);
}
