/**
 * Agent Learning and Adaptation System
 * Revolutionary AI-powered learning system for autonomous agent improvement
 */

import { BaseAgent, AgentState, AgentContext } from './agent-framework';

export interface LearningEvent {
  id: string;
  agent_id: string;
  timestamp: Date;
  event_type: 'success' | 'failure' | 'correction' | 'feedback' | 'discovery';
  context: any;
  outcome: any;
  confidence_before: number;
  confidence_after: number;
  performance_impact: number;
  learning_data: any;
}

export interface LearningPattern {
  id: string;
  pattern_type: 'behavioral' | 'procedural' | 'decision' | 'collaborative';
  description: string;
  conditions: any;
  actions: any[];
  success_rate: number;
  confidence: number;
  usage_count: number;
  last_updated: Date;
  effectiveness_score: number;
}

export interface FeedbackData {
  id: string;
  agent_id: string;
  timestamp: Date;
  feedback_type: 'human' | 'system' | 'peer';
  rating: number;
  comments: string;
  context: any;
  outcome: any;
  implemented: boolean;
}

export interface AdaptationStrategy {
  id: string;
  strategy_type: 'parameter_tuning' | 'model_retraining' | 'workflow_optimization' | 'capability_enhancement';
  description: string;
  conditions: any;
  actions: any[];
  expected_improvement: number;
  confidence_threshold: number;
  auto_implement: boolean;
}

export interface LearningMetrics {
  learning_events_processed: number;
  adaptation_success_rate: number;
  performance_improvement_rate: number;
  knowledge_base_size: number;
  pattern_discovery_rate: number;
  feedback_utilization_rate: number;
  last_learning_cycle: Date;
  overall_learning_score: number;
}

/**
 * Learning and Adaptation System Class
 */
export class AgentLearningSystem {
  private learningEvents: Map<string, LearningEvent[]> = new Map();
  private learningPatterns: Map<string, LearningPattern> = new Map();
  private feedbackData: Map<string, FeedbackData[]> = new Map();
  private adaptationStrategies: Map<string, AdaptationStrategy> = new Map();
  private knowledgeBase: Map<string, any> = new Map();
  private metrics: LearningMetrics;

  constructor() {
    this.metrics = {
      learning_events_processed: 0,
      adaptation_success_rate: 0.0,
      performance_improvement_rate: 0.0,
      knowledge_base_size: 0,
      pattern_discovery_rate: 0.0,
      feedback_utilization_rate: 0.0,
      last_learning_cycle: new Date(),
      overall_learning_score: 0.0,
    };

    this.initializeLearningSystem();
  }

  /**
   * Initialize learning system
   */
  private initializeLearningSystem(): void {
    // Initialize with base patterns and knowledge
    this.knowledgeBase.set('base_patterns', {
      behavioral: [],
      procedural: [],
      decision: [],
      collaborative: []
    });

    // Initialize learning thresholds
    this.knowledgeBase.set('learning_thresholds', {
      min_events: 10,
      min_feedback: 3,
      confidence_threshold: 0.7,
      pattern_similarity_threshold: 0.8
    });
  }

  /**
   * Process learning event from agent execution
   */
  async processLearningEvent(
    agentId: string,
    eventType: LearningEvent['event_type'],
    context: any,
    outcome: any,
    confidenceBefore: number,
    confidenceAfter: number
  ): Promise<void> {
    const learningEvent: LearningEvent = {
      id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agent_id: agentId,
      timestamp: new Date(),
      event_type: eventType,
      context,
      outcome,
      confidence_before: confidenceBefore,
      confidence_after: confidenceAfter,
      performance_impact: this.calculatePerformanceImpact(confidenceBefore, confidenceAfter, outcome),
      learning_data: this.extractLearningData(context, outcome),
    };

    // Store learning event
    if (!this.learningEvents.has(agentId)) {
      this.learningEvents.set(agentId, []);
    }
    this.learningEvents.get(agentId)!.push(learningEvent);

    // Update metrics
    this.metrics.learning_events_processed++;

    // Trigger pattern recognition
    await this.recognizePatterns(agentId, learningEvent);

    // Trigger learning cycle if conditions met
    await this.checkLearningCycleConditions(agentId);

    // Store in knowledge base
    this.updateKnowledgeBase(learningEvent);
  }

  /**
   * Process human feedback
   */
  async processFeedback(
    agentId: string,
    feedbackType: FeedbackData['feedback_type'],
    rating: number,
    comments: string,
    context: any,
    outcome: any
  ): Promise<void> {
    const feedback: FeedbackData = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agent_id: agentId,
      timestamp: new Date(),
      feedback_type: feedbackType,
      rating,
      comments,
      context,
      outcome,
      implemented: false,
    };

    // Store feedback
    if (!this.feedbackData.has(agentId)) {
      this.feedbackData.set(agentId, []);
    }
    this.feedbackData.get(agentId)!.push(feedback);

    // Analyze feedback for patterns
    await this.analyzeFeedbackPatterns(agentId, feedback);

    // Update feedback utilization metrics
    this.updateFeedbackUtilization(agentId);

    // Generate adaptation strategies
    await this.generateAdaptationStrategies(agentId, feedback);
  }

  /**
   * Recognize learning patterns from events
   */
  private async recognizePatterns(agentId: string, learningEvent: LearningEvent): Promise<void> {
    const agentEvents = this.learningEvents.get(agentId) || [];
    const recentEvents = agentEvents.slice(-20); // Last 20 events

    // Look for behavioral patterns
    await this.recognizeBehavioralPatterns(agentId, recentEvents, learningEvent);

    // Look for procedural patterns
    await this.recognizeProceduralPatterns(agentId, recentEvents, learningEvent);

    // Look for decision patterns
    await this.recognizeDecisionPatterns(agentId, recentEvents, learningEvent);

    // Update pattern discovery rate
    this.updatePatternDiscoveryRate(agentId);
  }

  /**
   * Recognize behavioral patterns
   */
  private async recognizeBehavioralPatterns(
    agentId: string,
    events: LearningEvent[],
    newEvent: LearningEvent
  ): Promise<void> {
    // Analyze sequence of actions and outcomes
    const sequences = this.extractBehavioralSequences(events, newEvent);

    for (const sequence of sequences) {
      const existingPattern = this.findExistingPattern(agentId, sequence, 'behavioral');

      if (existingPattern) {
        // Update existing pattern
        this.updatePattern(agentId, existingPattern.id, sequence);
      } else {
        // Create new pattern
        await this.createPattern(agentId, sequence, 'behavioral');
      }
    }
  }

  /**
   * Recognize procedural patterns
   */
  private async recognizeProceduralPatterns(
    agentId: string,
    events: LearningEvent[],
    newEvent: LearningEvent
  ): Promise<void> {
    // Analyze procedural execution patterns
    const procedures = this.extractProceduralSequences(events, newEvent);

    for (const procedure of procedures) {
      const existingPattern = this.findExistingPattern(agentId, procedure, 'procedural');

      if (existingPattern) {
        // Update existing pattern
        this.updatePattern(agentId, existingPattern.id, procedure);
      } else {
        // Create new pattern
        await this.createPattern(agentId, procedure, 'procedural');
      }
    }
  }

  /**
   * Recognize decision patterns
   */
  private async recognizeDecisionPatterns(
    agentId: string,
    events: LearningEvent[],
    newEvent: LearningEvent
  ): Promise<void> {
    // Analyze decision-making patterns
    const decisions = this.extractDecisionSequences(events, newEvent);

    for (const decision of decisions) {
      const existingPattern = this.findExistingPattern(agentId, decision, 'decision');

      if (existingPattern) {
        // Update existing pattern
        this.updatePattern(agentId, existingPattern.id, decision);
      } else {
        // Create new pattern
        await this.createPattern(agentId, decision, 'decision');
      }
    }
  }

  /**
   * Check if learning cycle should be triggered
   */
  private async checkLearningCycleConditions(agentId: string): Promise<void> {
    const agentEvents = this.learningEvents.get(agentId) || [];
    const agentFeedback = this.feedbackData.get(agentId) || [];

    // Check if we have enough data for learning
    const minEvents = 10;
    const minFeedback = 3;

    if (agentEvents.length >= minEvents || agentFeedback.length >= minFeedback) {
      await this.triggerLearningCycle(agentId);
    }

    // Check time-based learning cycle
    const lastCycle = this.metrics.last_learning_cycle;
    const timeSinceLastCycle = Date.now() - lastCycle.getTime();
    const cycleInterval = 24 * 60 * 60 * 1000; // 24 hours

    if (timeSinceLastCycle >= cycleInterval) {
      await this.triggerLearningCycle(agentId);
    }
  }

  /**
   * Trigger comprehensive learning cycle
   */
  private async triggerLearningCycle(agentId: string): Promise<void> {
    const learningEvents = this.learningEvents.get(agentId) || [];
    const feedbackData = this.feedbackData.get(agentId) || [];
    const patterns = Array.from(this.learningPatterns.values()).filter(p =>
      p.id.includes(agentId)
    );

    try {
      // 1. Analyze performance trends
      const performanceTrends = await this.analyzePerformanceTrends(agentId, learningEvents);

      // 2. Identify improvement opportunities
      const improvementOpportunities = await this.identifyImprovementOpportunities(
        agentId,
        learningEvents,
        feedbackData,
        patterns
      );

      // 3. Generate adaptation strategies
      const strategies = await this.generateComprehensiveStrategies(
        agentId,
        improvementOpportunities,
        performanceTrends
      );

      // 4. Implement high-confidence adaptations
      const successfulAdaptations = await this.implementAdaptations(agentId, strategies);

      // 5. Update learning metrics
      this.updateLearningMetrics(agentId, successfulAdaptations);

      // 6. Record learning cycle
      this.metrics.last_learning_cycle = new Date();

      // Store learning cycle summary
      this.storeLearningCycleSummary(agentId, {
        timestamp: new Date(),
        events_analyzed: learningEvents.length,
        feedback_processed: feedbackData.length,
        patterns_used: patterns.length,
        adaptations_attempted: strategies.length,
        adaptations_successful: successfulAdaptations.length,
        performance_change: this.calculatePerformanceChange(agentId, learningEvents),
      });

    } catch (error) {
      console.error(`Learning cycle failed for agent ${agentId}:`, error);
    }
  }

  /**
   * Analyze performance trends
   */
  private async analyzePerformanceTrends(agentId: string, events: LearningEvent[]): Promise<any> {
    const successes = events.filter(e => e.event_type === 'success');
    const failures = events.filter(e => e.event_type === 'failure');

    const successRate = events.length > 0 ? successes.length / events.length : 0;
    const avgPerformanceImpact = events.reduce((sum, e) => sum + e.performance_impact, 0) / events.length;

    const trend = this.calculateTrend(
      events.map(e => e.confidence_after)
    );

    return {
      success_rate: successRate,
      average_performance_impact: avgPerformanceImpact,
      trend_direction: trend.direction,
      trend_strength: trend.strength,
      period_covered: events.length,
    };
  }

  /**
   * Identify improvement opportunities
   */
  private async identifyImprovementOpportunities(
    agentId: string,
    events: LearningEvent[],
    feedbackData: FeedbackData[],
    patterns: LearningPattern[]
  ): Promise<any[]> {
    const opportunities = [];

    // Analyze failure patterns
    const failures = events.filter(e => e.event_type === 'failure');
    if (failures.length > 0) {
      const commonFailurePatterns = this.findCommonFailurePatterns(failures);
      opportunities.push(...commonFailurePatterns.map(pattern => ({
        type: 'failure_pattern',
        description: `Common failure pattern: ${pattern.description}`,
        priority: pattern.frequency > 0.5 ? 'high' : 'medium',
        recommended_action: pattern.recommended_action,
        data: pattern,
      })));
    }

    // Analyze feedback for recurring issues
    const recurringFeedback = this.findRecurringFeedback(feedbackData);
    opportunities.push(...recurringFeedback.map(feedback => ({
      type: 'recurring_feedback',
      description: `Recurring feedback: ${feedback.comments}`,
      priority: feedback.average_rating < 3 ? 'high' : 'medium',
      recommended_action: 'Address user concerns systematically',
      data: feedback,
    })));

    // Analyze low-performing patterns
    const lowPerformingPatterns = patterns.filter(p => p.success_rate < 0.6);
    opportunities.push(...lowPerformingPatterns.map(pattern => ({
      type: 'low_performing_pattern',
      description: `Low-performing pattern: ${pattern.description}`,
      priority: 'medium',
      recommended_action: 'Refine or replace pattern logic',
      data: pattern,
    })));

    return opportunities;
  }

  /**
   * Generate comprehensive adaptation strategies
   */
  private async generateComprehensiveStrategies(
    agentId: string,
    opportunities: any[],
    performanceTrends: any
  ): Promise<AdaptationStrategy[]> {
    const strategies: AdaptationStrategy[] = [];

    for (const opportunity of opportunities) {
      let strategy: AdaptationStrategy;

      switch (opportunity.type) {
        case 'failure_pattern':
          strategy = this.generateFailurePatternStrategy(opportunity);
          break;
        case 'recurring_feedback':
          strategy = this.generateFeedbackStrategy(opportunity);
          break;
        case 'low_performing_pattern':
          strategy = this.generatePatternImprovementStrategy(opportunity);
          break;
        default:
          strategy = this.generateGenericStrategy(opportunity);
      }

      strategies.push(strategy);
    }

    return strategies;
  }

  /**
   * Implement adaptations
   */
  private async implementAdaptations(
    agentId: string,
    strategies: AdaptationStrategy[]
  ): Promise<number> {
    let successfulCount = 0;

    for (const strategy of strategies) {
      if (strategy.auto_implement && strategy.confidence_threshold < 0.7) {
        continue; // Skip low-confidence auto-implementations
      }

      try {
        const success = await this.implementStrategy(agentId, strategy);
        if (success) {
          successfulCount++;
          this.adaptationStrategies.set(strategy.id, strategy);
        }
      } catch (error) {
        console.error(`Failed to implement strategy ${strategy.id}:`, error);
      }
    }

    return successfulCount;
  }

  /**
   * Implement specific adaptation strategy
   */
  private async implementStrategy(agentId: string, strategy: AdaptationStrategy): Promise<boolean> {
    // This would interface with the actual agent to implement adaptations
    // For now, return success as placeholder
    return true;
  }

  /**
   * Analyze feedback patterns
   */
  private async analyzeFeedbackPatterns(agentId: string, feedback: FeedbackData): Promise<void> {
    // Look for patterns in feedback
    const allFeedback = this.feedbackData.get(agentId) || [];

    // Group feedback by themes
    const themes = this.groupFeedbackByThemes(allFeedback);

    // Store theme patterns in knowledge base
    for (const [theme, feedbacks] of themes) {
      this.knowledgeBase.set(`feedback_theme_${agentId}_${theme}`, {
        theme,
        feedbacks,
        average_rating: feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length,
        frequency: feedbacks.length,
        last_updated: new Date(),
      });
    }
  }

  /**
   * Generate adaptation strategies from feedback
   */
  private async generateAdaptationStrategies(agentId: string, feedback: FeedbackData): Promise<void> {
    const strategies: AdaptationStrategy[] = [];

    if (feedback.rating < 3) {
      strategies.push({
        id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategy_type: 'parameter_tuning',
        description: `Improve agent performance based on feedback: ${feedback.comments}`,
        conditions: { feedback_id: feedback.id },
        actions: ['adjust_parameters', 'update_confidence', 'refine_approach'],
        expected_improvement: 0.1,
        confidence_threshold: 0.7,
        auto_implement: true,
      });
    }

    for (const strategy of strategies) {
      this.adaptationStrategies.set(strategy.id, strategy);
    }
  }

  /**
   * Extract learning data from context and outcome
   */
  private extractLearningData(context: any, outcome: any): any {
    return {
      context_hash: this.hashObject(context),
      outcome_hash: this.hashObject(outcome),
      context_summary: this.summarizeContext(context),
      outcome_summary: this.summarizeOutcome(outcome),
      extraction_timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate performance impact
   */
  private calculatePerformanceImpact(
    confidenceBefore: number,
    confidenceAfter: number,
    outcome: any
  ): number {
    // Calculate impact based on confidence change and outcome success
    const confidenceChange = confidenceAfter - confidenceBefore;
    const outcomeSuccess = outcome.success || (outcome.error === undefined);

    return (confidenceChange * 0.7) + (outcomeSuccess ? 0.3 : -0.3);
  }

  /**
   * Extract behavioral sequences
   */
  private extractBehavioralSequences(
    events: LearningEvent[],
    newEvent: LearningEvent
  ): any[] {
    // Extract sequences of behavioral patterns
    const sequences = [];
    const sequenceLength = 5;

    for (let i = Math.max(0, events.length - sequenceLength + 1); i < events.length; i++) {
      const sequence = events.slice(i, i + sequenceLength);
      sequences.push({
        sequence_type: 'behavioral',
        events: sequence.map(e => ({
          event_type: e.event_type,
          context: e.context,
          outcome: e.outcome,
        })),
        outcome: newEvent.outcome,
      });
    }

    return sequences;
  }

  /**
   * Extract procedural sequences
   */
  private extractProceduralSequences(
    events: LearningEvent[],
    newEvent: LearningEvent
  ): any[] {
    // Extract sequences of procedural execution patterns
    const sequences = [];
    const sequenceLength = 3;

    for (let i = Math.max(0, events.length - sequenceLength + 1); i < events.length; i++) {
      const sequence = events.slice(i, i + sequenceLength);
      if (this.isProceduralSequence(sequence)) {
        sequences.push({
          sequence_type: 'procedural',
          steps: sequence.map(e => ({
            action: e.context.action,
            outcome: e.outcome,
            success: e.event_type === 'success',
          })),
        });
      }
    }

    return sequences;
  }

  /**
   * Extract decision sequences
   */
  private extractDecisionSequences(
    events: LearningEvent[],
    newEvent: LearningEvent
  ): any[] {
    // Extract sequences of decision-making patterns
    const sequences = [];
    const sequenceLength = 4;

    for (let i = Math.max(0, events.length - sequenceLength + 1); i < events.length; i++) {
      const sequence = events.slice(i, i + sequenceLength);
      if (this.isDecisionSequence(sequence)) {
        sequences.push({
          sequence_type: 'decision',
          decisions: sequence.map(e => ({
            context: e.context,
            decision: e.outcome.decision,
            confidence: e.confidence_after,
            outcome: e.outcome,
          })),
        });
      }
    }

    return sequences;
  }

  /**
   * Check if sequence is procedural
   */
  private isProceduralSequence(sequence: LearningEvent[]): boolean {
    return sequence.every(e => e.context.action && e.context.step_order);
  }

  /**
   * Check if sequence is decision-based
   */
  private isDecisionSequence(sequence: LearningEvent[]): boolean {
    return sequence.every(e => e.outcome && e.outcome.decision);
  }

  /**
   * Find existing pattern
   */
  private findExistingPattern(
    agentId: string,
    sequence: any,
    patternType: string
  ): LearningPattern | null {
    const patterns = Array.from(this.learningPatterns.values())
      .filter(p => p.pattern_type === patternType)
      .filter(p => p.id.includes(agentId));

    for (const pattern of patterns) {
      if (this.patternMatches(pattern, sequence)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Check if pattern matches sequence
   */
  private patternMatches(pattern: LearningPattern, sequence: any): boolean {
    // Simplified pattern matching - would use more sophisticated matching in production
    return JSON.stringify(pattern.conditions) === JSON.stringify(sequence);
  }

  /**
   * Update existing pattern
   */
  private updatePattern(agentId: string, patternId: string, sequence: any): void {
    const pattern = this.learningPatterns.get(patternId);
    if (pattern) {
      pattern.usage_count++;
      pattern.success_rate = this.calculatePatternSuccessRate(pattern, sequence);
      pattern.confidence = Math.min(1.0, pattern.confidence + 0.05);
      pattern.effectiveness_score = pattern.success_rate * pattern.confidence;
      pattern.last_updated = new Date();
    }
  }

  /**
   * Create new learning pattern
   */
  private async createPattern(
    agentId: string,
    sequence: any,
    patternType: string
  ): Promise<void> {
    const pattern: LearningPattern = {
      id: `pattern_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern_type: patternType,
      description: this.generatePatternDescription(sequence, patternType),
      conditions: sequence,
      actions: this.extractActionsFromSequence(sequence),
      success_rate: 1.0,
      confidence: 0.5,
      usage_count: 1,
      last_updated: new Date(),
      effectiveness_score: 0.5,
    };

    this.learningPatterns.set(pattern.id, pattern);
  }

  /**
   * Calculate pattern success rate
   */
  private calculatePatternSuccessRate(pattern: LearningPattern, sequence: any): number {
    // Calculate success rate based on pattern usage and outcomes
    const recentUsages = Math.min(pattern.usage_count, 10);
    const successWeight = 0.8;
    const recencyWeight = 0.2;

    return (pattern.success_rate * (recentUsages / pattern.usage_count) * successWeight) +
           (1.0 - recentUsages / pattern.usage_count) * recencyWeight;
  }

  /**
   * Generate pattern description
   */
  private generatePatternDescription(sequence: any, patternType: string): string {
    return `AI-learned ${patternType} pattern: ${JSON.stringify(sequence).slice(0, 100)}...`;
  }

  /**
   * Extract actions from sequence
   */
  private extractActionsFromSequence(sequence: any): any[] {
    return sequence.map(item => item.context?.action || item.outcome?.action || 'unknown');
  }

  /**
   * Generate failure pattern strategy
   */
  private generateFailurePatternStrategy(opportunity: any): AdaptationStrategy {
    return {
      id: `strategy_failure_${Date.now()}_${opportunity.data.type}`,
      strategy_type: 'workflow_optimization',
      description: `Optimize workflow to avoid ${opportunity.data.description}`,
      conditions: { pattern: opportunity.data },
      actions: ['redesign_workflow', 'add_safeguards', 'improve_validation'],
      expected_improvement: 0.2,
      confidence_threshold: 0.8,
      auto_implement: true,
    };
  }

  /**
   * Generate pattern improvement strategy
   */
  private generatePatternImprovementStrategy(opportunity: any): AdaptationStrategy {
    return {
      id: `strategy_pattern_${Date.now()}_${opportunity.data.id}`,
      strategy_type: 'workflow_optimization',
      description: `Improve pattern: ${opportunity.data.description}`,
      conditions: { pattern: opportunity.data },
      actions: ['refine_logic', 'update_conditions', 'improve_actions'],
      expected_improvement: 0.25,
      confidence_threshold: 0.8,
      auto_implement: true,
    };
  }

  /**
   * Generate feedback strategy
   */
  private generateFeedbackStrategy(feedback: FeedbackData): AdaptationStrategy {
    return {
      id: `strategy_feedback_${feedback.id}`,
      strategy_type: 'parameter_tuning',
      description: `Adjust parameters based on feedback: ${feedback.comments}`,
      conditions: { feedback_id: feedback.id },
      actions: ['adjust_confidence', 'update_approach', 'refine_methods'],
      expected_improvement: 0.15,
      confidence_threshold: 0.75,
      auto_implement: true,
    };
  }

  /**
   * Generate generic strategy
   */
  private generateGenericStrategy(opportunity: any): AdaptationStrategy {
    return {
      id: `strategy_generic_${Date.now()}_${opportunity.type}`,
      strategy_type: 'capability_enhancement',
      description: `Enhance capabilities: ${opportunity.description}`,
      conditions: { opportunity: opportunity },
      actions: ['enhance_model', 'improve_methods', 'expand_tools'],
      expected_improvement: 0.1,
      confidence_threshold: 0.7,
      auto_implement: false,
    };
  }

  /**
   * Find common failure patterns
   */
  private findCommonFailurePatterns(failures: LearningEvent[]): any[] {
    // Analyze failures to find common patterns
    const patterns = new Map();

    failures.forEach(failure => {
      const key = this.generateFailureKey(failure.context);
      if (!patterns.has(key)) {
        patterns.set(key, []);
      }
      patterns.get(key)!.push(failure);
    });

    return Array.from(patterns.entries())
      .filter(([_, failures]) => failures.length >= 2)
      .map(([key, failuresArray]) => ({
        description: key,
        frequency: failuresArray.length / failures.length,
        recommended_action: this.generateFailureRecommendation(key, failuresArray),
        data: failuresArray,
      }));
  }

  /**
   * Find recurring feedback
   */
  private findRecurringFeedback(feedback: FeedbackData[]): any[] {
    // Group feedback by themes
    const themes = this.groupFeedbackByThemes(feedback);

    return Array.from(themes.entries())
      .filter(([_, feedbacks]) => feedbacks.length >= 2)
      .map(([theme, feedbacksArray]) => ({
        theme,
        feedbacks: feedbacksArray,
        average_rating: feedbacksArray.reduce((sum, f) => sum + f.rating, 0) / feedbacksArray.length,
      }));
  }

  /**
   * Group feedback by themes
   */
  private groupFeedbackByThemes(feedback: FeedbackData[]): Map<string, FeedbackData[]> {
    const themes = new Map();

    feedback.forEach(f => {
      const theme = this.extractTheme(f.comments);
      if (!themes.has(theme)) {
        themes.set(theme, []);
      }
      themes.get(theme)!.push(f);
    });

    return themes;
  }

  /**
   * Extract theme from feedback comments
   */
  private extractTheme(comments: string): string {
    // Simple theme extraction - would use NLP in production
    const keywords = comments.toLowerCase().split(' ');
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];

    return keywords
      .filter(word => !stopWords.includes(word))
      .slice(0, 3)
      .join(' ');
  }

  /**
   * Generate failure key
   */
  private generateFailureKey(context: any): string {
    return `${context.action}_${context.error_type || 'unknown'}`;
  }

  /**
   * Generate failure recommendation
   */
  private generateFailureRecommendation(key: string, failures: any[]): string {
    return `Improve error handling for ${key}`;
  }

  /**
   * Calculate trend
   */
  private calculateTrend(values: number[]): { direction: 'up' | 'down' | 'stable'; strength: number } {
    if (values.length < 2) return { direction: 'stable', strength: 0 };

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;
    const strength = Math.abs(change);

    return {
      direction: change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'stable',
      strength: Math.min(strength, 1.0),
    };
  }

  /**
   * Update pattern discovery rate
   */
  private updatePatternDiscoveryRate(agentId: string): void {
    const totalEvents = this.learningEvents.get(agentId)?.length || 0;
    const totalPatterns = this.learningPatterns.size;

    this.metrics.pattern_discovery_rate = totalEvents > 0 ? totalPatterns / totalEvents : 0;
  }

  /**
   * Update feedback utilization rate
   */
  private updateFeedbackUtilization(agentId: string): void {
    const totalEvents = this.learningEvents.get(agentId)?.length || 0;
    const totalFeedback = this.feedbackData.get(agentId)?.length || 0;

    this.metrics.feedback_utilization_rate = totalEvents > 0 ? totalFeedback / totalEvents : 0;
  }

  /**
   * Update learning metrics
   */
  private updateLearningMetrics(agentId: string, successfulAdaptations: number): void {
    // Calculate adaptation success rate
    const totalStrategies = this.adaptationStrategies.size;
    this.metrics.adaptation_success_rate = totalStrategies > 0 ? successfulAdaptations / totalStrategies : 0;

    // Calculate performance improvement rate
    const events = this.learningEvents.get(agentId) || [];
    if (events.length >= 10) {
      const recentEvents = events.slice(-10);
      const performanceChange = this.calculatePerformanceChange(agentId, recentEvents);
      this.metrics.performance_improvement_rate = performanceChange;
    }

    // Update knowledge base size
    this.metrics.knowledge_base_size = this.knowledgeBase.size;

    // Calculate overall learning score
    this.calculateOverallLearningScore();
  }

  /**
   * Calculate performance change
   */
  private calculatePerformanceChange(agentId: string, events: LearningEvent[]): number {
    const performanceImpacts = events.map(e => e.performance_impact);
    const avgImpact = performanceImpacts.reduce((sum, impact) => sum + impact, 0) / performanceImpacts.length;

    return avgImpact;
  }

  /**
   * Calculate overall learning score
   */
  private calculateOverallLearningScore(): void {
    const weights = {
      adaptation_success: 0.4,
      performance_improvement: 0.3,
      feedback_utilization: 0.2,
      pattern_discovery: 0.1,
    };

    this.metrics.overall_learning_score =
      weights.adaptation_success * this.metrics.adaptation_success_rate +
      weights.performance_improvement * this.metrics.performance_improvement_rate +
      weights.feedback_utilization * this.metrics.feedback_utilization_rate +
      weights.pattern_discovery * this.metrics.pattern_discovery_rate;
  }

  /**
   * Update knowledge base
   */
  private updateKnowledgeBase(learningEvent: LearningEvent): void {
    const knowledgeKey = `learning_${learningEvent.event_type}_${learningEvent.context.type}`;

    const existingKnowledge = this.knowledgeBase.get(knowledgeKey) || [];
    existingKnowledge.push({
      timestamp: learningEvent.timestamp,
      outcome: learningEvent.outcome,
      impact: learningEvent.performance_impact,
      learning_data: learningEvent.learning_data,
    });

    this.knowledgeBase.set(knowledgeKey, existingKnowledge);
  }

  /**
   * Store learning cycle summary
   */
  private storeLearningCycleSummary(agentId: string, summary: any): void {
    this.knowledgeBase.set(`learning_cycle_${agentId}_${summary.timestamp}`, summary);
  }

  /**
   * Get learning metrics
   */
  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  /**
   * Get agent learning profile
   */
  getAgentLearningProfile(agentId: string): any {
    const events = this.learningEvents.get(agentId) || [];
    const feedback = this.feedbackData.get(agentId) || [];
    const patterns = Array.from(this.learningPatterns.values())
      .filter(p => p.id.includes(agentId));

    return {
      agent_id: agentId,
      total_events: events.length,
      success_rate: events.length > 0 ? events.filter(e => e.event_type === 'success').length / events.length : 0,
      average_confidence: events.length > 0 ? events.reduce((sum, e) => sum + e.confidence_after, 0) / events.length : 0,
      feedback_count: feedback.length,
      average_feedback_rating: feedback.length > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : 0,
      learned_patterns: patterns.length,
      adaptation_history: Array.from(this.adaptationStrategies.values()),
      knowledge_base_size: this.knowledgeBase.size,
      last_learning_cycle: this.metrics.last_learning_cycle,
    };
  }

  /**
   * Get learning patterns for agent
   */
  getAgentPatterns(agentId: string): LearningPattern[] {
    return Array.from(this.learningPatterns.values())
      .filter(p => p.id.includes(agentId));
  }

  /**
   * Get feedback data for agent
   */
  getAgentFeedback(agentId: string): FeedbackData[] {
    return this.feedbackData.get(agentId) || [];
  }

  /**
   * Hash object for pattern matching
   */
  private hashObject(obj: any): string {
    return JSON.stringify(obj);
  }

  /**
   * Summarize context
   */
  private summarizeContext(context: any): string {
    return JSON.stringify(context).slice(0, 100);
  }

  /**
   * Summarize outcome
   */
  private summarizeOutcome(outcome: any): string {
    return JSON.stringify(outcome).slice(0, 100);
  }

  /**
   * Reset learning system for agent
   */
  resetAgentLearning(agentId: string): void {
    this.learningEvents.delete(agentId);
    this.feedbackData.delete(agentId);

    // Remove agent-specific patterns but keep general patterns
    const patternsToDelete = Array.from(this.learningPatterns.keys())
      .filter(key => key.includes(agentId));

    patternsToDelete.forEach(key => this.learningPatterns.delete(key));
  }

  /**
   * Clear all learning data
   */
  clearAllLearningData(): void {
    this.learningEvents.clear();
    this.feedbackData.clear();
    this.learningPatterns.clear();
    this.adaptationStrategies.clear();
    this.knowledgeBase.clear();

    // Reset metrics
    this.metrics = {
      learning_events_processed: 0,
      adaptation_success_rate: 0.0,
      performance_improvement_rate: 0.0,
      knowledge_base_size: 0,
      pattern_discovery_rate: 0.0,
      feedback_utilization_rate: 0.0,
      last_learning_cycle: new Date(),
      overall_learning_score: 0.0,
    };
  }
}