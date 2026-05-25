/**
 * DLP Service - Data Loss Prevention Pipeline
 * Implements comprehensive data scanning, classification, and protection
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import {
  DLPConfig,
  DLPScanRequest,
  DLPScanResult,
  DataClassification,
  DLPRule,
  DLPPolicy,
  DLPAction,
  RiskLevel,
  DataType,
  MaskingMethod,
  EncryptionSpec,
  AuditLog,
  QuarantineRecord
} from '@/types/dlp';

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

    this.initializeDefaultRules();
    this.initializeDefaultPolicies();
  }

  /**
   * Main DLP scanning pipeline
   */
  async scanData(request: DLPScanRequest): Promise<DLPScanResult> {
    const scanId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info('DLP scan started', {
      scanId,
      dataSource: request.dataSource,
      userId: request.userId
    });

    try {
      // Phase 1: Data Preprocessing
      const processedData = await this.preprocessData(request.data);

      // Phase 2: Classification
      const classification = await this.classificationEngine.classify(processedData);

      // Phase 3: Rule Evaluation
      const ruleViolations = await this.evaluateRules(processedData, classification);

      // Phase 4: Policy Application
      const policyActions = await this.applyPolicies(classification, ruleViolations, request.context);

      // Phase 5: Risk Assessment
      const riskLevel = this.assessRisk(classification, ruleViolations);

      // Phase 6: Apply Actions
      const actionResults = await this.executeActions(processedData, policyActions, request);

      // Phase 7: Generate Report
      const scanResult: DLPScanResult = {
        scanId,
        timestamp: new Date().toISOString(),
        userId: request.userId,
        dataSource: request.dataSource,
        classification,
        riskLevel,
        violations: ruleViolations,
        actions: policyActions,
        actionResults,
        metrics: {
          scanDuration: Date.now() - startTime,
          dataItemsProcessed: Array.isArray(processedData) ? processedData.length : 1,
          rulesEvaluated: this.rules.size,
          policiesApplied: policyActions.length
        },
        recommendations: this.generateRecommendations(classification, ruleViolations)
      };

      // Phase 8: Audit & Logging
      await this.auditLogger.logScan(scanResult);

      // Phase 9: Handle Quarantine if necessary
      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        await this.quarantineManager.quarantine(scanResult);
      }

      // Emit events for real-time monitoring
      this.emit('scanCompleted', scanResult);

      if (riskLevel === 'CRITICAL') {
        this.emit('criticalRiskDetected', scanResult);
      }

      logger.info('DLP scan completed', {
        scanId,
        riskLevel,
        violations: ruleViolations.length,
        duration: scanResult.metrics.scanDuration
      });

      return scanResult;

    } catch (error) {
      logger.error('DLP scan failed', {
        scanId,
        error: error.message,
        stack: error.stack
      });

      const errorResult: DLPScanResult = {
        scanId,
        timestamp: new Date().toISOString(),
        userId: request.userId,
        dataSource: request.dataSource,
        classification: { type: 'UNKNOWN', confidence: 0, tags: [] },
        riskLevel: 'ERROR',
        violations: [],
        actions: [],
        actionResults: [],
        metrics: {
          scanDuration: Date.now() - startTime,
          dataItemsProcessed: 0,
          rulesEvaluated: 0,
          policiesApplied: 0
        },
        error: error.message
      };

      await this.auditLogger.logScan(errorResult);
      return errorResult;
    }
  }

  /**
   * Real-time streaming DLP scan
   */
  async scanStream(stream: NodeJS.ReadableStream, request: DLPScanRequest): Promise<NodeJS.ReadableStream> {
    const { Transform } = await import('stream');

    const dlpTransformer = new Transform({
      objectMode: true,
      transform: async (chunk, encoding, callback) => {
        try {
          const chunkRequest = {
            ...request,
            data: chunk
          };

          const result = await this.scanData(chunkRequest);

          // Apply actions based on scan result
          let processedChunk = chunk;
          for (const actionResult of result.actionResults) {
            if (actionResult.status === 'success' && actionResult.result?.processedData) {
              processedChunk = actionResult.result.processedData;
            }
          }

          this.emit('streamChunkProcessed', {
            chunkId: crypto.randomUUID(),
            result
          });

          callback(null, processedChunk);
        } catch (error) {
          callback(error);
        }
      }
    });

    return stream.pipe(dlpTransformer);
  }

  /**
   * Batch scanning for large datasets
   */
  async scanBatch(requests: DLPScanRequest[]): Promise<DLPScanResult[]> {
    const batchSize = this.config.batchSize || 100;
    const results: DLPScanResult[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(req => this.scanData(req));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Batch scan item failed', {
            batchIndex: i + index,
            error: result.reason
          });
        }
      });

      // Emit progress
      this.emit('batchProgress', {
        processed: Math.min(i + batchSize, requests.length),
        total: requests.length,
        percentage: Math.round((Math.min(i + batchSize, requests.length) / requests.length) * 100)
      });
    }

    return results;
  }

  /**
   * Add custom DLP rule
   */
  async addRule(rule: DLPRule): Promise<void> {
    this.validateRule(rule);
    this.rules.set(rule.id, rule);

    await this.auditLogger.logRuleChange({
      action: 'ADD',
      ruleId: rule.id,
      rule,
      timestamp: new Date().toISOString(),
      userId: 'system'
    });

    this.emit('ruleAdded', rule);
    logger.info('DLP rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Update existing DLP rule
   */
  async updateRule(ruleId: string, updates: Partial<DLPRule>): Promise<void> {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates, id: ruleId };
    this.validateRule(updatedRule);
    this.rules.set(ruleId, updatedRule);

    await this.auditLogger.logRuleChange({
      action: 'UPDATE',
      ruleId,
      previousRule: existingRule,
      updatedRule,
      timestamp: new Date().toISOString(),
      userId: 'system'
    });

    this.emit('ruleUpdated', updatedRule);
    logger.info('DLP rule updated', { ruleId });
  }

  /**
   * Remove DLP rule
   */
  async removeRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    this.rules.delete(ruleId);

    await this.auditLogger.logRuleChange({
      action: 'REMOVE',
      ruleId,
      rule,
      timestamp: new Date().toISOString(),
      userId: 'system'
    });

    this.emit('ruleRemoved', ruleId);
    logger.info('DLP rule removed', { ruleId });
  }

  /**
   * Add DLP policy
   */
  async addPolicy(policy: DLPPolicy): Promise<void> {
    this.validatePolicy(policy);
    this.policies.set(policy.id, policy);

    await this.auditLogger.logPolicyChange({
      action: 'ADD',
      policyId: policy.id,
      policy,
      timestamp: new Date().toISOString(),
      userId: 'system'
    });

    this.emit('policyAdded', policy);
    logger.info('DLP policy added', { policyId: policy.id, name: policy.name });
  }

  /**
   * Get DLP statistics and metrics
   */
  async getStats(timeRange?: { start: string; end: string }): Promise<any> {
    const scans = await this.auditLogger.getScans(timeRange);
    const violations = await this.auditLogger.getViolations(timeRange);

    const stats = {
      totalScans: scans.length,
      scansByRiskLevel: this.groupBy(scans, 'riskLevel'),
      scansByDataType: this.groupBy(scans, 'classification.type'),
      totalViolations: violations.length,
      violationsByRule: this.groupBy(violations, 'ruleId'),
      violationsBySeverity: this.groupBy(violations, 'severity'),
      averageScanTime: this.calculateAverage(scans, 'metrics.scanDuration'),
      quarantineCount: await this.quarantineManager.getQuarantineCount(),
      topViolations: this.getTopViolations(violations, 10)
    };

    return stats;
  }

  // Private helper methods
  private async preprocessData(data: any): Promise<any> {
    // Normalize data format
    if (typeof data === 'string') {
      return { text: data };
    } else if (Buffer.isBuffer(data)) {
      return {
        binary: data,
        text: data.toString('utf8', 0, Math.min(1024, data.length)) // Sample first 1KB
      };
    } else if (typeof data === 'object') {
      return data;
    }

    return { value: data };
  }

  private async evaluateRules(data: any, classification: DataClassification): Promise<any[]> {
    const violations = [];

    for (const rule of this.rules.values()) {
      if (await this.evaluateRule(rule, data, classification)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          description: rule.description,
          detectedAt: new Date().toISOString(),
          evidence: await this.collectEvidence(rule, data)
        });
      }
    }

    return violations;
  }

  private async evaluateRule(rule: DLPRule, data: any, classification: DataClassification): Promise<boolean> {
    // Check if rule applies to data type
    if (rule.dataTypes && !rule.dataTypes.includes(classification.type)) {
      return false;
    }

    // Evaluate rule conditions
    for (const condition of rule.conditions) {
      const result = await this.evaluateCondition(condition, data, classification);
      if (result) {
        return true;
      }
    }

    return false;
  }

  private async evaluateCondition(condition: any, data: any, classification: DataClassification): Promise<boolean> {
    switch (condition.type) {
      case 'REGEX':
        return this.evaluateRegexCondition(condition, data);
      case 'KEYWORD':
        return this.evaluateKeywordCondition(condition, data);
      case 'ML_MODEL':
        return this.evaluateMLCondition(condition, data);
      case 'ENTROPY':
        return this.evaluateEntropyCondition(condition, data);
      case 'FORMAT':
        return this.evaluateFormatCondition(condition, data);
      default:
        return false;
    }
  }

  private evaluateRegexCondition(condition: any, data: any): boolean {
    const regex = new RegExp(condition.pattern, condition.flags || 'gi');
    const text = this.extractText(data);
    return regex.test(text);
  }

  private evaluateKeywordCondition(condition: any, data: any): boolean {
    const text = this.extractText(data).toLowerCase();
    const keywords = Array.isArray(condition.keywords)
      ? condition.keywords
      : [condition.keywords];

    return keywords.some(keyword =>
      text.includes(keyword.toLowerCase())
    );
  }

  private evaluateMLCondition(condition: any, data: any): boolean {
    // Placeholder for ML model evaluation
    // In production, this would call actual ML models
    return false;
  }

  private evaluateEntropyCondition(condition: any, data: any): boolean {
    const text = this.extractText(data);
    const entropy = this.calculateEntropy(text);
    return entropy > (condition.threshold || 4.5);
  }

  private evaluateFormatCondition(condition: any, data: any): boolean {
    const text = this.extractText(data);

    switch (condition.format) {
      case 'CREDIT_CARD':
        return /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/.test(text.replace(/\s/g, ''));
      case 'SSN':
        return /^\d{3}-\d{2}-\d{4}$/.test(text);
      case 'EMAIL':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      case 'PHONE':
        return /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(text);
      default:
        return false;
    }
  }

  private extractText(data: any): string {
    if (typeof data === 'string') {
      return data;
    } else if (data.text) {
      return data.text;
    } else if (typeof data === 'object') {
      return JSON.stringify(data);
    }
    return String(data);
  }

  private calculateEntropy(text: string): number {
    const freq = new Map<string, number>();

    for (const char of text) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const length = text.length;

    for (const count of freq.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  private async applyPolicies(classification: DataClassification, violations: any[], context: any): Promise<DLPAction[]> {
    const actions: DLPAction[] = [];

    for (const policy of this.policies.values()) {
      if (await this.policyApplies(policy, classification, violations, context)) {
        actions.push(...policy.actions);
      }
    }

    return actions;
  }

  private async policyApplies(policy: DLPPolicy, classification: DataClassification, violations: any[], context: any): Promise<boolean> {
    // Check data type conditions
    if (policy.conditions.dataTypes && !policy.conditions.dataTypes.includes(classification.type)) {
      return false;
    }

    // Check risk level conditions
    const riskLevel = this.assessRisk(classification, violations);
    if (policy.conditions.riskLevels && !policy.conditions.riskLevels.includes(riskLevel)) {
      return false;
    }

    // Check user/role conditions
    if (policy.conditions.users && !policy.conditions.users.includes(context.userId)) {
      return false;
    }

    if (policy.conditions.roles && !context.roles?.some(role => policy.conditions.roles.includes(role))) {
      return false;
    }

    // Check violation conditions
    if (policy.conditions.violationTypes && violations.length === 0) {
      return false;
    }

    return true;
  }

  private assessRisk(classification: DataClassification, violations: any[]): RiskLevel {
    // Base risk from data classification
    let riskScore = this.getBaseRiskScore(classification.type);

    // Add risk from violations
    for (const violation of violations) {
      riskScore += this.getViolationRiskScore(violation.severity);
    }

    // Determine risk level
    if (riskScore >= 90) return 'CRITICAL';
    if (riskScore >= 70) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    if (riskScore >= 20) return 'LOW';
    return 'NONE';
  }

  private getBaseRiskScore(dataType: DataType): number {
    const scores = {
      'PII': 80,
      'PHI': 90,
      'FINANCIAL': 75,
      'CONFIDENTIAL': 60,
      'INTERNAL': 30,
      'PUBLIC': 0,
      'UNKNOWN': 10
    };

    return scores[dataType] || 10;
  }

  private getViolationRiskScore(severity: string): number {
    const scores = {
      'CRITICAL': 30,
      'HIGH': 20,
      'MEDIUM': 10,
      'LOW': 5
    };

    return scores[severity] || 0;
  }

  private async executeActions(data: any, actions: DLPAction[], request: DLPScanRequest): Promise<any[]> {
    const results = [];

    for (const action of actions) {
      try {
        let result;

        switch (action.type) {
          case 'MASK':
            result = await this.maskingEngine.mask(data, action.params);
            break;
          case 'ENCRYPT':
            result = await this.encryptionEngine.encrypt(data, action.params);
            break;
          case 'BLOCK':
            result = { blocked: true, reason: action.params?.reason };
            break;
          case 'ALERT':
            await this.sendAlert(action.params, request);
            result = { alerted: true };
            break;
          case 'QUARANTINE':
            await this.quarantineManager.quarantineData(data, action.params);
            result = { quarantined: true };
            break;
          case 'LOG':
            await this.auditLogger.logCustomAction(action, request);
            result = { logged: true };
            break;
          default:
            result = { skipped: true, reason: `Unknown action type: ${action.type}` };
        }

        results.push({
          actionId: action.id,
          type: action.type,
          status: 'success',
          result
        });

      } catch (error) {
        results.push({
          actionId: action.id,
          type: action.type,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  private async sendAlert(params: any, request: DLPScanRequest): Promise<void> {
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

    // Emit alert event
    this.emit('alert', alert);

    // Log alert
    logger.warn('DLP alert sent', alert);
  }

  private async collectEvidence(rule: DLPRule, data: any): Promise<any> {
    const evidence = {
      ruleId: rule.id,
      timestamp: new Date().toISOString(),
      dataHash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      matches: []
    };

    // Collect evidence based on rule type
    for (const condition of rule.conditions) {
      if (condition.type === 'REGEX') {
        const regex = new RegExp(condition.pattern, condition.flags || 'gi');
        const text = this.extractText(data);
        const matches = text.match(regex);

        if (matches) {
          evidence.matches.push({
            type: 'regex',
            pattern: condition.pattern,
            matches: matches.slice(0, 10) // Limit to first 10 matches
          });
        }
      }
    }

    return evidence;
  }

  private generateRecommendations(classification: DataClassification, violations: any[]): string[] {
    const recommendations = [];

    // Based on classification
    if (classification.type === 'PII' || classification.type === 'PHI') {
      recommendations.push('Consider encrypting or masking sensitive personal data');
      recommendations.push('Review access controls for this data type');
    }

    if (classification.type === 'FINANCIAL') {
      recommendations.push('Ensure PCI DSS compliance for financial data');
      recommendations.push('Implement additional monitoring for financial transactions');
    }

    // Based on violations
    if (violations.length > 0) {
      recommendations.push('Review and update DLP rules to reduce false positives');
      recommendations.push('Consider additional training for data handling procedures');
    }

    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length > 0) {
      recommendations.push('Immediate action required for critical violations');
      recommendations.push('Escalate to security team for review');
    }

    return recommendations;
  }

  private initializeDefaultRules(): void {
    // Credit Card Detection Rule
    this.rules.set('credit-card-detection', {
      id: 'credit-card-detection',
      name: 'Credit Card Number Detection',
      description: 'Detects potential credit card numbers',
      severity: 'HIGH',
      enabled: true,
      conditions: [
        {
          type: 'REGEX',
          pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
          flags: 'g'
        }
      ],
      dataTypes: ['UNKNOWN', 'PUBLIC', 'INTERNAL'],
      actions: ['MASK', 'ALERT']
    });

    // Social Security Number Detection
    this.rules.set('ssn-detection', {
      id: 'ssn-detection',
      name: 'Social Security Number Detection',
      description: 'Detects SSN patterns',
      severity: 'CRITICAL',
      enabled: true,
      conditions: [
        {
          type: 'REGEX',
          pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
          flags: 'g'
        }
      ],
      dataTypes: ['UNKNOWN', 'PUBLIC', 'INTERNAL'],
      actions: ['MASK', 'ALERT', 'QUARANTINE']
    });

    // Email Address Detection
    this.rules.set('email-detection', {
      id: 'email-detection',
      name: 'Email Address Detection',
      description: 'Detects email addresses',
      severity: 'MEDIUM',
      enabled: true,
      conditions: [
        {
          type: 'REGEX',
          pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
          flags: 'g'
        }
      ],
      dataTypes: ['UNKNOWN', 'PUBLIC', 'INTERNAL'],
      actions: ['MASK']
    });

    // High Entropy Data (Potential Keys/Tokens)
    this.rules.set('high-entropy-detection', {
      id: 'high-entropy-detection',
      name: 'High Entropy Data Detection',
      description: 'Detects potential API keys or tokens',
      severity: 'HIGH',
      enabled: true,
      conditions: [
        {
          type: 'ENTROPY',
          threshold: 4.5,
          minLength: 20
        }
      ],
      dataTypes: ['UNKNOWN', 'INTERNAL'],
      actions: ['ALERT', 'QUARANTINE']
    });
  }

  private initializeDefaultPolicies(): void {
    // PII Protection Policy
    this.policies.set('pii-protection', {
      id: 'pii-protection',
      name: 'PII Data Protection Policy',
      description: 'Protects personally identifiable information',
      enabled: true,
      priority: 1,
      conditions: {
        dataTypes: ['PII'],
        riskLevels: ['HIGH', 'CRITICAL']
      },
      actions: [
        {
          id: 'pii-mask',
          type: 'MASK',
          params: {
            method: 'PARTIAL',
            preserveFormat: true
          }
        },
        {
          id: 'pii-alert',
          type: 'ALERT',
          params: {
            severity: 'HIGH',
            recipients: ['security@company.com']
          }
        }
      ]
    });

    // Financial Data Policy
    this.policies.set('financial-protection', {
      id: 'financial-protection',
      name: 'Financial Data Protection Policy',
      description: 'Protects financial information',
      enabled: true,
      priority: 2,
      conditions: {
        dataTypes: ['FINANCIAL'],
        riskLevels: ['MEDIUM', 'HIGH', 'CRITICAL']
      },
      actions: [
        {
          id: 'financial-encrypt',
          type: 'ENCRYPT',
          params: {
            algorithm: 'AES-256-GCM',
            keyRotation: true
          }
        },
        {
          id: 'financial-log',
          type: 'LOG',
          params: {
            level: 'INFO',
            includeMetadata: true
          }
        }
      ]
    });
  }

  private validateRule(rule: DLPRule): void {
    if (!rule.id || !rule.name) {
      throw new Error('Rule must have id and name');
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      throw new Error('Rule must have at least one condition');
    }

    for (const condition of rule.conditions) {
      if (!condition.type) {
        throw new Error('Rule condition must have type');
      }
    }
  }

  private validatePolicy(policy: DLPPolicy): void {
    if (!policy.id || !policy.name) {
      throw new Error('Policy must have id and name');
    }

    if (!policy.actions || policy.actions.length === 0) {
      throw new Error('Policy must have at least one action');
    }

    for (const action of policy.actions) {
      if (!action.type) {
        throw new Error('Policy action must have type');
      }
    }
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = this.getNestedValue(item, key);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private getNestedValue(obj: any, path: string): string {
    return path.split('.').reduce((current, key) => current?.[key], obj) || 'unknown';
  }

  private calculateAverage(items: any[], path: string): number {
    if (items.length === 0) return 0;

    const sum = items.reduce((total, item) => {
      const value = this.getNestedValue(item, path);
      return total + (Number(value) || 0);
    }, 0);

    return Math.round(sum / items.length);
  }

  private getTopViolations(violations: any[], limit: number): any[] {
    const counts = this.groupBy(violations, 'ruleId');
    return Object.entries(counts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, limit)
      .map(([ruleId, count]) => ({ ruleId, count }));
  }
}

// Supporting Classes
class ClassificationEngine {
  private config: any;
  private models: Map<string, any> = new Map();

  constructor(config: any) {
    this.config = config;
    this.initializeModels();
  }

  async classify(data: any): Promise<DataClassification> {
    const text = this.extractText(data);

    // Use ensemble of classifiers
    const predictions = await Promise.all([
      this.classifyWithRegex(text),
      this.classifyWithML(text),
      this.classifyWithKeywords(text),
      this.classifyWithMetadata(data)
    ]);

    // Aggregate predictions
    const aggregated = this.aggregatePredictions(predictions);

    return {
      type: aggregated.type,
      confidence: aggregated.confidence,
      tags: aggregated.tags,
      metadata: aggregated.metadata
    };
  }

  private extractText(data: any): string {
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (typeof data === 'object') return JSON.stringify(data);
    return String(data);
  }

  private async classifyWithRegex(text: string): Promise<any> {
    const patterns = {
      'PII': [
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/gi // Address
      ],
      'PHI': [
        /\b(mr|mrs|ms|dr)\s+\w+\s+\w+\b/gi, // Names with titles
        /\b(hospital|medical|clinic|pharmacy)\b/gi
      ],
      'FINANCIAL': [
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
        /\b\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g // Currency
      ]
    };

    const matches = {};
    let totalMatches = 0;

    for (const [type, regexes] of Object.entries(patterns)) {
      matches[type] = 0;
      for (const regex of regexes) {
        const found = text.match(regex);
        if (found) {
          matches[type] += found.length;
          totalMatches += found.length;
        }
      }
    }

    if (totalMatches === 0) {
      return { type: 'PUBLIC', confidence: 0.8 };
    }

    // Find type with most matches
    const maxType = Object.entries(matches).reduce((a, b) =>
      matches[a[0]] > matches[b[0]] ? a : b
    )[0];

    return {
      type: maxType as DataType,
      confidence: Math.min(0.9, matches[maxType] / totalMatches)
    };
  }

  private async classifyWithML(text: string): Promise<any> {
    // Placeholder for ML classification
    // In production, this would use trained models
    return { type: 'UNKNOWN', confidence: 0.5 };
  }

  private async classifyWithKeywords(text: string): Promise<any> {
    const keywords = {
      'PII': ['social security', 'ssn', 'birth date', 'address', 'phone'],
      'PHI': ['patient', 'diagnosis', 'treatment', 'prescription', 'medical'],
      'FINANCIAL': ['credit card', 'bank account', 'payment', 'invoice', 'transaction'],
      'CONFIDENTIAL': ['confidential', 'proprietary', 'trade secret', 'internal only'],
      'INTERNAL': ['internal', 'company', 'employee', 'meeting', 'project']
    };

    const scores = {};
    const lowerText = text.toLowerCase();

    for (const [type, words] of Object.entries(keywords)) {
      scores[type] = 0;
      for (const word of words) {
        if (lowerText.includes(word.toLowerCase())) {
          scores[type]++;
        }
      }
    }

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return { type: 'UNKNOWN', confidence: 0.3 };
    }

    const maxType = Object.entries(scores).reduce((a, b) =>
      scores[a[0]] > scores[b[0]] ? a : b
    )[0];

    return {
      type: maxType as DataType,
      confidence: Math.min(0.7, maxScore / 10)
    };
  }

  private async classifyWithMetadata(data: any): Promise<any> {
    // Check file metadata, headers, etc.
    const metadata = data.metadata || {};

    if (metadata.classification) {
      return {
        type: metadata.classification,
        confidence: 0.9,
        tags: metadata.tags || []
      };
    }

    return { type: 'UNKNOWN', confidence: 0.2 };
  }

  private aggregatePredictions(predictions: any[]): any {
    // Weighted aggregation
    const weights = [0.3, 0.4, 0.2, 0.1]; // Regex, ML, Keywords, Metadata
    const typeScores = {};

    predictions.forEach((pred, index) => {
      if (!typeScores[pred.type]) {
        typeScores[pred.type] = 0;
      }
      typeScores[pred.type] += pred.confidence * weights[index];
    });

    const bestType = Object.entries(typeScores).reduce((a, b) =>
      typeScores[a[0]] > typeScores[b[0]] ? a : b
    )[0];

    return {
      type: bestType as DataType,
      confidence: Math.min(0.95, typeScores[bestType]),
      tags: [],
      metadata: {}
    };
  }

  private initializeModels(): void {
    // Initialize ML models
    // In production, load pre-trained models
  }
}

class MaskingEngine {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async mask(data: any, params: any): Promise<any> {
    const method = params.method || 'FULL';

    switch (method) {
      case 'FULL':
        return this.fullMask(data);
      case 'PARTIAL':
        return this.partialMask(data, params);
      case 'TOKENIZATION':
        return this.tokenize(data, params);
      case 'HASH':
        return this.hash(data, params);
      default:
        return data;
    }
  }

  private fullMask(data: any): any {
    if (typeof data === 'string') {
      return '*'.repeat(data.length);
    } else if (data.text) {
      return {
        ...data,
        text: '*'.repeat(data.text.length)
      };
    } else if (typeof data === 'object') {
      return this.maskObject(data);
    }

    return '***MASKED***';
  }

  private partialMask(data: any, params: any): any {
    const preserveFormat = params.preserveFormat || false;
    const visibleChars = params.visibleChars || 4;

    if (typeof data === 'string') {
      if (preserveFormat) {
        return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
      } else {
        return '*'.repeat(data.length - visibleChars) + data.substring(data.length - visibleChars);
      }
    } else if (data.text) {
      const text = data.text;
      const masked = preserveFormat
        ? text.substring(0, visibleChars) + '*'.repeat(text.length - visibleChars)
        : '*'.repeat(text.length - visibleChars) + text.substring(text.length - visibleChars);

      return { ...data, text: masked };
    }

    return data;
  }

  private tokenize(data: any, params: any): any {
    // Replace with tokens from a secure vault
    if (typeof data === 'string') {
      return `TOKEN_${crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)}`;
    }

    return data;
  }

  private hash(data: any, params: any): any {
    if (typeof data === 'string') {
      return crypto.createHash('sha256').update(data).digest('hex');
    }

    return data;
  }

  private maskObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    } else if (obj && typeof obj === 'object') {
      const masked = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          masked[key] = '*'.repeat(value.length);
        } else if (typeof value === 'object') {
          masked[key] = this.maskObject(value);
        } else {
          masked[key] = value;
        }
      }
      return masked;
    }

    return obj;
  }
}

class EncryptionEngine {
  private config: any;
  private keys: Map<string, string> = new Map();

  constructor(config: any) {
    this.config = config;
    this.initializeKeys();
  }

  async encrypt(data: any, params: any): Promise<any> {
    const algorithm = params.algorithm || 'AES-256-GCM';
    const keyId = params.keyId || 'default';

    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('dlp-encryption'));

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm,
      keyId,
      timestamp: new Date().toISOString()
    };
  }

  async decrypt(encryptedData: any): Promise<any> {
    const { encrypted, iv, authTag, algorithm, keyId } = encryptedData;

    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${keyId}`);
    }

    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('dlp-encryption'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private initializeKeys(): void {
    // Initialize encryption keys
    // In production, these would be loaded from a secure key management system
    this.keys.set('default', crypto.randomBytes(32).toString('hex'));
  }
}

class AuditLogger {
  private config: any;
  private logs: AuditLog[] = [];

  constructor(config: any) {
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

    // In production, persist to database
    if (this.config.storage === 'database') {
      await this.persistToDatabase(log);
    }
  }

  async logRuleChange(change: any): Promise<void> {
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

  async logPolicyChange(change: any): Promise<void> {
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

  async getViolations(timeRange?: { start: string; end: string }): Promise<any[]> {
    // In production, query from database
    return [];
  }

  private async persistToDatabase(log: AuditLog): Promise<void> {
    // Implement database persistence
  }
}

class QuarantineManager {
  private config: any;
  private quarantined: Map<string, QuarantineRecord> = new Map();

  constructor(config: any) {
    this.config = config;
  }

  async quarantine(scanResult: DLPScanResult): Promise<void> {
    const record: QuarantineRecord = {
      id: crypto.randomUUID(),
      scanId: scanResult.scanId,
      timestamp: new Date().toISOString(),
      userId: scanResult.userId,
      dataSource: scanResult.dataSource,
      riskLevel: scanResult.riskLevel,
      classification: scanResult.classification,
      violations: scanResult.violations,
      status: 'QUARANTINED',
      reviewStatus: 'PENDING',
      expiresAt: new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    };

    this.quarantined.set(record.id, record);

    // In production, persist to secure storage
    await this.persistQuarantine(record);
  }

  async quarantineData(data: any, params: any): Promise<string> {
    const recordId = crypto.randomUUID();
    const record: QuarantineRecord = {
      id: recordId,
      timestamp: new Date().toISOString(),
      data: data,
      status: 'QUARANTINED',
      reviewStatus: 'PENDING',
      expiresAt: new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    };

    this.quarantined.set(recordId, record);
    await this.persistQuarantine(record);

    return recordId;
  }

  async release(recordId: string, reviewerId: string): Promise<void> {
    const record = this.quarantined.get(recordId);
    if (!record) {
      throw new Error(`Quarantine record not found: ${recordId}`);
    }

    record.status = 'RELEASED';
    record.reviewStatus = 'APPROVED';
    record.reviewedBy = reviewerId;
    record.reviewedAt = new Date().toISOString();

    await this.updateQuarantine(record);
  }

  async delete(recordId: string, reviewerId: string): Promise<void> {
    const record = this.quarantined.get(recordId);
    if (!record) {
      throw new Error(`Quarantine record not found: ${recordId}`);
    }

    record.status = 'DELETED';
    record.reviewStatus = 'REJECTED';
    record.reviewedBy = reviewerId;
    record.reviewedAt = new Date().toISOString();

    await this.updateQuarantine(record);
  }

  async getQuarantineCount(): Promise<number> {
    return this.quarantined.size;
  }

  private async persistQuarantine(record: QuarantineRecord): Promise<void> {
    // Implement secure persistence
  }

  private async updateQuarantine(record: QuarantineRecord): Promise<void> {
    // Implement update
  }
}
