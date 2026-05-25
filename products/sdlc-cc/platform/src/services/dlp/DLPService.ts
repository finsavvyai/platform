/** DLP Service - Data Loss Prevention Pipeline orchestrator */
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { DLPConfig, DLPScanRequest, DLPScanResult, DLPRule, DLPPolicy } from '../../types/dlp';
import { ClassificationEngine } from './classification-engine';
import { MaskingEngine } from './masking-engine';
import { EncryptionEngine } from './encryption-engine';
import { AuditLogger } from './audit-logger';
import { QuarantineManager } from './quarantine-manager';
import { evaluateRules } from './dlp-condition-evaluator';
import { getDefaultRules, getDefaultPolicies, validateRule, validatePolicy } from './dlp-defaults';
import { preprocessData, assessRisk, applyPolicies, executeActions } from './dlp-helpers';
import { generateRecommendations, groupBy, calculateAverage, getTopViolations } from './dlp-stats';

export { ClassificationEngine } from './classification-engine';
export { MaskingEngine } from './masking-engine';
export { EncryptionEngine } from './encryption-engine';
export { AuditLogger } from './audit-logger';
export { QuarantineManager } from './quarantine-manager';

export class DLPService extends EventEmitter {
  private config: DLPConfig;
  private rules: Map<string, DLPRule> = new Map();
  private policies: Map<string, DLPPolicy> = new Map();
  private classificationEngine: ClassificationEngine;
  private maskingEngine: MaskingEngine;
  private encryptionEngine: EncryptionEngine;
  private auditLogger: AuditLogger;
  private quarantineManager: QuarantineManager;

  constructor(config: DLPConfig) {
    super();
    this.config = config;
    this.classificationEngine = new ClassificationEngine(config.classification);
    this.maskingEngine = new MaskingEngine(config.masking);
    this.encryptionEngine = new EncryptionEngine(config.encryption);
    this.auditLogger = new AuditLogger(config.audit);
    this.quarantineManager = new QuarantineManager(config.quarantine);
    this.rules = getDefaultRules();
    this.policies = getDefaultPolicies();
  }

  async scanData(request: DLPScanRequest): Promise<DLPScanResult> {
    const scanId = crypto.randomUUID();
    const startTime = Date.now();
    logger.info('DLP scan started', { scanId, dataSource: request.dataSource, userId: request.userId });
    try {
      const processedData = await preprocessData(request.data);
      const classification = await this.classificationEngine.classify(processedData);
      const ruleViolations = await evaluateRules(this.rules, processedData, classification);
      const policyActions = await applyPolicies(this.policies, classification, ruleViolations, request.context);
      const riskLevel = assessRisk(classification, ruleViolations);
      const actionResults = await executeActions(
        processedData, policyActions, request,
        this.maskingEngine, this.encryptionEngine, this.auditLogger, this.quarantineManager, this
      );

      const scanResult: DLPScanResult = {
        scanId, timestamp: new Date().toISOString(),
        userId: request.userId, dataSource: request.dataSource,
        classification, riskLevel, violations: ruleViolations,
        actions: policyActions, actionResults,
        metrics: {
          scanDuration: Date.now() - startTime,
          dataItemsProcessed: Array.isArray(processedData) ? processedData.length : 1,
          rulesEvaluated: this.rules.size, policiesApplied: policyActions.length
        },
        recommendations: generateRecommendations(classification, ruleViolations)
      };

      await this.auditLogger.logScan(scanResult);
      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        await this.quarantineManager.quarantine(scanResult);
      }
      this.emit('scanCompleted', scanResult);
      if (riskLevel === 'CRITICAL') this.emit('criticalRiskDetected', scanResult);
      return scanResult;
    } catch (error) {
      return this.handleScanError(error, scanId, startTime, request);
    }
  }
  /** Real-time streaming DLP scan */
  async scanStream(
    stream: NodeJS.ReadableStream, request: DLPScanRequest
  ): Promise<NodeJS.ReadableStream> {
    const { Transform } = await import('stream');
    const dlpTransformer = new Transform({
      objectMode: true,
      transform: async (chunk, _encoding, callback) => {
        try {
          const result = await this.scanData({ ...request, data: chunk });
          let out = chunk;
          for (const ar of result.actionResults) {
            if (ar.status === 'success' && ar.result?.processedData) out = ar.result.processedData;
          }
          this.emit('streamChunkProcessed', { chunkId: crypto.randomUUID(), result });
          callback(null, out);
        } catch (err) { callback(err); }
      }
    });
    return stream.pipe(dlpTransformer);
  }

  /** Batch scanning for large datasets */
  async scanBatch(requests: DLPScanRequest[]): Promise<DLPScanResult[]> {
    const batchSize = this.config.batchSize || 100;
    const results: DLPScanResult[] = [];
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const settled = await Promise.allSettled(batch.map(req => this.scanData(req)));
      settled.forEach((r, idx) => {
        if (r.status === 'fulfilled') results.push(r.value);
        else logger.error('Batch scan item failed', { batchIndex: i + idx, error: r.reason });
      });
      const done = Math.min(i + batchSize, requests.length);
      this.emit('batchProgress', {
        processed: done, total: requests.length,
        percentage: Math.round((done / requests.length) * 100)
      });
    }
    return results;
  }

  async addRule(rule: DLPRule): Promise<void> {
    validateRule(rule);
    this.rules.set(rule.id, rule);
    await this.auditLogger.logRuleChange({
      action: 'ADD', ruleId: rule.id, rule, timestamp: new Date().toISOString(), userId: 'system'
    });
    this.emit('ruleAdded', rule);
  }

  async updateRule(ruleId: string, updates: Partial<DLPRule>): Promise<void> {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) throw new Error(`Rule not found: ${ruleId}`);
    const updatedRule = { ...existingRule, ...updates, id: ruleId };
    validateRule(updatedRule);
    this.rules.set(ruleId, updatedRule);
    await this.auditLogger.logRuleChange({
      action: 'UPDATE', ruleId, previousRule: existingRule, updatedRule,
      timestamp: new Date().toISOString(), userId: 'system'
    });
    this.emit('ruleUpdated', updatedRule);
  }

  async removeRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    this.rules.delete(ruleId);
    await this.auditLogger.logRuleChange({
      action: 'REMOVE', ruleId, rule, timestamp: new Date().toISOString(), userId: 'system'
    });
    this.emit('ruleRemoved', ruleId);
  }

  async addPolicy(policy: DLPPolicy): Promise<void> {
    validatePolicy(policy);
    this.policies.set(policy.id, policy);
    await this.auditLogger.logPolicyChange({
      action: 'ADD', policyId: policy.id, policy, timestamp: new Date().toISOString(), userId: 'system'
    });
    this.emit('policyAdded', policy);
  }

  async getStats(timeRange?: { start: string; end: string }) {
    const [scans, violations] = await Promise.all([
      this.auditLogger.getScans(timeRange), this.auditLogger.getViolations(timeRange)
    ]);
    return {
      totalScans: scans.length, totalViolations: violations.length,
      scansByRiskLevel: groupBy(scans, 'riskLevel'),
      scansByDataType: groupBy(scans, 'classification.type'),
      violationsByRule: groupBy(violations, 'ruleId'),
      violationsBySeverity: groupBy(violations, 'severity'),
      averageScanTime: calculateAverage(scans, 'metrics.scanDuration'),
      quarantineCount: await this.quarantineManager.getQuarantineCount(),
      topViolations: getTopViolations(violations, 10)
    };
  }

  private async handleScanError(
    error: Error, scanId: string, startTime: number, req: DLPScanRequest
  ): Promise<DLPScanResult> {
    logger.error('DLP scan failed', { scanId, error: error.message });
    const result: DLPScanResult = {
      scanId, timestamp: new Date().toISOString(), userId: req.userId,
      dataSource: req.dataSource,
      classification: { type: 'UNKNOWN', confidence: 0, tags: [] },
      riskLevel: 'ERROR', violations: [], actions: [], actionResults: [],
      metrics: {
        scanDuration: Date.now() - startTime,
        dataItemsProcessed: 0, rulesEvaluated: 0, policiesApplied: 0
      },
      error: error.message
    };
    await this.auditLogger.logScan(result);
    return result;
  }
}
