/**
 * LAM Risk Assessor Agent
 * Assesses and mitigates risks in real-time
 */

import { LAMBaseAgent } from './base-agent.js';

class RiskAssessorAgent extends LAMBaseAgent {
  constructor(config = {}) {
    super({
      name: 'risk-assessor',
      version: '1.0.0',
      ...config
    });

    this.config = {
      riskLevels: ['low', 'medium', 'high', 'critical'],
      riskThresholds: {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
        critical: 0.9
      },
      factors: {
        dataSensitivity: config.factors?.dataSensitivity || 0.3,
        userPermissions: config.factors?.userPermissions || 0.25,
        contextRisk: config.factors?.contextRisk || 0.2,
        historicalRisk: config.factors?.historicalRisk || 0.15,
        anomalyScore: config.factors?.anomalyScore || 0.1
      },
      mitigationStrategies: {
        low: ['monitor', 'log'],
        medium: ['enhanced_monitoring', 'restrict', 'notify'],
        high: ['block', 'require_approval', 'enhanced_audit'],
        critical: ['block', 'immediate_notification', 'emergency_response']
      },
      ...config
    };

    this.state = {
      riskHistory: new Map(),
      userRiskProfiles: new Map(),
      riskPatterns: new Map(),
      anomalyDetector: null,
      statistics: {
        assessments: 0,
        risksBlocked: 0,
        falsePositives: 0,
        truePositives: 0,
        averageRiskScore: 0
      }
    };
  }

  /**
   * Initialize risk assessor agent
   */
  async initialize() {
    await super.initialize();

    // Initialize anomaly detector
    await this.initializeAnomalyDetector();

    // Load historical risk patterns
    await this.loadRiskPatterns();

    // Initialize user risk profiles
    await this.initializeUserRiskProfiles();

    console.log('⚠️ Risk Assessor Agent initialized');
  }

  /**
   * Assess risk for a request
   */
  async assess(request, context = {}) {
    const assessment = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      requestId: request.id || 'unknown',
      riskScore: 0,
      riskLevel: 'unknown',
      riskFactors: [],
      mitigations: [],
      confidence: 0,
      reasoning: '',
      requiresApproval: false,
      anomalies: [],
      historicalContext: null
    };

    try {
      // Extract risk factors
      assessment.riskFactors = await this.extractRiskFactors(request, context);

      // Calculate overall risk score
      assessment.riskScore = this.calculateRiskScore(assessment.riskFactors);
      assessment.riskLevel = this.determineRiskLevel(assessment.riskScore);

      // Check for anomalies
      assessment.anomalies = await this.detectAnomalies(request, context);

      // Get historical context
      assessment.historicalContext = await this.getHistoricalContext(request, context);

      // Apply historical adjustments
      assessment.riskScore = this.applyHistoricalAdjustments(
        assessment.riskScore,
        assessment.historicalContext
      );

      // Generate mitigation strategies
      assessment.mitigations = this.generateMitigations(assessment.riskLevel, assessment.riskFactors);

      // Determine approval requirements
      assessment.requiresApproval = this.requiresApproval(assessment);

      // Calculate confidence
      assessment.confidence = this.calculateConfidence(assessment);

      // Build reasoning
      assessment.reasoning = this.buildReasoning(assessment);

      // Update user risk profile
      await this.updateUserRiskProfile(context, assessment);

      // Store assessment
      await this.storeAssessment(assessment);

      // Update statistics
      this.state.statistics.assessments++;
      this.updateAverageRiskScore(assessment.riskScore);

    } catch (error) {
      console.error('Risk assessment error:', error);
      assessment.error = error.message;
    }

    return assessment;
  }

  /**
   * Extract risk factors from request and context
   */
  async extractRiskFactors(request, context) {
    const factors = {
      dataSensitivity: await this.assessDataSensitivity(request, context),
      userPermissions: await this.assessUserPermissions(context),
      contextRisk: await this.assessContextRisk(request, context),
      historicalRisk: await this.assessHistoricalRisk(context),
      anomalyScore: await this.assessAnomalyScore(request, context)
    };

    // Add specific risk indicators
    factors.indicators = await this.identifyRiskIndicators(request, context);

    return factors;
  }

  /**
   * Assess data sensitivity
   */
  async assessDataSensitivity(request, context) {
    let sensitivityScore = 0;
    const indicators = [];

    // Check data types
    if (request.data) {
      const sensitiveDataTypes = [
        { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'ssn', weight: 0.9 },
        { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, type: 'credit_card', weight: 0.9 },
        { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email', weight: 0.3 },
        { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone', weight: 0.4 },
        { pattern: /medical|health|phi|patient/i, type: 'medical', weight: 0.8 },
        { pattern: /financial|bank|account|credit/i, type: 'financial', weight: 0.7 }
      ];

      const dataStr = JSON.stringify(request.data).toLowerCase();

      for (const { pattern, type, weight } of sensitiveDataTypes) {
        if (pattern.test(dataStr)) {
          sensitivityScore = Math.max(sensitivityScore, weight);
          indicators.push({ type, weight, detected: true });
        }
      }
    }

    // Check industry-specific sensitivity
    if (context.industry) {
      const industrySensitivity = {
        'healthcare': 0.8,
        'finance': 0.7,
        'government': 0.6,
        'education': 0.4,
        'retail': 0.2
      };
      sensitivityScore = Math.max(sensitivityScore, industrySensitivity[context.industry.toLowerCase()] || 0);
    }

    // Check region-specific sensitivity
    if (context.region === 'EU') {
      sensitivityScore = Math.max(sensitivityScore, 0.6); // GDPR
    }

    return {
      score: sensitivityScore,
      indicators,
      classification: this.classifyDataSensitivity(sensitivityScore)
    };
  }

  /**
   * Assess user permissions and trust level
   */
  async assessUserPermissions(context) {
    const assessment = {
      score: 0.5, // Default neutral
      trustLevel: 'unknown',
      factors: []
    };

    if (!context.userId) {
      assessment.score = 0.9; // High risk for unauthenticated
      assessment.trustLevel = 'unauthenticated';
      assessment.factors.push({ type: 'no_authentication', impact: 0.4 });
      return assessment;
    }

    // Get user risk profile
    const userProfile = this.state.userRiskProfiles.get(context.userId);
    if (userProfile) {
      assessment.trustLevel = userProfile.trustLevel;
      assessment.score = userProfile.riskScore;
      assessment.factors.push({
        type: 'historical_trust',
        impact: userProfile.riskScore,
        data: userProfile
      });
    }

    // Check session characteristics
    if (context.session) {
      const sessionAge = Date.now() - new Date(context.session.createdAt).getTime();
      const maxSessionAge = 8 * 60 * 60 * 1000; // 8 hours

      if (sessionAge > maxSessionAge) {
        assessment.score += 0.2;
        assessment.factors.push({ type: 'old_session', impact: 0.2 });
      }
    }

    // Check location/IP risk
    if (context.ipAddress) {
      const ipRisk = await this.assessIPRisk(context.ipAddress);
      assessment.score += ipRisk * 0.3;
      if (ipRisk > 0.5) {
        assessment.factors.push({ type: 'suspicious_ip', impact: ipRisk * 0.3 });
      }
    }

    return {
      score: Math.min(1.0, assessment.score),
      trustLevel: assessment.trustLevel,
      factors: assessment.factors
    };
  }

  /**
   * Assess context-specific risks
   */
  async assessContextRisk(request, context) {
    let contextScore = 0;
    const factors = [];

    // Time-based risk
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) { // Unusual hours
      contextScore += 0.1;
      factors.push({ type: 'unusual_time', impact: 0.1 });
    }

    // Request frequency risk
    const recentRequests = await this.getRecentRequestCount(context.userId, '1h');
    if (recentRequests > 100) {
      contextScore += 0.3;
      factors.push({ type: 'high_frequency', impact: 0.3 });
    }

    // Action type risk
    const actionRisk = this.getActionRisk(request.type);
    contextScore += actionRisk;
    if (actionRisk > 0.3) {
      factors.push({ type: 'risky_action', impact: actionRisk, action: request.type });
    }

    // Target sensitivity
    if (request.target) {
      const targetRisk = await this.assessTargetRisk(request.target);
      contextScore += targetRisk;
      if (targetRisk > 0.2) {
        factors.push({ type: 'sensitive_target', impact: targetRisk });
      }
    }

    // Compliance framework risk
    if (context.framework) {
      const frameworkRisk = this.getFrameworkRisk(context.framework);
      contextScore += frameworkRisk;
      factors.push({ type: 'framework_risk', impact: frameworkRisk, framework: context.framework });
    }

    return {
      score: Math.min(1.0, contextScore),
      factors
    };
  }

  /**
   * Assess historical risk patterns
   */
  async assessHistoricalRisk(context) {
    if (!context.userId) {
      return { score: 0.5, patterns: [] };
    }

    const userHistory = this.state.riskHistory.get(context.userId) || [];
    if (userHistory.length === 0) {
      return { score: 0.5, patterns: [] };
    }

    const recentHistory = userHistory.slice(-10); // Last 10 assessments
    const averageRisk = recentHistory.reduce((sum, h) => sum + h.riskScore, 0) / recentHistory.length;

    let historicalScore = 0;
    const patterns = [];

    // Check for escalation patterns
    const escalation = this.detectEscalation(recentHistory);
    if (escalation.detected) {
      historicalScore += escalation.severity;
      patterns.push({ type: 'escalation', severity: escalation.severity });
    }

    // Check for violation patterns
    const violations = recentHistory.filter(h => h.riskLevel === 'high' || h.riskLevel === 'critical');
    if (violations.length > 3) {
      historicalScore += 0.3;
      patterns.push({ type: 'frequent_violations', count: violations.length });
    }

    // Check for time patterns
    const timePattern = this.detectTimePatterns(recentHistory);
    if (timePattern.anomalous) {
      historicalScore += 0.2;
      patterns.push({ type: 'temporal_anomaly', pattern: timePattern });
    }

    return {
      score: Math.min(1.0, averageRisk + historicalScore),
      patterns,
      averageRisk,
      totalAssessments: userHistory.length
    };
  }

  /**
   * Assess anomaly score
   */
  async assessAnomalyScore(request, context) {
    if (!this.state.anomalyDetector) {
      return { score: 0, anomalies: [] };
    }

    try {
      const features = this.extractFeaturesForAnomalyDetection(request, context);
      const anomalyResult = await this.state.anomalyDetector.detect(features);

      return {
        score: anomalyResult.score,
        anomalies: anomalyResult.anomalies,
        confidence: anomalyResult.confidence
      };
    } catch (error) {
      console.error('Anomaly detection error:', error);
      return { score: 0, anomalies: [], error: error.message };
    }
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(riskFactors) {
    const weights = this.config.factors;
    let totalScore = 0;

    // Data sensitivity
    totalScore += (riskFactors.dataSensitivity?.score || 0) * weights.dataSensitivity;

    // User permissions
    totalScore += (riskFactors.userPermissions?.score || 0) * weights.userPermissions;

    // Context risk
    totalScore += (riskFactors.contextRisk?.score || 0) * weights.contextRisk;

    // Historical risk
    totalScore += (riskFactors.historicalRisk?.score || 0) * weights.historicalRisk;

    // Anomaly score
    totalScore += (riskFactors.anomalyScore?.score || 0) * weights.anomalyScore;

    // Additional risk indicators
    if (riskFactors.indicators) {
      for (const indicator of riskFactors.indicators) {
        totalScore += (indicator.weight || 0) * 0.1;
      }
    }

    return Math.min(1.0, Math.max(0, totalScore));
  }

  /**
   * Determine risk level from score
   */
  determineRiskLevel(score) {
    const thresholds = this.config.riskThresholds;

    if (score >= thresholds.critical) return 'critical';
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Generate mitigation strategies
   */
  generateMitigations(riskLevel, riskFactors) {
    const strategies = this.config.mitigationStrategies[riskLevel] || [];
    const mitigations = [];

    for (const strategy of strategies) {
      mitigations.push({
        type: strategy,
        priority: this.getStrategyPriority(strategy, riskLevel),
        description: this.getStrategyDescription(strategy),
        automated: this.isStrategyAutomated(strategy),
        parameters: this.getStrategyParameters(strategy, riskFactors)
      });
    }

    // Add factor-specific mitigations
    if (riskFactors.dataSensitivity?.score > 0.7) {
      mitigations.push({
        type: 'enhanced_pii_protection',
        priority: 'high',
        description: 'Apply enhanced PII protection',
        automated: true
      });
    }

    if (riskFactors.anomalyScore?.score > 0.8) {
      mitigations.push({
        type: 'anomaly_investigation',
        priority: 'critical',
        description: 'Launch anomaly investigation',
        automated: false
      });
    }

    return mitigations.sort((a, b) => this.priorityOrder(b.priority) - this.priorityOrder(a.priority));
  }

  /**
   * Determine if approval is required
   */
  requiresApproval(assessment) {
    if (assessment.riskLevel === 'critical') return true;
    if (assessment.riskLevel === 'high' && assessment.anomalies.length > 0) return true;
    if (assessment.anomalies.some(a => a.severity === 'critical')) return true;
    if (assessment.riskFactors.userPermissions?.trustLevel === 'unauthenticated') return true;

    return false;
  }

  /**
   * Calculate assessment confidence
   */
  calculateConfidence(assessment) {
    let confidence = 0.5; // Base confidence

    // More data points increase confidence
    if (assessment.historicalContext?.totalAssessments > 10) {
      confidence += 0.2;
    }

    // Strong risk factors increase confidence
    const strongFactors = assessment.riskFactors.factors?.filter(f => f.impact > 0.3).length || 0;
    confidence += Math.min(0.2, strongFactors * 0.05);

    // Anomalies increase confidence when detected
    if (assessment.anomalies.length > 0) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Build reasoning for assessment
   */
  buildReasoning(assessment) {
    const reasons = [];

    // Risk level explanation
    reasons.push(`Risk score: ${(assessment.riskScore * 100).toFixed(1)}% (${assessment.riskLevel} risk)`);

    // Key contributing factors
    const topFactors = Object.entries(assessment.riskFactors)
      .filter(([key, value]) => key !== 'indicators' && value.score > 0.3)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3);

    for (const [factorName, factorData] of topFactors) {
      const factorPercent = (factorData.score * 100).toFixed(1);
      reasons.push(`${this.formatFactorName(factorName)}: ${factorPercent}%`);
    }

    // Anomaly information
    if (assessment.anomalies.length > 0) {
      reasons.push(`${assessment.anomalies.length} anomaly/anomalies detected`);
    }

    // Historical context
    if (assessment.historicalContext?.patterns.length > 0) {
      reasons.push(`${assessment.historicalContext.patterns.length} historical risk pattern(s) found`);
    }

    return reasons.join('; ');
  }

  /**
   * Helper methods
   */
  formatFactorName(factorName) {
    return factorName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  classifyDataSensitivity(score) {
    if (score >= 0.8) return 'highly_sensitive';
    if (score >= 0.6) return 'sensitive';
    if (score >= 0.3) return 'moderately_sensitive';
    return 'low_sensitivity';
  }

  getActionRisk(actionType) {
    const riskLevels = {
      'read': 0.1,
      'navigate': 0.2,
      'click': 0.3,
      'type': 0.4,
      'form_fill': 0.5,
      'api_call': 0.4,
      'write': 0.6,
      'modify': 0.7,
      'delete': 0.9,
      'admin_access': 1.0
    };
    return riskLevels[actionType] || 0.5;
  }

  getFrameworkRisk(framework) {
    const risks = {
      'GDPR': 0.6,
      'HIPAA': 0.8,
      'FINRA': 0.7,
      'PCI-DSS': 0.6,
      'SOC2': 0.4
    };
    return risks[framework] || 0.3;
  }

  getStrategyPriority(strategy, riskLevel) {
    const priorities = {
      'monitor': 'low',
      'enhanced_monitoring': 'medium',
      'log': 'low',
      'restrict': 'high',
      'notify': 'medium',
      'block': 'critical',
      'require_approval': 'high',
      'enhanced_audit': 'medium',
      'immediate_notification': 'critical',
      'emergency_response': 'critical'
    };
    return priorities[strategy] || 'medium';
  }

  getStrategyDescription(strategy) {
    const descriptions = {
      'monitor': 'Monitor the request for unusual activity',
      'enhanced_monitoring': 'Apply enhanced monitoring and logging',
      'log': 'Record the request in audit logs',
      'restrict': 'Restrict access or capabilities',
      'notify': 'Send notification to administrators',
      'block': 'Block the request from proceeding',
      'require_approval': 'Require human approval before proceeding',
      'enhanced_audit': 'Create detailed audit trail',
      'immediate_notification': 'Send immediate high-priority notification',
      'emergency_response': 'Initiate emergency response procedures'
    };
    return descriptions[strategy] || strategy;
  }

  isStrategyAutomated(strategy) {
    const automated = ['monitor', 'enhanced_monitoring', 'log', 'restrict', 'block', 'enhanced_audit'];
    return automated.includes(strategy);
  }

  getStrategyParameters(strategy, riskFactors) {
    // Return strategy-specific parameters based on risk factors
    return {};
  }

  priorityOrder(priority) {
    const order = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    return order[priority] || 0;
  }

  // Placeholder implementations
  async initializeAnomalyDetector() { /* Implementation */ }
  async loadRiskPatterns() { /* Implementation */ }
  async initializeUserRiskProfiles() { /* Implementation */ }
  async identifyRiskIndicators(request, context) { /* Implementation */ }
  async assessIPRisk(ipAddress) { /* Implementation */ }
  async assessTargetRisk(target) { /* Implementation */ }
  async getRecentRequestCount(userId, timeWindow) { /* Implementation */ }
  detectEscalation(history) { /* Implementation */ }
  detectTimePatterns(history) { /* Implementation */ }
  extractFeaturesForAnomalyDetection(request, context) { /* Implementation */ }
  async updateUserRiskProfile(context, assessment) { /* Implementation */ }
  async storeAssessment(assessment) { /* Implementation */ }
  updateAverageRiskScore(score) { /* Implementation */ }
  async getHistoricalContext(request, context) { /* Implementation */ }
}

export { RiskAssessorAgent };
export default RiskAssessorAgent;