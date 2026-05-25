/**
 * LAM Provider Router Agent
 * Intelligently routes requests to optimal AI providers
 */

import { LAMBaseAgent } from './base-agent.js';

class ProviderRouterAgent extends LAMBaseAgent {
  constructor(config = {}) {
    super({
      name: 'provider-router',
      version: '1.0.0',
      ...config
    });

    this.config = {
      providers: {
        'openai': {
          name: 'OpenAI',
          endpoint: 'https://api.openai.com',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          strengths: ['general', 'coding', 'reasoning'],
          complianceScore: { 'GDPR': 0.7, 'HIPAA': 0.6, 'FINRA': 0.5, 'PCI': 0.6 },
          performanceScore: 0.8,
          costScore: 0.6,
          availabilityScore: 0.9
        },
        'anthropic': {
          name: 'Anthropic Claude',
          endpoint: 'https://api.anthropic.com',
          models: ['claude-3-opus', 'claude-3-sonnet'],
          strengths: ['reasoning', 'safety', 'analysis'],
          complianceScore: { 'GDPR': 0.8, 'HIPAA': 0.7, 'FINRA': 0.6, 'PCI': 0.7 },
          performanceScore: 0.85,
          costScore: 0.7,
          availabilityScore: 0.85
        },
        'aws-bedrock': {
          name: 'AWS Bedrock',
          endpoint: 'https://bedrock.amazonaws.com',
          models: ['titan', 'claude', 'llama'],
          strengths: ['enterprise', 'security', 'scalability'],
          complianceScore: { 'GDPR': 0.9, 'HIPAA': 0.95, 'FINRA': 0.9, 'PCI': 0.9 },
          performanceScore: 0.8,
          costScore: 0.8,
          availabilityScore: 0.95
        },
        'azure-openai': {
          name: 'Azure OpenAI',
          endpoint: 'https://azure.microsoft.com/services/openai-service',
          models: ['gpt-4', 'gpt-35-turbo'],
          strengths: ['enterprise', 'integration', 'security'],
          complianceScore: { 'GDPR': 0.9, 'HIPAA': 0.9, 'FINRA': 0.8, 'PCI': 0.85 },
          performanceScore: 0.75,
          costScore: 0.7,
          availabilityScore: 0.9
        },
        'google-vertex': {
          name: 'Google Vertex AI',
          endpoint: 'https://cloud.google.com/vertex-ai',
          models: ['gemini', 'palm'],
          strengths: ['multimodal', 'scalability', 'integration'],
          complianceScore: { 'GDPR': 0.8, 'HIPAA': 0.75, 'FINRA': 0.7, 'PCI': 0.7 },
          performanceScore: 0.8,
          costScore: 0.75,
          availabilityScore: 0.9
        }
      },
      routingStrategy: config.routingStrategy || 'weighted', // weighted, round-robin, performance-first, cost-first
      weights: {
        compliance: config.weights?.compliance || 0.4,
        performance: config.weights?.performance || 0.3,
        cost: config.weights?.cost || 0.2,
        availability: config.weights?.availability || 0.1
      },
      fallbackEnabled: config.fallbackEnabled !== false,
      learningEnabled: config.learningEnabled !== false,
      ...config
    };

    this.state = {
      providerHealth: new Map(),
      routingHistory: new Map(),
      performanceMetrics: new Map(),
      learningData: new Map(),
      statistics: {
        routes: 0,
        fallbacks: 0,
        optimalRoutes: 0,
        providerUsage: new Map()
      }
    };
  }

  /**
   * Initialize provider router agent
   */
  async initialize() {
    await super.initialize();

    // Initialize provider health monitoring
    await this.initializeProviderHealthMonitoring();

    // Load historical performance data
    await this.loadPerformanceData();

    // Initialize learning data
    await this.initializeLearningData();

    console.log('🎯 Provider Router Agent initialized');
  }

  /**
   * Analyze request and provide routing recommendation
   */
  async analyze(request, context = {}) {
    const analysis = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      requestId: request.id || 'unknown',
      recommendation: null,
      alternatives: [],
      confidence: 0,
      reasoning: '',
      providerScores: new Map(),
      context: context,
      estimatedPerformance: {},
      estimatedCost: {}
    };

    try {
      // Score each provider for this request
      analysis.providerScores = await this.scoreProviders(request, context);

      // Select optimal provider
      analysis.recommendation = await this.selectOptimalProvider(analysis.providerScores, context);

      // Generate alternatives
      analysis.alternatives = await this.generateAlternatives(analysis.providerScores, analysis.recommendation);

      // Calculate confidence
      analysis.confidence = this.calculateRoutingConfidence(analysis);

      // Build reasoning
      analysis.reasoning = this.buildRoutingReasoning(analysis);

      // Estimate performance and cost
      analysis.estimatedPerformance = await this.estimatePerformance(analysis.recommendation, request);
      analysis.estimatedCost = await this.estimateCost(analysis.recommendation, request);

      // Store routing decision for learning
      await this.storeRoutingDecision(analysis);

      // Update statistics
      this.state.statistics.routes++;

    } catch (error) {
      console.error('Provider routing analysis error:', error);
      analysis.error = error.message;
    }

    return analysis;
  }

  /**
   * Score all providers for a specific request
   */
  async scoreProviders(request, context) {
    const providerScores = new Map();

    for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
      try {
        const score = await this.scoreProvider(providerId, providerConfig, request, context);
        providerScores.set(providerId, score);
      } catch (error) {
        console.error(`Error scoring provider ${providerId}:`, error);
        providerScores.set(providerId, { score: 0, error: error.message });
      }
    }

    return providerScores;
  }

  /**
   * Score individual provider
   */
  async scoreProvider(providerId, providerConfig, request, context) {
    const score = {
      providerId,
      providerName: providerConfig.name,
      totalScore: 0,
      components: {
        compliance: 0,
        performance: 0,
        cost: 0,
        availability: 0,
        contextual: 0
      },
      reasoning: [],
      warnings: [],
      canHandle: true
    };

    // Check if provider can handle the request
    score.canHandle = await this.canProviderHandleRequest(providerConfig, request, context);
    if (!score.canHandle) {
      score.totalScore = 0;
      score.reasoning.push('Provider cannot handle this request type');
      return score;
    }

    // Compliance score
    score.components.compliance = await this.calculateComplianceScore(providerConfig, request, context);
    if (score.components.compliance < 0.5) {
      score.warnings.push('Low compliance score');
    }

    // Performance score
    score.components.performance = await this.calculatePerformanceScore(providerId, request, context);

    // Cost score
    score.components.cost = await this.calculateCostScore(providerConfig, request, context);

    // Availability score
    score.components.availability = await this.getProviderAvailability(providerId);

    // Contextual score
    score.components.contextual = await this.calculateContextualScore(providerConfig, request, context);

    // Calculate weighted total score
    const weights = this.config.weights;
    score.totalScore = (
      score.components.compliance * weights.compliance +
      score.components.performance * weights.performance +
      score.components.cost * weights.cost +
      score.components.availability * weights.availability +
      score.components.contextual * 0.1 // Bonus for contextual fit
    );

    // Add learning-based adjustments
    const learningAdjustment = await this.getLearningAdjustment(providerId, request, context);
    score.totalScore += learningAdjustment;

    // Build reasoning
    score.reasoning = this.buildProviderReasoning(score);

    return score;
  }

  /**
   * Calculate compliance score for provider
   */
  async calculateComplianceScore(providerConfig, request, context) {
    let complianceScore = 1.0;
    const framework = context.framework || 'GDPR';

    // Base compliance for framework
    const baseCompliance = providerConfig.complianceScore[framework] || 0.5;
    complianceScore = baseCompliance;

    // Data residency requirements
    if (context.region === 'EU' && !providerConfig.hasEUSovereignty) {
      complianceScore *= 0.7;
    }

    // Industry-specific requirements
    if (context.industry === 'healthcare' && framework === 'HIPAA') {
      const hipaaScore = providerConfig.complianceScore['HIPAA'] || 0.5;
      complianceScore = Math.min(complianceScore, hipaaScore);
    }

    // Data type sensitivity
    if (request.data && this.containsSensitiveData(request.data)) {
      complianceScore *= 0.9; // Slightly reduce for sensitive data
    }

    return Math.min(1.0, Math.max(0, complianceScore));
  }

  /**
   * Calculate performance score for provider
   */
  async calculatePerformanceScore(providerId, request, context) {
    const basePerformance = this.config.providers[providerId]?.performanceScore || 0.5;
    let performanceScore = basePerformance;

    // Get historical performance data
    const historicalData = this.state.performanceMetrics.get(providerId);
    if (historicalData) {
      const recentPerformance = this.getRecentPerformance(historicalData);
      performanceScore = (basePerformance + recentPerformance) / 2;
    }

    // Request type optimization
    const requestType = request.type || 'general';
    const providerStrengths = this.config.providers[providerId]?.strengths || [];
    if (providerStrengths.includes(requestType)) {
      performanceScore += 0.1; // Bonus for provider strengths
    }

    // Load considerations
    if (context.expectedLoad === 'high') {
      const scalability = await this.getProviderScalability(providerId);
      performanceScore *= scalability;
    }

    return Math.min(1.0, Math.max(0, performanceScore));
  }

  /**
   * Calculate cost score for provider
   */
  async calculateCostScore(providerConfig, request, context) {
    const baseCost = providerConfig.costScore || 0.5;
    let costScore = baseCost;

    // Request complexity affects cost
    const complexity = this.estimateRequestComplexity(request);
    if (complexity === 'high') {
      costScore *= 0.9; // More expensive for complex requests
    }

    // Volume discounts
    const usageStats = this.state.statistics.providerUsage.get(providerConfig.name) || 0;
    if (usageStats > 1000) {
      costScore += 0.1; // Volume discount
    }

    // Budget considerations
    if (context.budgetConstraint === 'strict') {
      costScore *= 1.2; // Prioritize cost more
    }

    return Math.min(1.0, Math.max(0, costScore));
  }

  /**
   * Get provider availability score
   */
  async getProviderAvailability(providerId) {
    const healthData = this.state.providerHealth.get(providerId);
    if (!healthData) {
      return 0.8; // Default availability
    }

    const recentUptime = this.calculateRecentUptime(healthData);
    return recentUptime;
  }

  /**
   * Calculate contextual score based on request characteristics
   */
  async calculateContextualScore(providerConfig, request, context) {
    let contextualScore = 0;

    // Model matching
    if (context.preferredModel && providerConfig.models.includes(context.preferredModel)) {
      contextualScore += 0.2;
    }

    // Regional preferences
    if (context.region === providerConfig.region) {
      contextualScore += 0.1;
    }

    // Industry expertise
    if (context.industry && providerConfig.industries?.includes(context.industry)) {
      contextualScore += 0.15;
    }

    // Language/region support
    if (context.language && providerConfig.supportedLanguages?.includes(context.language)) {
      contextualScore += 0.1;
    }

    return Math.min(0.5, contextualScore);
  }

  /**
   * Select optimal provider based on scores
   */
  async selectOptimalProvider(providerScores, context) {
    // Filter out providers that can't handle the request
    const eligibleProviders = Array.from(providerScores.entries())
      .filter(([_, score]) => score.canHandle && score.totalScore > 0);

    if (eligibleProviders.length === 0) {
      throw new Error('No eligible providers available');
    }

    // Sort by score
    eligibleProviders.sort((a, b) => b[1].totalScore - a[1].totalScore);

    const optimalProvider = eligibleProviders[0];

    return {
      providerId: optimalProvider[0],
      providerName: optimalProvider[1].providerName,
      score: optimalProvider[1].totalScore,
      confidence: this.calculateProviderConfidence(optimalProvider[1]),
      reasoning: optimalProvider[1].reasoning,
      estimatedLatency: await this.estimateLatency(optimalProvider[0]),
      estimatedCost: await this.estimateProviderCost(optimalProvider[0], context),
      fallbackOptions: eligibleProviders.slice(1, 3).map(([id, score]) => ({
        providerId: id,
        providerName: score.providerName,
        score: score.totalScore
      }))
    };
  }

  /**
   * Generate alternative provider options
   */
  async generateAlternatives(providerScores, recommendation) {
    const alternatives = [];

    for (const [providerId, score] of providerScores.entries()) {
      if (providerId !== recommendation.providerId && score.canHandle && score.totalScore > 0.3) {
        alternatives.push({
          providerId,
          providerName: score.providerName,
          score: score.totalScore,
          reasoning: score.reasoning,
          useCase: this.suggestUseCase(providerId, score, recommendation)
        });
      }
    }

    // Sort by score and return top alternatives
    return alternatives.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  /**
   * Calculate routing confidence
   */
  calculateRoutingConfidence(analysis) {
    if (!analysis.recommendation) return 0;

    let confidence = analysis.recommendation.confidence;

    // Higher confidence if top provider is significantly better than alternatives
    if (analysis.alternatives.length > 0) {
      const scoreGap = analysis.recommendation.score - analysis.alternatives[0].score;
      if (scoreGap > 0.2) {
        confidence += 0.1;
      }
    }

    // Lower confidence if scores are close
    const closeScores = analysis.alternatives.filter(alt =>
      Math.abs(alt.score - analysis.recommendation.score) < 0.1
    ).length;
    if (closeScores > 1) {
      confidence -= 0.1;
    }

    return Math.min(1.0, Math.max(0, confidence));
  }

  /**
   * Build routing reasoning
   */
  buildRoutingReasoning(analysis) {
    const reasons = [];

    if (!analysis.recommendation) {
      return 'No suitable provider available';
    }

    // Primary reason
    reasons.push(`Selected ${analysis.recommendation.providerName} with score ${(analysis.recommendation.score * 100).toFixed(1)}%`);

    // Top factors
    const topFactors = this.getTopScoringFactors(analysis.providerScores.get(analysis.recommendation.providerId));
    if (topFactors.length > 0) {
      reasons.push(`Key factors: ${topFactors.join(', ')}`);
    }

    // Alternatives information
    if (analysis.alternatives.length > 0) {
      const altCount = analysis.alternatives.length;
      const bestAlt = analysis.alternatives[0];
      reasons.push(`${altCount} alternative(s) available, best: ${bestAlt.providerName} (${(bestAlt.score * 100).toFixed(1)}%)`);
    }

    return reasons.join('; ');
  }

  /**
   * Update routing statistics after execution
   */
  async updateRoutingStats(providerId, executionResult) {
    // Update usage statistics
    const providerName = this.config.providers[providerId]?.name || providerId;
    const currentUsage = this.state.statistics.providerUsage.get(providerName) || 0;
    this.state.statistics.providerUsage.set(providerName, currentUsage + 1);

    // Update performance metrics
    await this.updatePerformanceMetrics(providerId, executionResult);

    // Store for learning
    await this.storeLearningData(providerId, executionResult);
  }

  /**
   * Handle fallback scenarios
   */
  async handleFallback(originalProvider, request, context, error) {
    if (!this.config.fallbackEnabled) {
      throw error;
    }

    this.state.statistics.fallbacks++;

    // Get alternative providers
    const analysis = await this.analyze(request, context);
    const fallbackProviders = analysis.alternatives.filter(alt => alt.providerId !== originalProvider);

    if (fallbackProviders.length === 0) {
      throw new Error('No fallback providers available');
    }

    // Try next best provider
    const fallbackProvider = fallbackProviders[0];
    console.log(`🔄 Falling back from ${originalProvider} to ${fallbackProvider.providerId}`);

    return {
      fallbackProvider: fallbackProvider.providerId,
      fallbackReason: error.message,
      originalProvider,
      alternativeProviders: fallbackProviders.slice(1)
    };
  }

  /**
   * Helper methods
   */
  async canProviderHandleRequest(providerConfig, request, context) {
    // Check if provider supports the request type
    if (context.requiredCapabilities) {
      const providerCapabilities = providerConfig.capabilities || [];
      const hasAllCapabilities = context.requiredCapabilities.every(cap =>
        providerCapabilities.includes(cap)
      );
      if (!hasAllCapabilities) return false;
    }

    // Check model availability
    if (context.preferredModel && !providerConfig.models.includes(context.preferredModel)) {
      return false;
    }

    // Check regional constraints
    if (context.region === 'EU' && !providerConfig.hasEUSovereignty) {
      return false;
    }

    return true;
  }

  containsSensitiveData(data) {
    const sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
      /medical|health|phi|patient/i
    ];

    const dataStr = JSON.stringify(data).toLowerCase();
    return sensitivePatterns.some(pattern => pattern.test(dataStr));
  }

  estimateRequestComplexity(request) {
    // Simple complexity estimation based on data size and request type
    const dataSize = JSON.stringify(request.data || {}).length;
    const complexTypes = ['analyze', 'generate', 'create', 'modify'];

    if (dataSize > 10000 || complexTypes.includes(request.type)) {
      return 'high';
    } else if (dataSize > 1000) {
      return 'medium';
    }
    return 'low';
  }

  getTopScoringFactors(providerScore) {
    const factors = [];
    const components = providerScore.components;

    if (components.compliance > 0.7) factors.push('compliance');
    if (components.performance > 0.7) factors.push('performance');
    if (components.cost > 0.7) factors.push('cost');
    if (components.availability > 0.9) factors.push('availability');
    if (components.contextual > 0.2) factors.push('contextual');

    return factors;
  }

  suggestUseCase(providerId, score, recommendation) {
    const scoreDiff = recommendation.score - score.score;
    if (scoreDiff < 0.1) return 'similar_performance';
    if (score.components.cost > recommendation.estimatedCost) return 'cost_saving';
    if (score.components.availability > 0.95) return 'high_availability';
    return 'backup_option';
  }

  // Placeholder implementations
  async initializeProviderHealthMonitoring() { /* Implementation */ }
  async loadPerformanceData() { /* Implementation */ }
  async initializeLearningData() { /* Implementation */ }
  async getRecentPerformance(historicalData) { /* Implementation */ }
  async getProviderScalability(providerId) { /* Implementation */ }
  async getLearningAdjustment(providerId, request, context) { /* Implementation */ }
  buildProviderReasoning(score) { return score.reasoning; }
  calculateProviderConfidence(score) { return Math.min(1.0, score.totalScore + 0.1); }
  async estimateLatency(providerId) { return 150; } // Default 150ms
  async estimateProviderCost(providerId, context) { return 0.01; } // Default cost
  async estimatePerformance(recommendation, request) { return { latency: 150 }; }
  async estimateCost(recommendation, request) { return { amount: 0.01, currency: 'USD' }; }
  async storeRoutingDecision(analysis) { /* Implementation */ }
  async updatePerformanceMetrics(providerId, executionResult) { /* Implementation */ }
  async storeLearningData(providerId, executionResult) { /* Implementation */ }
  calculateRecentUptime(healthData) { return 0.95; } // Default 95% uptime
}

export { ProviderRouterAgent };
export default ProviderRouterAgent;