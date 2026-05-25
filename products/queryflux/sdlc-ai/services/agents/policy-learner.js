/**
 * LAM Policy Learner Agent
 * Learns from compliance patterns and suggests policy improvements
 */

import { LAMBaseAgent } from './base-agent.js';

class PolicyLearnerAgent extends LAMBaseAgent {
  constructor(config = {}) {
    super({
      name: 'policy-learner',
      version: '1.0.0',
      ...config
    });

    this.config = {
      learningRate: config.learningRate || 0.1,
      patternThreshold: config.patternThreshold || 5, // Min occurrences to learn
      confidenceThreshold: config.confidenceThreshold || 0.8,
      maxPoliciesPerSession: config.maxPoliciesPerSession || 10,
      frameworks: ['GDPR', 'HIPAA', 'FINRA', 'PCI-DSS', 'SOC2'],
      ...config
    };

    this.state = {
      patterns: new Map(),
      policyHistory: new Map(),
      learningSessions: [],
      lastLearning: null,
      statistics: {
        patternsLearned: 0,
        policiesGenerated: 0,
        accuracy: 0,
        falsePositives: 0,
        improvements: 0
      }
    };
  }

  /**
   * Initialize policy learner agent
   */
  async initialize() {
    await super.initialize();

    // Load existing patterns from knowledge base
    await this.loadExistingPatterns();

    // Initialize pattern detection models
    await this.initializePatternModels();

    console.log('🧠 Policy Learner Agent initialized');
  }

  /**
   * Analyze request for policy implications
   */
  async analyze(request, context = {}) {
    const analysis = {
      type: 'policy_analysis',
      requestId: request.id || this.generateId(),
      timestamp: new Date().toISOString(),
      patterns: [],
      recommendations: [],
      confidence: 0,
      reasoning: '',
      framework: this.detectFramework(context),
      riskLevel: 'unknown'
    };

    try {
      // Extract relevant features from request
      const features = await this.extractFeatures(request, context);

      // Pattern matching
      analysis.patterns = await this.detectPatterns(features, context);

      // Generate policy recommendations
      analysis.recommendations = await this.generateRecommendations(analysis.patterns, context);

      // Calculate confidence
      analysis.confidence = this.calculateConfidence(analysis.patterns, analysis.recommendations);

      // Build reasoning
      analysis.reasoning = this.buildReasoning(analysis.patterns, analysis.recommendations);

      // Assess risk level
      analysis.riskLevel = this.assessRiskLevel(analysis.recommendations);

      // Store analysis for learning
      await this.storeAnalysis(analysis);

    } catch (error) {
      console.error('Policy analysis error:', error);
      analysis.error = error.message;
    }

    return analysis;
  }

  /**
   * Learn from audit logs and compliance events
   */
  async learnFromAuditLogs(auditLogs, timeRange = '7d') {
    const learningSession = {
      id: this.generateSessionId(),
      startTime: new Date().toISOString(),
      timeRange,
      logsProcessed: 0,
      patternsFound: [],
      policiesGenerated: [],
      errors: []
    };

    try {
      console.log(`📚 Learning from audit logs (${timeRange})...`);

      // Process audit logs
      for (const log of auditLogs) {
        try {
          await this.processAuditLog(log);
          learningSession.logsProcessed++;
        } catch (error) {
          learningSession.errors.push(`Log ${log.id}: ${error.message}`);
        }
      }

      // Analyze patterns found
      const patternAnalysis = await this.analyzePatterns(auditLogs);
      learningSession.patternsFound = patternAnalysis.patterns;

      // Generate policy improvements
      const policyImprovements = await this.generatePolicyImprovements(patternAnalysis);
      learningSession.policiesGenerated = policyImprovements;

      // Update statistics
      this.updateStatistics(learningSession);

      learningSession.endTime = new Date().toISOString();
      this.state.lastLearning = learningSession;

      console.log(`✅ Learning completed: ${learningSession.patternsFound.length} patterns, ${learningSession.policiesGenerated.length} policies`);

      return learningSession;

    } catch (error) {
      learningSession.endTime = new Date().toISOString();
      learningSession.error = error.message;
      throw error;
    }
  }

  /**
   * Detect patterns in request features
   */
  async detectPatterns(features, context) {
    const patterns = [];

    // Check against known patterns
    for (const [patternId, pattern] of this.state.patterns) {
      const match = await this.matchPattern(features, pattern, context);
      if (match.matches) {
        patterns.push({
          id: patternId,
          pattern: pattern,
          confidence: match.confidence,
          matches: match.matches,
          context: context
        });
      }
    }

    // Look for new patterns
    const newPatterns = await this.discoverNewPatterns(features, context);
    patterns.push(...newPatterns);

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate policy recommendations based on patterns
   */
  async generateRecommendations(patterns, context) {
    const recommendations = [];

    for (const pattern of patterns) {
      const policyRecs = await this.generatePatternRecommendations(pattern, context);
      recommendations.push(...policyRecs);
    }

    // Remove duplicates and prioritize
    const uniqueRecs = this.deduplicateRecommendations(recommendations);
    return this.prioritizeRecommendations(uniqueRecs, context);
  }

  /**
   * Generate pattern-based policy recommendations
   */
  async generatePatternRecommendations(pattern, context) {
    const recommendations = [];

    switch (pattern.pattern.type) {
      case 'gdpr_violation':
        recommendations.push({
          type: 'policy_update',
          action: 'add_gdpr_rule',
          framework: 'GDPR',
          severity: pattern.confidence > 0.9 ? 'high' : 'medium',
          description: `GDPR violation pattern detected: ${pattern.pattern.description}`,
          recommendation: {
            rule: {
              condition: pattern.pattern.condition,
              action: 'block_or_redact',
              justification: pattern.pattern.reasoning,
              evidence: pattern.matches
            },
            rollout: {
              strategy: 'gradual',
              percentage: 10,
              monitoring: true
            }
          },
          confidence: pattern.confidence,
          patternId: pattern.id
        });
        break;

      case 'pii_exposure':
        recommendations.push({
          type: 'pii_policy',
          action: 'enhance_pii_detection',
          framework: 'GDPR/HIPAA',
          severity: 'high',
          description: `PII exposure pattern detected: ${pattern.pattern.description}`,
          recommendation: {
            rule: {
              patterns: pattern.pattern.newPatterns || [],
              redactionLevel: 'full',
              context: pattern.pattern.context
            },
            testing: {
              sampleSize: 100,
              falsePositiveRate: 0.05
            }
          },
          confidence: pattern.confidence,
          patternId: pattern.id
        });
        break;

      case 'access_pattern':
        recommendations.push({
          type: 'access_policy',
          action: 'refine_access_controls',
          framework: context.framework || 'GENERIC',
          severity: 'medium',
          description: `Access pattern anomaly: ${pattern.pattern.description}`,
          recommendation: {
            rule: {
              condition: pattern.pattern.condition,
              restrictions: pattern.pattern.restrictions,
              monitoringLevel: 'enhanced'
            }
          },
          confidence: pattern.confidence,
          patternId: pattern.id
        });
        break;

      case 'compliance_drift':
        recommendations.push({
          type: 'policy_adjustment',
          action: 'update_compliance_rules',
          framework: pattern.pattern.framework,
          severity: 'medium',
          description: `Compliance drift detected: ${pattern.pattern.description}`,
          recommendation: {
            rule: {
              updates: pattern.pattern.updates,
              rollback: true,
              validation: true
            }
          },
          confidence: pattern.confidence,
          patternId: pattern.id
        });
        break;
    }

    return recommendations;
  }

  /**
   * Process individual audit log for learning
   */
  async processAuditLog(log) {
    if (!log || !log.type) return;

    // Extract features from log
    const features = await this.extractLogFeatures(log);

    // Check for violations
    if (log.violations && log.violations.length > 0) {
      await this.learnFromViolation(log, features);
    }

    // Check for successful compliance
    if (log.compliant === true) {
      await this.learnFromSuccess(log, features);
    }

    // Update pattern frequencies
    await this.updatePatternFrequencies(features, log);
  }

  /**
   * Learn from compliance violations
   */
  async learnFromViolation(log, features) {
    for (const violation of log.violations) {
      const violationPattern = {
        type: this.classifyViolationType(violation),
        framework: violation.framework,
        description: violation.description,
        features: features,
        condition: this.generateConditionFromFeatures(features),
        severity: violation.severity,
        frequency: 1,
        lastSeen: log.timestamp,
        effectiveness: 0 // Will be updated when policies are applied
      };

      const patternId = this.generatePatternId(violationPattern);

      if (this.state.patterns.has(patternId)) {
        // Update existing pattern
        const existing = this.state.patterns.get(patternId);
        existing.frequency++;
        existing.lastSeen = log.timestamp;
        existing.severity = Math.max(existing.severity, violationPattern.severity);
      } else {
        // Add new pattern
        this.state.patterns.set(patternId, violationPattern);
        this.state.statistics.patternsLearned++;
      }
    }
  }

  /**
   * Learn from successful compliance outcomes
   */
  async learnFromSuccess(log, features) {
    // Reinforce successful patterns
    for (const [patternId, pattern] of this.state.patterns) {
      if (this.matchesPattern(features, pattern)) {
        pattern.effectiveness = Math.min(1.0, pattern.effectiveness + 0.1);
      }
    }
  }

  /**
   * Discover new patterns using ML techniques
   */
  async discoverNewPatterns(features, context) {
    const newPatterns = [];

    // Use clustering to find pattern groups
    const clusters = await this.clusterFeatures(features);

    for (const cluster of clusters) {
      if (cluster.size >= this.config.patternThreshold) {
        const pattern = await this.createPatternFromCluster(cluster, context);
        if (pattern) {
          newPatterns.push({
            id: pattern.id,
            pattern: pattern,
            confidence: pattern.confidence,
            matches: cluster.members,
            context: context,
            isNew: true
          });
        }
      }
    }

    return newPatterns;
  }

  /**
   * Analyze patterns across audit logs
   */
  async analyzePatterns(auditLogs) {
    const analysis = {
      totalLogs: auditLogs.length,
      violationRate: 0,
      patternFrequency: new Map(),
      temporalPatterns: [],
      contextualPatterns: [],
      crossFrameworkPatterns: []
    };

    // Calculate violation rate
    const violationLogs = auditLogs.filter(log => log.violations && log.violations.length > 0);
    analysis.violationRate = violationLogs.length / auditLogs.length;

    // Analyze pattern frequencies
    for (const [patternId, pattern] of this.state.patterns) {
      analysis.patternFrequency.set(patternId, {
        pattern: pattern,
        frequency: pattern.frequency,
        effectiveness: pattern.effectiveness,
        lastSeen: pattern.lastSeen
      });
    }

    // Find temporal patterns
    analysis.temporalPatterns = await this.findTemporalPatterns(auditLogs);

    // Find contextual patterns
    analysis.contextualPatterns = await this.findContextualPatterns(auditLogs);

    // Find cross-framework patterns
    analysis.crossFrameworkPatterns = await this.findCrossFrameworkPatterns(auditLogs);

    return {
      patterns: Array.from(analysis.patternFrequency.values())
        .filter(p => p.frequency >= this.config.patternThreshold)
        .sort((a, b) => b.frequency - a.frequency),
      temporalPatterns: analysis.temporalPatterns,
      contextualPatterns: analysis.contextualPatterns,
      crossFrameworkPatterns: analysis.crossFrameworkPatterns,
      violationRate: analysis.violationRate
    };
  }

  /**
   * Generate policy improvements based on pattern analysis
   */
  async generatePolicyImprovements(patternAnalysis) {
    const improvements = [];

    // High-frequency violation patterns
    const highFrequencyPatterns = patternAnalysis.patterns.filter(p => p.frequency > 10);
    for (const pattern of highFrequencyPatterns) {
      improvements.push(await this.createPolicyFromPattern(pattern, 'high_frequency'));
    }

    // Low effectiveness patterns
    const lowEffectivenessPatterns = patternAnalysis.patterns.filter(p => p.effectiveness < 0.5);
    for (const pattern of lowEffectivenessPatterns) {
      improvements.push(await this.improvePolicyFromPattern(pattern));
    }

    // Temporal patterns
    for (const temporalPattern of patternAnalysis.temporalPatterns) {
      improvements.push(await this.createTemporalPolicy(temporalPattern));
    }

    // Cross-framework patterns
    for (const crossPattern of patternAnalysis.crossFrameworkPatterns) {
      improvements.push(await this.createCrossFrameworkPolicy(crossPattern));
    }

    return improvements.filter(i => i !== null);
  }

  /**
   * Get agent statistics
   */
  getStatistics() {
    return {
      ...this.state.statistics,
      patternsCount: this.state.patterns.size,
      lastLearning: this.state.lastLearning,
      frameworksSupported: this.config.frameworks,
      healthStatus: this.state.health
    };
  }

  /**
   * Helper methods
   */
  extractFeatures(request, context) {
    return {
      requestType: request.type || 'unknown',
      target: request.target || '',
      userData: request.userData || {},
      framework: context.framework || 'unknown',
      region: context.region || 'unknown',
      timestamp: new Date().toISOString(),
      ...this.extractComplianceFeatures(request)
    };
  }

  extractLogFeatures(log) {
    return {
      logType: log.type,
      action: log.action,
      framework: log.framework,
      region: log.region,
      timestamp: log.timestamp,
      violations: log.violations || [],
      outcome: log.outcome
    };
  }

  detectFramework(context) {
    if (context.industry === 'healthcare') return 'HIPAA';
    if (context.region === 'EU') return 'GDPR';
    if (context.industry === 'finance') return 'FINRA';
    return 'GENERIC';
  }

  calculateConfidence(patterns, recommendations) {
    if (patterns.length === 0) return 0.5;

    const patternConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    const recommendationConfidence = recommendations.length > 0 ?
      recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length : 0.5;

    return (patternConfidence + recommendationConfidence) / 2;
  }

  buildReasoning(patterns, recommendations) {
    const reasons = [];

    if (patterns.length > 0) {
      reasons.push(`Detected ${patterns.length} relevant pattern(s)`);
    }

    if (recommendations.length > 0) {
      reasons.push(`Generated ${recommendations.length} policy recommendation(s)`);
    }

    return reasons.join('; ');
  }

  assessRiskLevel(recommendations) {
    const highSeverityRecs = recommendations.filter(r => r.severity === 'high');
    if (highSeverityRecs.length > 0) return 'high';

    const mediumSeverityRecs = recommendations.filter(r => r.severity === 'medium');
    if (mediumSeverityRecs.length > 0) return 'medium';

    return 'low';
  }

  // Placeholder implementations
  async loadExistingPatterns() { /* Implementation */ }
  async initializePatternModels() { /* Implementation */ }
  async storeAnalysis(analysis) { /* Implementation */ }
  async matchPattern(features, pattern, context) { /* Implementation */ }
  async classifyViolationType(violation) { /* Implementation */ }
  generateConditionFromFeatures(features) { /* Implementation */ }
  generatePatternId(pattern) { /* Implementation */ }
  matchesPattern(features, pattern) { /* Implementation */ }
  async clusterFeatures(features) { /* Implementation */ }
  async createPatternFromCluster(cluster, context) { /* Implementation */ }
  async findTemporalPatterns(auditLogs) { /* Implementation */ }
  async findContextualPatterns(auditLogs) { /* Implementation */ }
  async findCrossFrameworkPatterns(auditLogs) { /* Implementation */ }
  async createPolicyFromPattern(pattern, reason) { /* Implementation */ }
  async improvePolicyFromPattern(pattern) { /* Implementation */ }
  async createTemporalPolicy(temporalPattern) { /* Implementation */ }
  async createCrossFrameworkPolicy(crossPattern) { /* Implementation */ }
  deduplicateRecommendations(recommendations) { /* Implementation */ }
  prioritizeRecommendations(recommendations, context) { /* Implementation */ }
  extractComplianceFeatures(request) { /* Implementation */ }
  generateId() { return `policy_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`; }
  generateSessionId() { return `learn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`; }
  updateStatistics(session) { /* Implementation */ }
}

export { PolicyLearnerAgent };
export default PolicyLearnerAgent;