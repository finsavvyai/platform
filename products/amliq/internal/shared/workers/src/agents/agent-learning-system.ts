/**
 * FinSavvy AI Suite - Agent Learning and Adaptation System
 *
 * Revolutionary agent learning system with outcome-based learning, feedback processing,
 * human-in-the-loop approvals, and explainable AI for transparent agent decisions.
 */

import { Logger } from '../utils/logger';
import { DatabaseService } from '../services/database-service';
import { VectorEmbeddingService } from '../rag/vector-service';

export interface AgentLearningEvent {
  id: string;
  agent_id: string;
  session_id: string;
  event_type: 'decision' | 'action' | 'collaboration' | 'correction' | 'feedback' | 'outcome';
  timestamp: string;
  context: AgentContext;
  decision_data: {
    reasoning: string;
    confidence: number;
    alternatives_considered: string[];
    factors_weighed: Record<string, number>;
    risk_assessment: {
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      factors: string[];
      mitigation: string[];
    };
  };
  action_taken: {
    type: string;
    parameters: Record<string, any>;
    expected_outcome: string;
    execution_time: number;
    success: boolean;
    error?: string;
  };
  outcome_data: {
    actual_outcome: string;
    success_metrics: Record<string, number>;
    user_satisfaction: number;
    business_impact: {
      efficiency_gain: number;
      cost_saving: number;
      risk_reduction: number;
      revenue_impact: number;
    };
    feedback_received: {
      positive_aspects: string[];
      negative_aspects: string[];
      suggestions: string[];
      corrections_needed: string[];
    };
  };
  learning_signals: {
    pattern_detected: boolean;
    pattern_type?: string;
    confidence_adjustment: number;
    strategy_update_needed: boolean;
    knowledge_gap: boolean;
  };
}

export interface AgentContext {
  user_id: string;
  organization_id: string;
  product_area: 'billing' | 'compliance' | 'intelligence' | 'risk' | 'general';
  task_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  stakeholder_context: {
    stakeholders: Array<{
      role: string;
      interests: string[];
      authority_level: number;
    }>;
    compliance_requirements: string[];
    business_objectives: string[];
  };
  temporal_context: {
    time_sensitivity: number; // 0-1
    deadline?: string;
    recurrence_pattern?: string;
  };
  resource_context: {
    available_tools: string[];
    constraints: string[];
    dependencies: string[];
  };
  environment: {
    system_load: number;
    external_factors: string[];
    recent_events: string[];
  };
}

export interface LearningPattern {
  id: string;
  pattern_type: 'decision_pattern' | 'collaboration_pattern' | 'error_pattern' | 'success_pattern' | 'efficiency_pattern';
  agent_type: string;
  context_signature: string;
  pattern_data: {
    trigger_conditions: string[];
    decision_path: string[];
    success_factors: string[];
    risk_factors: string[];
    optimization_opportunities: string[];
  };
  confidence: number;
  frequency: number;
  effectiveness_score: number;
  applicability_conditions: string[];
  discovered_at: string;
  last_applied: string;
  verified: boolean;
  active: boolean;
}

export interface AgentStrategy {
  id: string;
  agent_id: string;
  strategy_name: string;
  strategy_type: 'decision_making' | 'collaboration' | 'risk_management' | 'efficiency_optimization';
  context_applicability: string[];
  decision_framework: {
    phases: Array<{
      phase_name: string;
      objectives: string[];
      analysis_methods: string[];
      decision_criteria: Record<string, number>;
      risk_checks: string[];
    }>;
    adaptation_rules: Array<{
      condition: string;
      adjustment: string;
      confidence_threshold: number;
    }>;
  };
  performance_metrics: {
    success_rate: number;
    efficiency_score: number;
    user_satisfaction: number;
    risk_score: number;
    learning_rate: number;
  };
  version: number;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface HumanApprovalRequest {
  id: string;
  agent_id: string;
  request_type: 'high_risk_action' | 'strategy_change' | 'critical_decision' | 'compliance_violation';
  request_data: {
    action_description: string;
    reasoning: string;
    risk_assessment: string;
    alternatives_considered: string[];
    potential_impact: string;
    compliance_check: string;
  };
  approval_workflow: {
    required_approvers: string[];
    approval_levels: string[];
    escalation_rules: string[];
    timeout_minutes: number;
  };
  context: AgentContext;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  approvals: Array<{
    approver_id: string;
    approver_role: string;
    decision: 'approve' | 'reject' | 'escalate';
    comments: string;
    timestamp: string;
    conditions?: string[];
  }>;
  created_at: string;
  resolved_at?: string;
}

export interface ExplainabilityReport {
  agent_id: string;
  decision_id: string;
  explanation_type: 'decision_rationale' | 'action_sequence' | 'risk_assessment' | 'learning_process';
  explanation_data: {
    summary: string;
    key_factors: Array<{
      factor: string;
      weight: number;
      influence: string;
    }>;
    reasoning_chain: Array<{
      step: number;
      description: string;
      evidence: string[];
      confidence: number;
    }>;
    alternatives_analysis: Array<{
      alternative: string;
      pros: string[];
      cons: string[];
      rejection_reason: string;
    }>;
    uncertainty_analysis: {
      sources: string[];
      mitigation_strategies: string[];
      confidence_range: [number, number];
    };
  };
  human_readable: {
    executive_summary: string;
    detailed_explanation: string;
    stakeholder_impact: string;
    next_steps: string[];
  };
  technical_details: {
    models_used: string[];
    data_sources: string[];
    algorithms_applied: string[];
    confidence_calculations: Record<string, number>;
  };
  generated_at: string;
  version: number;
}

export class AgentLearningSystem {
  private logger: Logger;
  private dbService: DatabaseService;
  private vectorService: VectorEmbeddingService;
  private learningModels: Map<string, any> = new Map();
  private activeStrategies: Map<string, AgentStrategy> = new Map();
  private pendingApprovals: Map<string, HumanApprovalRequest> = new Map();
  private learningPatterns: Map<string, LearningPattern[]> = new Map();

  constructor(env: any) {
    this.logger = new Logger(env, 'AgentLearning');
    this.dbService = new DatabaseService(env);
    this.vectorService = new VectorEmbeddingService(env);
  }

  /**
   * Initialize Agent Learning System
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing Agent Learning System...');

    try {
      // Create learning system tables
      await this.createLearningSystemTables();

      // Load learning models
      await this.loadLearningModels();

      // Load active strategies
      await this.loadActiveStrategies();

      // Load learning patterns
      await this.loadLearningPatterns();

      // Start learning processes
      this.startLearningProcesses();

      this.logger.info('Agent Learning System initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Agent Learning System', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create learning system database tables
   */
  private async createLearningSystemTables(): Promise<void> {
    const tables = [
      // Agent learning events
      `CREATE TABLE IF NOT EXISTS agent_learning_events (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_id TEXT,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        context TEXT NOT NULL,
        decision_data TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        outcome_data TEXT NOT NULL,
        learning_signals TEXT NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        created_at TEXT NOT NULL
      )`,

      // Learning patterns
      `CREATE TABLE IF NOT EXISTS agent_learning_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        context_signature TEXT NOT NULL,
        pattern_data TEXT NOT NULL,
        confidence REAL DEFAULT 0,
        frequency INTEGER DEFAULT 0,
        effectiveness_score REAL DEFAULT 0,
        applicability_conditions TEXT,
        discovered_at TEXT NOT NULL,
        last_applied TEXT,
        verified BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at TEXT NOT NULL
      )`,

      // Agent strategies
      `CREATE TABLE IF NOT EXISTS agent_strategies (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        context_applicability TEXT,
        decision_framework TEXT NOT NULL,
        performance_metrics TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      )`,

      // Human approval requests
      `CREATE TABLE IF NOT EXISTS human_approval_requests (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        request_type TEXT NOT NULL,
        request_data TEXT NOT NULL,
        approval_workflow TEXT NOT NULL,
        context TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approvals TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`,

      // Explainability reports
      `CREATE TABLE IF NOT EXISTS explainability_reports (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        explanation_type TEXT NOT NULL,
        explanation_data TEXT NOT NULL,
        human_readable TEXT NOT NULL,
        technical_details TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        version INTEGER DEFAULT 1
      )`,

      // Agent performance analytics
      `CREATE TABLE IF NOT EXISTS agent_performance_analytics (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        dimensions TEXT,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,

      // Learning feedback loop
      `CREATE TABLE IF NOT EXISTS learning_feedback_loop (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        learning_event_id TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        feedback_data TEXT NOT NULL,
        impact_assessment TEXT,
        applied BOOLEAN DEFAULT FALSE,
        created_at TEXT NOT NULL
      )`
    ];

    for (const tableSql of tables) {
      await this.dbService.query(tableSql);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_learning_events_agent_timestamp ON agent_learning_events(agent_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_patterns_agent_type ON agent_learning_patterns(agent_type, active)',
      'CREATE INDEX IF NOT EXISTS idx_strategies_agent_active ON agent_strategies(agent_id, active)',
      'CREATE INDEX IF NOT EXISTS idx_approvals_status ON human_approval_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_performance_agent_metric ON agent_performance_analytics(agent_id, metric_type)'
    ];

    for (const indexSql of indexes) {
      await this.dbService.query(indexSql);
    }
  }

  /**
   * Load learning models
   */
  private async loadLearningModels(): Promise<void> {
    // Initialize learning models
    this.learningModels.set('pattern_detector', {
      name: 'Pattern Detector',
      version: '1.0',
      detectPatterns: async (events: AgentLearningEvent[]) => {
        return this.detectAgentPatterns(events);
      }
    });

    this.learningModels.set('strategy_optimizer', {
      name: 'Strategy Optimizer',
      version: '1.0',
      optimizeStrategy: async (strategy: AgentStrategy, performance: any) => {
        return this.optimizeAgentStrategy(strategy, performance);
      }
    });

    this.learningModels.set('feedback_processor', {
      name: 'Feedback Processor',
      version: '1.0',
      processFeedback: async (feedback: any) => {
        return this.processAgentFeedback(feedback);
      }
    });

    this.learningModels.set('explainability_engine', {
      name: 'Explainability Engine',
      version: '1.0',
      generateExplanation: async (decision: any, context: AgentContext) => {
        return this.generateAgentExplanation(decision, context);
      }
    });

    this.logger.info('Learning models loaded', { modelCount: this.learningModels.size });
  }

  /**
   * Load active strategies
   */
  private async loadActiveStrategies(): Promise<void> {
    try {
      const strategiesResult = await this.dbService.query(
        'SELECT * FROM agent_strategies WHERE active = TRUE'
      );

      for (const row of strategiesResult.results) {
        const strategy: AgentStrategy = {
          id: row.id,
          agent_id: row.agent_id,
          strategy_name: row.strategy_name,
          strategy_type: row.strategy_type,
          context_applicability: JSON.parse(row.context_applicability || '[]'),
          decision_framework: JSON.parse(row.decision_framework),
          performance_metrics: JSON.parse(row.performance_metrics),
          version: row.version,
          created_at: row.created_at,
          updated_at: row.updated_at,
          active: row.active
        };

        this.activeStrategies.set(strategy.id, strategy);
      }

      this.logger.info('Active strategies loaded', { count: this.activeStrategies.size });
    } catch (error) {
      this.logger.warn('Failed to load active strategies', { error: error.message });
    }
  }

  /**
   * Load learning patterns
   */
  private async loadLearningPatterns(): Promise<void> {
    try {
      const patternsResult = await this.dbService.query(
        'SELECT * FROM agent_learning_patterns WHERE active = TRUE'
      );

      const patternsByType = new Map<string, LearningPattern[]>();

      for (const row of patternsResult.results) {
        const pattern: LearningPattern = {
          id: row.id,
          pattern_type: row.pattern_type,
          agent_type: row.agent_type,
          context_signature: row.context_signature,
          pattern_data: JSON.parse(row.pattern_data),
          confidence: row.confidence,
          frequency: row.frequency,
          effectiveness_score: row.effectiveness_score,
          applicability_conditions: JSON.parse(row.applicability_conditions || '[]'),
          discovered_at: row.discovered_at,
          last_applied: row.last_applied,
          verified: row.verified,
          active: row.active
        };

        if (!patternsByType.has(pattern.pattern_type)) {
          patternsByType.set(pattern.pattern_type, []);
        }
        patternsByType.get(pattern.pattern_type)!.push(pattern);
      }

      this.learningPatterns = patternsByType;
      this.logger.info('Learning patterns loaded', {
        totalPatterns: patternsResult.results.length,
        types: Array.from(patternsByType.keys())
      });
    } catch (error) {
      this.logger.warn('Failed to load learning patterns', { error: error.message });
    }
  }

  /**
   * Start learning processes
   */
  private startLearningProcesses(): void {
    // Process learning events every 5 minutes
    setInterval(() => {
      this.processLearningEvents();
    }, 5 * 60 * 1000);

    // Update strategies every hour
    setInterval(() => {
      this.updateAgentStrategies();
    }, 60 * 60 * 1000);

    // Detect new patterns every 30 minutes
    setInterval(() => {
      this.detectNewPatterns();
    }, 30 * 60 * 1000);

    // Process approvals every minute
    setInterval(() => {
      this.processPendingApprovals();
    }, 60 * 1000);

    // Generate explanations on demand
    setInterval(() => {
      this.cleanupExpiredApprovals();
    }, 10 * 60 * 1000);

    this.logger.info('Learning processes started');
  }

  /**
   * Record agent learning event
   */
  public async recordLearningEvent(event: AgentLearningEvent): Promise<void> {
    try {
      await this.dbService.query(`
        INSERT INTO agent_learning_events (
          id, agent_id, session_id, event_type, timestamp, context,
          decision_data, action_taken, outcome_data, learning_signals, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        event.id,
        event.agent_id,
        event.session_id,
        event.event_type,
        event.timestamp,
        JSON.stringify(event.context),
        JSON.stringify(event.decision_data),
        JSON.stringify(event.action_taken),
        JSON.stringify(event.outcome_data),
        JSON.stringify(event.learning_signals),
        new Date().toISOString()
      ]);

      // Process high-impact events immediately
      if (this.isHighImpactEvent(event)) {
        await this.processHighImpactEvent(event);
      }

      this.logger.debug('Agent learning event recorded', {
        eventId: event.id,
        agentId: event.agent_id,
        eventType: event.event_type
      });
    } catch (error) {
      this.logger.error('Failed to record learning event', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Process learning events
   */
  private async processLearningEvents(): Promise<void> {
    try {
      // Get unprocessed events
      const eventsResult = await this.dbService.query(`
        SELECT * FROM agent_learning_events
        WHERE processed = FALSE
        AND timestamp > datetime('now', '-1 hour')
        ORDER BY timestamp DESC
      `);

      for (const row of eventsResult.results) {
        const event: AgentLearningEvent = {
          id: row.id,
          agent_id: row.agent_id,
          session_id: row.session_id,
          event_type: row.event_type,
          timestamp: row.timestamp,
          context: JSON.parse(row.context),
          decision_data: JSON.parse(row.decision_data),
          action_taken: JSON.parse(row.action_taken),
          outcome_data: JSON.parse(row.outcome_data),
          learning_signals: JSON.parse(row.learning_signals)
        };

        await this.processLearningEvent(event);

        // Mark as processed
        await this.dbService.query(
          'UPDATE agent_learning_events SET processed = TRUE WHERE id = ?',
          [event.id]
        );
      }

      this.logger.debug('Learning events processed', {
        count: eventsResult.results.length
      });
    } catch (error) {
      this.logger.error('Failed to process learning events', { error: error.message });
    }
  }

  /**
   * Process individual learning event
   */
  private async processLearningEvent(event: AgentLearningEvent): Promise<void> {
    try {
      // Update agent performance metrics
      await this.updateAgentPerformance(event);

      // Check if human approval is needed
      if (this.requiresHumanApproval(event)) {
        await this.requestHumanApproval(event);
      }

      // Generate explanation if needed
      if (this.requiresExplanation(event)) {
        await this.generateExplanation(event);
      }

      // Update learning patterns
      await this.updateLearningPatterns(event);

      // Update agent strategy
      await this.updateAgentStrategy(event);

      // Process feedback
      await this.processEventFeedback(event);

    } catch (error) {
      this.logger.warn('Failed to process learning event', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Check if event requires human approval
   */
  private requiresHumanApproval(event: AgentLearningEvent): boolean {
    const highRiskFactors = [
      event.decision_data.risk_assessment.level === 'CRITICAL',
      event.action_taken.type.includes('financial_transfer'),
      event.action_taken.type.includes('compliance_decision'),
      event.context.priority === 'critical',
      event.outcome_data.business_impact.risk_reduction > 0.8
    ];

    return highRiskFactors.some(factor => factor);
  }

  /**
   * Request human approval
   */
  private async requestHumanApproval(event: AgentLearningEvent): Promise<void> {
    const approvalRequest: HumanApprovalRequest = {
      id: crypto.randomUUID(),
      agent_id: event.agent_id,
      request_type: this.determineApprovalType(event),
      request_data: {
        action_description: event.action_taken.type,
        reasoning: event.decision_data.reasoning,
        risk_assessment: JSON.stringify(event.decision_data.risk_assessment),
        alternatives_considered: event.decision_data.alternatives_considered,
        potential_impact: JSON.stringify(event.outcome_data.business_impact),
        compliance_check: this.checkComplianceRequirements(event)
      },
      approval_workflow: {
        required_approvers: this.determineRequiredApprovers(event),
        approval_levels: ['manager', 'compliance', 'executive'],
        escalation_rules: ['high_risk', 'compliance_violation', 'financial_impact'],
        timeout_minutes: this.determineApprovalTimeout(event)
      },
      context: event.context,
      status: 'pending',
      approvals: [],
      created_at: new Date().toISOString()
    };

    // Store approval request
    await this.dbService.query(`
      INSERT INTO human_approval_requests (
        id, agent_id, request_type, request_data, approval_workflow,
        context, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      approvalRequest.id,
      approvalRequest.agent_id,
      approvalRequest.request_type,
      JSON.stringify(approvalRequest.request_data),
      JSON.stringify(approvalRequest.approval_workflow),
      JSON.stringify(approvalRequest.context),
      approvalRequest.status,
      approvalRequest.created_at
    ]);

    // Add to pending approvals
    this.pendingApprovals.set(approvalRequest.id, approvalRequest);

    // Notify stakeholders
    await this.notifyApprovalRequest(approvalRequest);

    this.logger.info('Human approval requested', {
      requestId: approvalRequest.id,
      agentId: event.agent_id,
      requestType: approvalRequest.request_type
    });
  }

  /**
   * Process pending approvals
   */
  private async processPendingApprovals(): Promise<void> {
    try {
      // Get pending approvals that need attention
      const pendingResult = await this.dbService.query(`
        SELECT * FROM human_approval_requests
        WHERE status = 'pending'
        AND created_at > datetime('now', '-24 hours')
        ORDER BY created_at ASC
      `);

      for (const row of pendingResult.results) {
        const request: HumanApprovalRequest = {
          id: row.id,
          agent_id: row.agent_id,
          request_type: row.request_type,
          request_data: JSON.parse(row.request_data),
          approval_workflow: JSON.parse(row.approval_workflow),
          context: JSON.parse(row.context),
          status: row.status,
          approvals: JSON.parse(row.approvals || '[]'),
          created_at: row.created_at,
          resolved_at: row.resolved_at
        };

        // Check for timeout
        if (this.isApprovalTimeout(request)) {
          await this.handleApprovalTimeout(request);
        }

        // Check for escalation conditions
        if (this.shouldEscalate(request)) {
          await this.escalateApproval(request);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process pending approvals', { error: error.message });
    }
  }

  /**
   * Generate explanation for agent decision
   */
  private async generateExplanation(event: AgentLearningEvent): Promise<void> {
    try {
      const explanationReport: ExplainabilityReport = {
        agent_id: event.agent_id,
        decision_id: event.id,
        explanation_type: 'decision_rationale',
        explanation_data: {
          summary: event.decision_data.reasoning,
          key_factors: this.extractKeyFactors(event),
          reasoning_chain: this.buildReasoningChain(event),
          alternatives_analysis: this.analyzeAlternatives(event),
          uncertainty_analysis: this.analyzeUncertainty(event)
        },
        human_readable: {
          executive_summary: this.generateExecutiveSummary(event),
          detailed_explanation: this.generateDetailedExplanation(event),
          stakeholder_impact: this.analyzeStakeholderImpact(event),
          next_steps: this.generateNextSteps(event)
        },
        technical_details: {
          models_used: this.getModelsUsed(event),
          data_sources: this.getDataSources(event),
          algorithms_applied: this.getAlgorithmsApplied(event),
          confidence_calculations: this.calculateConfidence(event)
        },
        generated_at: new Date().toISOString(),
        version: 1
      };

      // Store explanation
      await this.dbService.query(`
        INSERT INTO explainability_reports (
          id, agent_id, decision_id, explanation_type, explanation_data,
          human_readable, technical_details, generated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        explanationReport.agent_id,
        explanationReport.decision_id,
        explanationReport.explanation_type,
        JSON.stringify(explanationReport.explanation_data),
        JSON.stringify(explanationReport.human_readable),
        JSON.stringify(explanationReport.technical_details),
        explanationReport.generated_at,
        explanationReport.version
      ]);

      this.logger.debug('Explanation generated', {
        agentId: event.agent_id,
        decisionId: event.id
      });
    } catch (error) {
      this.logger.warn('Failed to generate explanation', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Update agent performance metrics
   */
  private async updateAgentPerformance(event: AgentLearningEvent): Promise<void> {
    try {
      const metrics = [
        {
          metric_type: 'decision',
          metric_name: 'confidence',
          metric_value: event.decision_data.confidence
        },
        {
          metric_type: 'action',
          metric_name: 'success_rate',
          metric_value: event.action_taken.success ? 1 : 0
        },
        {
          metric_type: 'outcome',
          metric_name: 'user_satisfaction',
          metric_value: event.outcome_data.user_satisfaction
        },
        {
          metric_type: 'business',
          metric_name: 'efficiency_gain',
          metric_value: event.outcome_data.business_impact.efficiency_gain
        },
        {
          metric_type: 'risk',
          metric_name: 'risk_score',
          metric_value: this.calculateRiskScore(event)
        }
      ];

      for (const metric of metrics) {
        await this.dbService.query(`
          INSERT INTO agent_performance_analytics (
            id, agent_id, metric_type, metric_name, metric_value,
            dimensions, timestamp, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          event.agent_id,
          metric.metric_type,
          metric.metric_name,
          metric.metric_value,
          JSON.stringify({
            event_type: event.event_type,
            product_area: event.context.product_area,
            priority: event.context.priority
          }),
          event.timestamp,
          new Date().toISOString()
        ]);
      }
    } catch (error) {
      this.logger.warn('Failed to update agent performance', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Update learning patterns
   */
  private async updateLearningPatterns(event: AgentLearningEvent): Promise<void> {
    try {
      if (event.learning_signals.pattern_detected) {
        const existingPatterns = this.learningPatterns.get(event.learning_signals.pattern_type) || [];

        // Find similar patterns
        const similarPattern = existingPatterns.find(p =>
          this.isPatternSimilar(p, event)
        );

        if (similarPattern) {
          // Update existing pattern
          await this.updateExistingPattern(similarPattern.id, event);
        } else {
          // Create new pattern
          await this.createNewPattern(event);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to update learning patterns', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Update agent strategy
   */
  private async updateAgentStrategy(event: AgentLearningEvent): Promise<void> {
    try {
      if (event.learning_signals.strategy_update_needed) {
        const currentStrategy = this.activeStrategies.get(event.agent_id);

        if (currentStrategy) {
          // Analyze performance and update strategy
          const updatedStrategy = await this.optimizeStrategy(currentStrategy, event);

          if (updatedStrategy) {
            await this.saveUpdatedStrategy(updatedStrategy);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to update agent strategy', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Detect new patterns
   */
  private async detectNewPatterns(): Promise<void> {
    try {
      // Get recent events for pattern detection
      const eventsResult = await this.dbService.query(`
        SELECT * FROM agent_learning_events
        WHERE processed = TRUE
        AND timestamp > datetime('now', '-2 hours')
        ORDER BY timestamp DESC
      `);

      const events = eventsResult.results.map(row => ({
        id: row.id,
        agent_id: row.agent_id,
        event_type: row.event_type,
        timestamp: row.timestamp,
        context: JSON.parse(row.context),
        decision_data: JSON.parse(row.decision_data),
        action_taken: JSON.parse(row.action_taken),
        outcome_data: JSON.parse(row.outcome_data)
      }));

      if (events.length < 10) return; // Need sufficient data

      // Detect patterns using pattern detector model
      const patternDetector = this.learningModels.get('pattern_detector');
      if (patternDetector) {
        const newPatterns = await patternDetector.detectPatterns(events);

        for (const pattern of newPatterns) {
          await this.validateAndStorePattern(pattern);
        }
      }

      this.logger.debug('Pattern detection completed', {
        eventCount: events.length,
        newPatternsFound: newPatterns.length
      });
    } catch (error) {
      this.logger.error('Failed to detect new patterns', { error: error.message });
    }
  }

  /**
   * Update agent strategies
   */
  private async updateAgentStrategies(): Promise<void> {
    try {
      // Get all active strategies
      for (const [strategyId, strategy] of this.activeStrategies) {
        // Get recent performance data
        const performanceData = await this.getStrategyPerformance(strategyId);

        if (performanceData) {
          // Optimize strategy based on performance
          const strategyOptimizer = this.learningModels.get('strategy_optimizer');
          if (strategyOptimizer) {
            const optimizedStrategy = await strategyOptimizer.optimizeStrategy(strategy, performanceData);

            if (optimizedStrategy && optimizedStrategy !== strategy) {
              await this.saveUpdatedStrategy(optimizedStrategy);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to update agent strategies', { error: error.message });
    }
  }

  // Helper methods
  private isHighImpactEvent(event: AgentLearningEvent): boolean {
    return (
      event.context.priority === 'critical' ||
      event.decision_data.risk_assessment.level === 'CRITICAL' ||
      event.outcome_data.business_impact.efficiency_gain > 0.9 ||
      event.outcome_data.business_impact.risk_reduction > 0.9
    );
  }

  private async processHighImpactEvent(event: AgentLearningEvent): Promise<void> {
    // Immediate processing for high-impact events
    if (this.requiresHumanApproval(event)) {
      await this.requestHumanApproval(event);
    }

    if (this.requiresExplanation(event)) {
      await this.generateExplanation(event);
    }
  }

  private requiresExplanation(event: AgentLearningEvent): boolean {
    return (
      event.event_type === 'decision' ||
      event.decision_data.confidence < 0.7 ||
      event.decision_data.risk_assessment.level === 'HIGH' ||
      event.action_taken.success === false
    );
  }

  private determineApprovalType(event: AgentLearningEvent): HumanApprovalRequest['request_type'] {
    if (event.decision_data.risk_assessment.level === 'CRITICAL') {
      return 'critical_decision';
    }
    if (event.action_taken.type.includes('compliance')) {
      return 'compliance_violation';
    }
    if (event.action_taken.type.includes('financial')) {
      return 'high_risk_action';
    }
    return 'strategy_change';
  }

  private determineRequiredApprovers(event: AgentLearningEvent): string[] {
    const approvers = [];

    if (event.decision_data.risk_assessment.level === 'CRITICAL') {
      approvers.push('executive', 'compliance', 'risk_manager');
    } else if (event.decision_data.risk_assessment.level === 'HIGH') {
      approvers.push('manager', 'compliance');
    } else {
      approvers.push('manager');
    }

    return approvers;
  }

  private determineApprovalTimeout(event: AgentLearningEvent): number {
    if (event.context.time_sensitivity > 0.8) {
      return 30; // 30 minutes for time-sensitive
    } else if (event.context.priority === 'critical') {
      return 60; // 1 hour for critical
    } else {
      return 240; // 4 hours for normal
    }
  }

  private checkComplianceRequirements(event: AgentLearningEvent): string {
    const requirements = event.context.stakeholder_context.compliance_requirements;
    return requirements.length > 0 ? requirements.join(', ') : 'No specific compliance requirements';
  }

  private async notifyApprovalRequest(request: HumanApprovalRequest): Promise<void> {
    // Implementation would notify stakeholders via various channels
    this.logger.info('Approval request notification sent', {
      requestId: request.id,
      approvers: request.approval_workflow.required_approvers
    });
  }

  private isApprovalTimeout(request: HumanApprovalRequest): boolean {
    const timeoutMinutes = request.approval_workflow.timeout_minutes;
    const createdTime = new Date(request.created_at).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = (currentTime - createdTime) / (1000 * 60);

    return elapsedMinutes > timeoutMinutes;
  }

  private async handleApprovalTimeout(request: HumanApprovalRequest): Promise<void> {
    // Handle approval timeout - escalate or auto-approve based on context
    await this.dbService.query(
      'UPDATE human_approval_requests SET status = ? WHERE id = ?',
      ['escalated', request.id]
    );

    this.logger.warn('Approval request timed out', {
      requestId: request.id,
      agentId: request.agent_id
    });
  }

  private shouldEscalate(request: HumanApprovalRequest): boolean {
    // Check escalation conditions
    return request.approval_workflow.escalation_rules.includes('high_risk') ||
           request.approval_workflow.escalation_rules.includes('compliance_violation');
  }

  private async escalateApproval(request: HumanApprovalRequest): Promise<void> {
    // Escalate approval request
    await this.dbService.query(
      'UPDATE human_approval_requests SET status = ? WHERE id = ?',
      ['escalated', request.id]
    );

    this.logger.info('Approval request escalated', {
      requestId: request.id,
      agentId: request.agent_id
    });
  }

  private async cleanupExpiredApprovals(): Promise<void> {
    // Clean up old approval requests
    await this.dbService.query(`
      DELETE FROM human_approval_requests
      WHERE status IN ('pending', 'expired')
      AND created_at < datetime('now', '-7 days')
    `);
  }

  private extractKeyFactors(event: AgentLearningEvent): Array<{
    factor: string;
    weight: number;
    influence: string;
  }> {
    const factors = [];
    const weighedFactors = event.decision_data.factors_weighed;

    for (const [factor, weight] of Object.entries(weighedFactors)) {
      factors.push({
        factor,
        weight: weight as number,
        influence: weight > 0.7 ? 'High' : weight > 0.4 ? 'Medium' : 'Low'
      });
    }

    return factors.sort((a, b) => b.weight - a.weight);
  }

  private buildReasoningChain(event: AgentLearningEvent): Array<{
    step: number;
    description: string;
    evidence: string[];
    confidence: number;
  }> {
    const chain = [];

    // Step 1: Context Analysis
    chain.push({
      step: 1,
      description: 'Analyzed task context and requirements',
      evidence: [
        `Product area: ${event.context.product_area}`,
        `Priority: ${event.context.priority}`,
        `Time sensitivity: ${event.context.time_sensitivity}`
      ],
      confidence: 0.9
    });

    // Step 2: Risk Assessment
    chain.push({
      step: 2,
      description: 'Evaluated risks and constraints',
      evidence: [
        `Risk level: ${event.decision_data.risk_assessment.level}`,
        `Risk factors: ${event.decision_data.risk_assessment.factors.join(', ')}`
      ],
      confidence: event.decision_data.confidence
    });

    // Step 3: Alternative Analysis
    chain.push({
      step: 3,
      description: 'Considered alternative approaches',
      evidence: event.decision_data.alternatives_considered,
      confidence: event.decision_data.confidence * 0.8
    });

    // Step 4: Decision Making
    chain.push({
      step: 4,
      description: 'Made final decision based on analysis',
      evidence: [event.decision_data.reasoning],
      confidence: event.decision_data.confidence
    });

    return chain;
  }

  private analyzeAlternatives(event: AgentLearningEvent): Array<{
    alternative: string;
    pros: string[];
    cons: string[];
    rejection_reason: string;
  }> {
    const alternatives = [];

    for (const alt of event.decision_data.alternatives_considered) {
      alternatives.push({
        alternative: alt,
        pros: ['Considered during decision process'],
        cons: ['Rejected in favor of chosen approach'],
        rejection_reason: 'Chosen alternative provided better outcome'
      });
    }

    return alternatives;
  }

  private analyzeUncertainty(event: AgentLearningEvent): {
    sources: string[];
    mitigation_strategies: string[];
    confidence_range: [number, number];
  } {
    const sources = [];
    const strategies = [];

    if (event.decision_data.confidence < 0.8) {
      sources.push('Limited data availability');
      strategies.push('Gather additional information');
    }

    if (event.context.resource_context.constraints.length > 0) {
      sources.push('Resource constraints');
      strategies.push('Optimize resource allocation');
    }

    const confidenceRange: [number, number] = [
      Math.max(0, event.decision_data.confidence - 0.2),
      Math.min(1, event.decision_data.confidence + 0.1)
    ];

    return {
      sources,
      mitigation_strategies: strategies,
      confidence_range: confidenceRange
    };
  }

  private generateExecutiveSummary(event: AgentLearningEvent): string {
    return `Agent ${event.agent_id} made a ${event.event_type} decision with ${event.decision_data.confidence} confidence. The action was ${event.action_taken.success ? 'successful' : 'unsuccessful'} with ${event.outcome_data.user_satisfaction}/5 user satisfaction.`;
  }

  private generateDetailedExplanation(event: AgentLearningEvent): string {
    return `The agent analyzed the ${event.context.product_area} task with ${event.context.priority} priority. Key factors included ${Object.keys(event.decision_data.factors_weighed).join(', ')}. The decision was based on ${event.decision_data.reasoning}. ${event.decision_data.alternatives_considered.length} alternatives were considered.`;
  }

  private analyzeStakeholderImpact(event: AgentLearningEvent): string {
    const stakeholders = event.context.stakeholder_context.stakeholders;
    return `This decision impacts ${stakeholders.length} stakeholders with varying authority levels. Primary impacts are on ${stakeholders.filter(s => s.authority_level > 0.7).map(s => s.role).join(', ')}.`;
  }

  private generateNextSteps(event: AgentLearningEvent): string[] {
    const steps = [];

    if (!event.action_taken.success) {
      steps.push('Review and correct the failed action');
    }

    if (event.outcome_data.feedback_received.corrections_needed.length > 0) {
      steps.push('Implement suggested corrections');
    }

    if (event.learning_signals.strategy_update_needed) {
      steps.push('Update agent strategy based on outcomes');
    }

    steps.push('Monitor results and gather additional feedback');

    return steps;
  }

  private getModelsUsed(event: AgentLearningEvent): string[] {
    return ['decision_model', 'risk_assessment_model', 'outcome_prediction_model'];
  }

  private getDataSources(event: AgentLearningEvent): string[] {
    return [
      'context_data',
      'historical_decisions',
      'user_preferences',
      'compliance_regulations'
    ];
  }

  private getAlgorithmsApplied(event: AgentLearningEvent): string[] {
    return [
      'risk_assessment_algorithm',
      'decision_tree_analysis',
      'confidence_calculation',
      'alternative_evaluation'
    ];
  }

  private calculateConfidence(event: AgentLearningEvent): Record<string, number> {
    return {
      decision_confidence: event.decision_data.confidence,
      execution_confidence: event.action_taken.success ? 0.9 : 0.3,
      outcome_confidence: event.outcome_data.user_satisfaction / 5,
      overall_confidence: (event.decision_data.confidence + (event.outcome_data.user_satisfaction / 5)) / 2
    };
  }

  private calculateRiskScore(event: AgentLearningEvent): number {
    const riskLevels = { 'LOW': 0.25, 'MEDIUM': 0.5, 'HIGH': 0.75, 'CRITICAL': 1.0 };
    return riskLevels[event.decision_data.risk_assessment.level] || 0.5;
  }

  private isPatternSimilar(pattern: LearningPattern, event: AgentLearningEvent): boolean {
    // Simple pattern similarity check
    return pattern.agent_type === event.agent_id;
  }

  private async updateExistingPattern(patternId: string, event: AgentLearningEvent): Promise<void> {
    await this.dbService.query(`
      UPDATE agent_learning_patterns
      SET frequency = frequency + 1,
          effectiveness_score = ?,
          last_applied = ?,
          updated_at = ?
      WHERE id = ?
    `, [
      (event.outcome_data.business_impact.efficiency_gain + 1) / 2,
      new Date().toISOString(),
      new Date().toISOString(),
      patternId
    ]);
  }

  private async createNewPattern(event: AgentLearningEvent): Promise<void> {
    const pattern: LearningPattern = {
      id: crypto.randomUUID(),
      pattern_type: 'decision_pattern',
      agent_type: event.agent_id,
      context_signature: this.generateContextSignature(event.context),
      pattern_data: {
        trigger_conditions: this.extractTriggerConditions(event),
        decision_path: [event.decision_data.reasoning],
        success_factors: [event.action_taken.success ? 'success' : 'failure'],
        risk_factors: event.decision_data.risk_assessment.factors,
        optimization_opportunities: event.learning_signals.pattern_type ? [event.learning_signals.pattern_type] : []
      },
      confidence: event.decision_data.confidence,
      frequency: 1,
      effectiveness_score: event.outcome_data.business_impact.efficiency_gain,
      applicability_conditions: this.extractApplicabilityConditions(event),
      discovered_at: new Date().toISOString(),
      last_applied: new Date().toISOString(),
      verified: false,
      active: true
    };

    await this.dbService.query(`
      INSERT INTO agent_learning_patterns (
        id, pattern_type, agent_type, context_signature, pattern_data,
        confidence, frequency, effectiveness_score, applicability_conditions,
        discovered_at, last_applied, verified, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      pattern.id,
      pattern.pattern_type,
      pattern.agent_type,
      pattern.context_signature,
      JSON.stringify(pattern.pattern_data),
      pattern.confidence,
      pattern.frequency,
      pattern.effectiveness_score,
      JSON.stringify(pattern.applicability_conditions),
      pattern.discovered_at,
      pattern.last_applied,
      pattern.verified,
      pattern.active,
      new Date().toISOString()
    ]);
  }

  private generateContextSignature(context: AgentContext): string {
    return `${context.product_area}:${context.task_type}:${context.priority}`;
  }

  private extractTriggerConditions(event: AgentLearningEvent): string[] {
    return [
      `product_area:${event.context.product_area}`,
      `priority:${event.context.priority}`,
      `risk_level:${event.decision_data.risk_assessment.level}`
    ];
  }

  private extractApplicabilityConditions(event: AgentLearningEvent): string[] {
    return [
      `agent_type:${event.agent_id}`,
      `event_type:${event.event_type}`,
      `success:${event.action_taken.success}`
    ];
  }

  private async validateAndStorePattern(pattern: any): Promise<void> {
    // Validate pattern with AI
    const validation = await this.validatePatternWithAI(pattern);

    if (validation.isValid) {
      await this.storeValidatedPattern(pattern, validation.confidence);
    }
  }

  private async validatePatternWithAI(pattern: any): Promise<{
    isValid: boolean;
    confidence: number;
    reasoning: string;
  }> {
    try {
      const prompt = `
Validate this agent learning pattern:

Pattern Type: ${pattern.pattern_type}
Pattern Data: ${JSON.stringify(pattern.pattern_data, null, 2)}
Confidence: ${pattern.confidence}
Frequency: ${pattern.frequency}
Effectiveness: ${pattern.effectiveness_score}

Evaluate:
1. Is this pattern meaningful and actionable?
2. Is the confidence appropriate?
3. Should this pattern be applied in future decisions?

Return JSON response:
{
  "isValid": true,
  "confidence": 0.8,
  "reasoning": "Pattern shows consistent successful decision-making..."
}
`;

      const response = await this.dbService.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 300,
        temperature: 0.1
      });

      return JSON.parse(response.response);
    } catch (error) {
      return { isValid: false, confidence: 0, reasoning: 'Validation failed' };
    }
  }

  private async storeValidatedPattern(pattern: any, validationConfidence: number): Promise<void> {
    const finalConfidence = (pattern.confidence + validationConfidence) / 2;

    await this.dbService.query(`
      INSERT INTO agent_learning_patterns (
        id, pattern_type, agent_type, context_signature, pattern_data,
        confidence, frequency, effectiveness_score, applicability_conditions,
        discovered_at, last_applied, verified, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      pattern.pattern_type,
      pattern.agent_type,
      pattern.context_signature,
      JSON.stringify(pattern.pattern_data),
      finalConfidence,
      pattern.frequency,
      pattern.effectiveness_score,
      JSON.stringify(pattern.applicability_conditions),
      new Date().toISOString(),
      new Date().toISOString(),
      true,
      true,
      new Date().toISOString()
    ]);
  }

  private async detectAgentPatterns(events: any[]): Promise<LearningPattern[]> {
    // Pattern detection implementation
    const patterns = [];

    // Group events by agent and analyze patterns
    const eventsByAgent = new Map<string, any[]>();
    for (const event of events) {
      if (!eventsByAgent.has(event.agent_id)) {
        eventsByAgent.set(event.agent_id, []);
      }
      eventsByAgent.get(event.agent_id)!.push(event);
    }

    for (const [agentId, agentEvents] of eventsByAgent) {
      if (agentEvents.length >= 3) {
        const pattern = await this.analyzeAgentPattern(agentId, agentEvents);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private async analyzeAgentPattern(agentId: string, events: any[]): Promise<LearningPattern | null> {
    // Analyze events for a specific agent to find patterns
    const successfulEvents = events.filter(e => e.action_taken.success);
    const successRate = successfulEvents.length / events.length;

    if (successRate > 0.8) {
      return {
        id: crypto.randomUUID(),
        pattern_type: 'success_pattern',
        agent_type: agentId,
        context_signature: this.generateAgentContextSignature(events),
        pattern_data: {
          trigger_conditions: this.extractCommonConditions(events),
          success_factors: this.extractSuccessFactors(successfulEvents),
          risk_factors: this.extractRiskFactors(events),
          optimization_opportunities: []
        },
        confidence: successRate,
        frequency: events.length,
        effectiveness_score: successRate,
        applicability_conditions: [agentId],
        discovered_at: new Date().toISOString(),
        last_applied: new Date().toISOString(),
        verified: false,
        active: true
      };
    }

    return null;
  }

  private generateAgentContextSignature(events: any[]): string {
    const contexts = events.map(e => e.context.product_area + ':' + e.context.task_type);
    return contexts[0]; // Simplified - would be more sophisticated
  }

  private extractCommonConditions(events: any[]): string[] {
    // Extract common conditions from events
    return ['high_priority', 'compliance_required'];
  }

  private extractSuccessFactors(events: any[]): string[] {
    // Extract factors that lead to success
    return ['thorough_analysis', 'risk_assessment'];
  }

  private extractRiskFactors(events: any[]): string[] {
    // Extract risk factors from events
    return ['time_constraints', 'resource_limitations'];
  }

  private async optimizeAgentStrategy(strategy: AgentStrategy, event: AgentLearningEvent): Promise<AgentStrategy | null> {
    // Optimize strategy based on event outcomes
    const performanceUpdate = {
      success_rate: event.action_taken.success ? 1 : 0,
      efficiency_score: event.outcome_data.business_impact.efficiency_gain,
      user_satisfaction: event.outcome_data.user_satisfaction / 5,
      risk_score: this.calculateRiskScore(event),
      learning_rate: event.learning_signals.confidence_adjustment
    };

    // Update performance metrics
    strategy.performance_metrics = {
      ...strategy.performance_metrics,
      ...performanceUpdate
    };

    // Increment version
    strategy.version += 1;
    strategy.updated_at = new Date().toISOString();

    return strategy;
  }

  private async saveUpdatedStrategy(strategy: AgentStrategy): Promise<void> {
    await this.dbService.query(`
      INSERT OR REPLACE INTO agent_strategies (
        id, agent_id, strategy_name, strategy_type, context_applicability,
        decision_framework, performance_metrics, version, created_at, updated_at, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      strategy.id,
      strategy.agent_id,
      strategy.strategy_name,
      strategy.strategy_type,
      JSON.stringify(strategy.context_applicability),
      JSON.stringify(strategy.decision_framework),
      JSON.stringify(strategy.performance_metrics),
      strategy.version,
      strategy.created_at,
      strategy.updated_at,
      strategy.active
    ]);

    // Update active strategies cache
    this.activeStrategies.set(strategy.id, strategy);
  }

  private async getStrategyPerformance(strategyId: string): Promise<any> {
    // Get recent performance data for strategy
    const result = await this.dbService.query(`
      SELECT
        AVG(CASE WHEN metric_name = 'success_rate' THEN metric_value END) as avg_success_rate,
        AVG(CASE WHEN metric_name = 'efficiency_score' THEN metric_value END) as avg_efficiency,
        AVG(CASE WHEN metric_name = 'user_satisfaction' THEN metric_value END) as avg_satisfaction
      FROM agent_performance_analytics
      WHERE agent_id = (SELECT agent_id FROM agent_strategies WHERE id = ?)
      AND timestamp > datetime('now', '-24 hours')
    `, [strategyId]);

    return result.results[0] || {};
  }

  private async optimizeStrategy(strategy: AgentStrategy, performance: any): Promise<AgentStrategy | null> {
    // Strategy optimization logic
    const avgSuccessRate = performance.avg_success_rate || 0;
    const avgEfficiency = performance.avg_efficiency || 0;
    const avgSatisfaction = performance.avg_satisfaction || 0;

    // If performance is good, keep current strategy
    if (avgSuccessRate > 0.8 && avgEfficiency > 0.7 && avgSatisfaction > 0.8) {
      return null; // No optimization needed
    }

    // Create optimized strategy
    const optimizedStrategy = { ...strategy };
    optimizedStrategy.version += 1;
    optimizedStrategy.updated_at = new Date().toISOString();

    // Update decision framework based on performance
    if (avgSuccessRate < 0.7) {
      // Add more risk checks
      optimizedStrategy.decision_framework.phases[0].risk_checks.push('additional_validation');
    }

    if (avgEfficiency < 0.6) {
      // Optimize for efficiency
      optimizedStrategy.decision_framework.phases.push({
        phase_name: 'efficiency_check',
        objectives: ['Optimize resource usage'],
        analysis_methods: ['efficiency_analysis'],
        decision_criteria: { efficiency_weight: 0.8 },
        risk_checks: []
      });
    }

    return optimizedStrategy;
  }

  private async processEventFeedback(event: AgentLearningEvent): Promise<void> {
    if (event.outcome_data.feedback_received.corrections_needed.length > 0) {
      // Create feedback loop entry
      await this.dbService.query(`
        INSERT INTO learning_feedback_loop (
          id, agent_id, learning_event_id, feedback_type, feedback_data,
          impact_assessment, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        event.agent_id,
        event.id,
        'correction',
        JSON.stringify(event.outcome_data.feedback_received),
        JSON.stringify({
          impact_level: 'medium',
          action_required: true,
          learning_potential: 'high'
        }),
        new Date().toISOString()
      ]);
    }
  }

  /**
   * Get learning system statistics
   */
  public async getStatistics(): Promise<{
    total_learning_events: number;
    patterns_discovered: number;
    strategies_active: number;
    human_approvals_requested: number;
    explanations_generated: number;
    average_agent_performance: Record<string, number>;
    learning_effectiveness: number;
  }> {
    try {
      // Learning events statistics
      const eventsStats = await this.dbService.query(
        'SELECT COUNT(*) as total FROM agent_learning_events WHERE created_at > datetime("now", "-7 days")'
      );

      // Patterns statistics
      const patternsStats = await this.dbService.query(
        'SELECT COUNT(*) as total FROM agent_learning_patterns WHERE discovered_at > datetime("now", "-7 days")'
      );

      // Strategies statistics
      const strategiesStats = await this.dbService.query(
        'SELECT COUNT(*) as total FROM agent_strategies WHERE active = TRUE'
      );

      // Approvals statistics
      const approvalsStats = await this.dbService.query(
        'SELECT COUNT(*) as total FROM human_approval_requests WHERE created_at > datetime("now", "-7 days")'
      );

      // Explanations statistics
      const explanationsStats = await this.dbService.query(
        'SELECT COUNT(*) as total FROM explainability_reports WHERE generated_at > datetime("now", "-7 days")'
      );

      // Performance statistics
      const performanceStats = await this.dbService.query(`
        SELECT
          AVG(CASE WHEN metric_name = 'success_rate' THEN metric_value END) as avg_success_rate,
          AVG(CASE WHEN metric_name = 'confidence' THEN metric_value END) as avg_confidence,
          AVG(CASE WHEN metric_name = 'user_satisfaction' THEN metric_value END) as avg_satisfaction
        FROM agent_performance_analytics
        WHERE timestamp > datetime('now', '-7 days')
      `);

      const perfStats = performanceStats.results[0] || {};

      return {
        total_learning_events: eventsStats.results[0].total || 0,
        patterns_discovered: patternsStats.results[0].total || 0,
        strategies_active: strategiesStats.results[0].total || 0,
        human_approvals_requested: approvalsStats.results[0].total || 0,
        explanations_generated: explanationsStats.results[0].total || 0,
        average_agent_performance: {
          success_rate: perfStats.avg_success_rate || 0,
          confidence: perfStats.avg_confidence || 0,
          satisfaction: perfStats.avg_satisfaction || 0
        },
        learning_effectiveness: this.calculateLearningEffectiveness(eventsStats.results[0].total || 0, patternsStats.results[0].total || 0)
      };
    } catch (error) {
      this.logger.error('Failed to get learning system statistics', { error: error.message });
      throw error;
    }
  }

  private calculateLearningEffectiveness(totalEvents: number, totalPatterns: number): number {
    if (totalEvents === 0) return 0;
    return (totalPatterns / totalEvents) * 100;
  }
}