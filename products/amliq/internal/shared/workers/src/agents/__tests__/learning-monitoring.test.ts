/**
 * Learning and Monitoring Systems Tests
 *
 * Comprehensive test suite for the agent learning system and monitoring
 * infrastructure including health management and performance tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentLearningSystem, LearningEvent, FeedbackData } from '../learning-system';
import { AgentMonitoringSystem, AgentMetrics, AgentAlert } from '../agent-monitoring';
import { AgentHealthManager, HealthPolicy } from '../agent-health-manager';
import { IntegratedAgentOrchestrator } from '../agent-orchestrator-integration';
import { TestAgent } from './agent-framework.test';

describe('AgentLearningSystem', () => {
  let learningSystem: AgentLearningSystem;
  const agentId = 'test-learning-agent';

  beforeEach(() => {
    learningSystem = new AgentLearningSystem();
  });

  describe('Learning Event Processing', () => {
    it('should process learning events correctly', async () => {
      const learningEvent: LearningEvent = {
        id: 'learning-event-1',
        agent_id: agentId,
        timestamp: Date.now(),
        event_type: 'goal_completed',
        context: {
          goal_type: 'invoice_processing',
          parameters: { amount: 1000 },
          execution_time: 2500
        },
        outcome: {
          success: true,
          result: { invoice_id: 'inv-123' },
          metrics: { accuracy: 0.95, efficiency: 0.88 }
        },
        confidence_before: 0.8,
        confidence_after: 0.9,
        learning_signals: {
          pattern_recognition: true,
          outcome_prediction: true,
          performance_improvement: true
        }
      };

      await learningSystem.processLearningEvent(
        agentId,
        learningEvent.event_type,
        learningEvent.context,
        learningEvent.outcome,
        learningEvent.confidence_before,
        learningEvent.confidence_after
      );

      const recentEvents = await learningSystem.getRecentLearningEvents(agentId, 10);
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].event_type).toBe('goal_completed');
      expect(recentEvents[0].outcome.success).toBe(true);
    });

    it('should track learning progress over time', async () => {
      // Process multiple learning events to show progress
      for (let i = 0; i < 5; i++) {
        await learningSystem.processLearningEvent(
          agentId,
          'goal_completed',
          { iteration: i },
          { success: true, accuracy: 0.8 + (i * 0.02) },
          0.7 + (i * 0.05),
          0.8 + (i * 0.05)
        );
      }

      const learningProgress = await learningSystem.getLearningProgress(agentId);
      expect(learningProgress.total_events).toBe(5);
      expect(learningProgress.success_rate).toBe(1.0);
      expect(learningProgress.confidence_improvement).toBeGreaterThan(0);
      expect(learningProgress.learning_velocity).toBeGreaterThan(0);
    });

    it('should identify learning patterns', async () => {
      // Create events with patterns
      const patterns = [
        { goal_type: 'invoice_processing', success_rate: 0.95 },
        { goal_type: 'invoice_processing', success_rate: 0.92 },
        { goal_type: 'payment_processing', success_rate: 0.88 },
        { goal_type: 'invoice_processing', success_rate: 0.96 }
      ];

      for (const pattern of patterns) {
        await learningSystem.processLearningEvent(
          agentId,
          'goal_completed',
          { goal_type: pattern.goal_type },
          { success: true, accuracy: pattern.success_rate },
          0.8,
          0.9
        );
      }

      const learningPatterns = await learningSystem.identifyLearningPatterns(agentId);
      expect(learningPatterns.patterns.length).toBeGreaterThan(0);
      expect(learningPatterns.patterns.some(p => p.pattern.includes('invoice_processing'))).toBe(true);
    });
  });

  describe('Feedback Processing', () => {
    it('should process human feedback correctly', async () => {
      const feedback: FeedbackData = {
        id: 'feedback-1',
        agent_id: agentId,
        timestamp: Date.now(),
        feedback_type: 'human_correction',
        rating: 4,
        comments: 'Good performance, but could be faster',
        context: {
          goal_id: 'goal-123',
          execution_time: 5000,
          accuracy: 0.9
        },
        outcome: {
          original_result: { invoice_id: 'inv-123' },
          corrected_result: { invoice_id: 'inv-123', optimized: true },
          improvement_suggested: true
        },
        feedback_source: 'human_expert',
        confidence_impact: 0.1
      };

      await learningSystem.processFeedback(
        agentId,
        feedback.feedback_type,
        feedback.rating,
        feedback.comments,
        feedback.context,
        feedback.outcome
      );

      const feedbackHistory = await learningSystem.getFeedbackHistory(agentId);
      expect(feedbackHistory).toHaveLength(1);
      expect(feedbackHistory[0].rating).toBe(4);
      expect(feedbackHistory[0].feedback_type).toBe('human_correction');
    });

    it('should calculate feedback impact on performance', async () => {
      // Process initial learning events
      await learningSystem.processLearningEvent(
        agentId,
        'goal_completed',
        { phase: 'before_feedback' },
        { success: true, accuracy: 0.8 },
        0.7,
        0.8
      );

      // Process feedback
      await learningSystem.processFeedback(
        agentId,
        'performance_improvement',
        5,
        'Excellent accuracy improvement needed',
        { phase: 'feedback' },
        { improvement_suggested: true }
      );

      // Process post-feedback events
      await learningSystem.processLearningEvent(
        agentId,
        'goal_completed',
        { phase: 'after_feedback' },
        { success: true, accuracy: 0.95 },
        0.8,
        0.95
      );

      const feedbackImpact = await learningSystem.calculateFeedbackImpact(agentId);
      expect(feedbackImpact.accuracy_improvement).toBeGreaterThan(0.1);
      expect(feedbackImpact.confidence_improvement).toBeGreaterThan(0);
      expect(feedbackImpact.feedback_effectiveness).toBeGreaterThan(0);
    });
  });

  describe('Adaptation Strategy Generation', () => {
    it('should generate adaptation strategies based on performance', async () => {
      // Process events indicating need for adaptation
      await learningSystem.processLearningEvent(
        agentId,
        'goal_completed',
        { task_complexity: 'high' },
        { success: false, error: 'timeout' },
        0.9,
        0.3
      );

      await learningSystem.processLearningEvent(
        agentId,
        'goal_completed',
        { task_complexity: 'high' },
        { success: false, error: 'timeout' },
        0.3,
        0.1
      );

      const adaptationStrategies = await learningSystem.generateAdaptationStrategies(agentId);
      expect(adaptationStrategies.strategies.length).toBeGreaterThan(0);
      expect(adaptationStrategies.strategies.some(s =>
        s.type.includes('timeout') || s.type.includes('performance')
      )).toBe(true);
    });

    it('should prioritize adaptation strategies by impact', async () => {
      const strategies = await learningSystem.generateAdaptationStrategies(agentId);

      if (strategies.strategies.length > 1) {
        // Check that strategies are sorted by priority/impact
        for (let i = 0; i < strategies.strategies.length - 1; i++) {
          const current = strategies.strategies[i];
          const next = strategies.strategies[i + 1];
          expect(current.priority).toBeGreaterThanOrEqual(next.priority);
        }
      }
    });
  });

  describe('Knowledge Base Management', () => {
    it('should update knowledge base from learning events', async () => {
      await learningSystem.processLearningEvent(
        agentId,
        'goal_completed',
        { pattern: 'successful_invoice_processing' },
        { success: true, best_practices: ['early_validation', 'parallel_processing'] },
        0.8,
        0.95
      );

      const knowledgeBase = await learningSystem.getKnowledgeBase(agentId);
      expect(knowledgeBase.best_practices.length).toBeGreaterThan(0);
      expect(knowledgeBase.success_patterns.length).toBeGreaterThan(0);
    });

    it('should provide knowledge-based recommendations', async () => {
      // Build knowledge base
      await learningSystem.processLearningEvent(
        agentId,
        'goal_completed',
        { invoice_amount: 'high', payment_method: 'wire' },
        { success: true, verification_level: 'enhanced' },
        0.8,
        0.95
      );

      const recommendations = await learningSystem.getKnowledgeRecommendations(
        agentId,
        { invoice_amount: 'high', payment_method: 'wire' }
      );

      expect(recommendations.recommendations.length).toBeGreaterThan(0);
      expect(recommendations.confidence).toBeGreaterThan(0);
    });
  });
});

describe('AgentMonitoringSystem', () => {
  let monitoringSystem: AgentMonitoringSystem;
  const agentId = 'test-monitoring-agent';
  const agentType = 'TestAgent';

  beforeEach(() => {
    monitoringSystem = new AgentMonitoringSystem();
  });

  describe('Metrics Collection', () => {
    it('should collect and store agent metrics', async () => {
      const metrics: Partial<AgentMetrics> = {
        performance_metrics: {
          tasks_completed: 10,
          tasks_failed: 2,
          average_task_duration: 1500,
          success_rate: 0.83,
          goal_completion_rate: 0.85,
          accuracy_score: 0.92,
          efficiency_score: 0.88,
          response_time_p95: 2000,
          throughput_per_hour: 25
        },
        health_metrics: {
          status: 'healthy',
          cpu_usage: 45,
          memory_usage: 60,
          error_rate: 2,
          last_heartbeat: Date.now(),
          uptime_percentage: 99.5,
          consecutive_failures: 0,
          alert_count: 1
        },
        business_metrics: {
          goals_achieved: 10,
          goals_failed: 2,
          business_value_created: 5000,
          cost_savings_generated: 1200,
          risk_mitigated: 800,
          compliance_score: 0.98,
          customer_impact_score: 0.85,
          roi_contribution: 2.5
        },
        resource_metrics: {
          api_calls_made: 150,
          api_costs_incurred: 2.50,
          data_processed_mb: 15,
          storage_used_mb: 5,
          network_requests: 45,
          compute_time_ms: 8000,
          tools_utilized: ['invoice_generator', 'validator'],
          permissions_used: ['billing.write', 'billing.read']
        }
      };

      await monitoringSystem.collectMetrics(agentId, agentType, metrics);

      const agentDetails = await monitoringSystem.getAgentDetails(agentId);
      expect(agentDetails.agent).toBeDefined();
      expect(agentDetails.agent!.agent_id).toBe(agentId);
      expect(agentDetails.agent!.performance_metrics.tasks_completed).toBe(10);
      expect(agentDetails.agent!.health_metrics.status).toBe('healthy');
    });

    it('should generate alerts based on metrics thresholds', async () => {
      const metricsWithIssues: Partial<AgentMetrics> = {
        performance_metrics: {
          tasks_completed: 5,
          tasks_failed: 5,
          average_task_duration: 3000,
          success_rate: 0.5, // Low success rate should trigger alert
          goal_completion_rate: 0.5,
          accuracy_score: 0.6,
          efficiency_score: 0.4,
          response_time_p95: 5000,
          throughput_per_hour: 10
        },
        health_metrics: {
          status: 'degraded',
          cpu_usage: 85,
          memory_usage: 90,
          error_rate: 15,
          last_heartbeat: Date.now(),
          uptime_percentage: 95,
          consecutive_failures: 6, // High consecutive failures should trigger alert
          alert_count: 3
        }
      };

      await monitoringSystem.collectMetrics(agentId, agentType, metricsWithIssues);

      const dashboard = await monitoringSystem.getMonitoringDashboard();
      const criticalAlerts = dashboard.active_alerts.filter(a => a.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts.some(a => a.title.includes('Consecutive Failures'))).toBe(true);
    });

    it('should track metrics over time for trend analysis', async () => {
      // Collect metrics over multiple time points
      for (let i = 0; i < 5; i++) {
        const metrics: Partial<AgentMetrics> = {
          performance_metrics: {
            tasks_completed: 10 + i,
            tasks_failed: 1,
            average_task_duration: 1500 - (i * 100),
            success_rate: 0.9 + (i * 0.01),
            goal_completion_rate: 0.9 + (i * 0.01),
            accuracy_score: 0.9 + (i * 0.01),
            efficiency_score: 0.85 + (i * 0.02),
            response_time_p95: 2000 - (i * 50),
            throughput_per_hour: 25 + i
          }
        };

        await monitoringSystem.collectMetrics(agentId, agentType, metrics);

        // Add small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const agentDetails = await monitoringSystem.getAgentDetails(agentId);
      expect(agentDetails.history.length).toBe(5);

      // Check that performance improved over time
      const firstMetrics = agentDetails.history[0].performance_metrics;
      const lastMetrics = agentDetails.history[4].performance_metrics;
      expect(lastMetrics.success_rate).toBeGreaterThan(firstMetrics.success_rate);
      expect(lastMetrics.efficiency_score).toBeGreaterThan(firstMetrics.efficiency_score);
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate comprehensive monitoring dashboard', async () => {
      // Add multiple agents with different states
      const agents = [
        { id: 'agent-1', type: 'BillingAgent', health: 'healthy' },
        { id: 'agent-2', type: 'ComplianceAgent', health: 'degraded' },
        { id: 'agent-3', type: 'IntelligenceAgent', health: 'healthy' }
      ];

      for (const agent of agents) {
        const metrics: Partial<AgentMetrics> = {
          performance_metrics: {
            tasks_completed: 10,
            tasks_failed: agent.health === 'degraded' ? 5 : 1,
            average_task_duration: 1500,
            success_rate: agent.health === 'degraded' ? 0.67 : 0.91,
            goal_completion_rate: agent.health === 'degraded' ? 0.7 : 0.95,
            accuracy_score: agent.health === 'degraded' ? 0.8 : 0.95,
            efficiency_score: agent.health === 'degraded' ? 0.75 : 0.9,
            response_time_p95: 2000,
            throughput_per_hour: 25
          },
          health_metrics: {
            status: agent.health as any,
            cpu_usage: agent.health === 'degraded' ? 80 : 45,
            memory_usage: agent.health === 'degraded' ? 85 : 60,
            error_rate: agent.health === 'degraded' ? 10 : 2,
            last_heartbeat: Date.now(),
            uptime_percentage: agent.health === 'degraded' ? 95 : 99.5,
            consecutive_failures: agent.health === 'degraded' ? 3 : 0,
            alert_count: agent.health === 'degraded' ? 4 : 1
          }
        };

        await monitoringSystem.collectMetrics(agent.id, agent.type, metrics);
      }

      const dashboard = await monitoringSystem.getMonitoringDashboard();

      expect(dashboard.overview.total_agents).toBe(3);
      expect(dashboard.overview.healthy_agents).toBe(2);
      expect(dashboard.overview.degraded_agents).toBe(1);
      expect(dashboard.agent_status.by_type['BillingAgent'].total).toBe(1);
      expect(dashboard.agent_status.by_type['ComplianceAgent'].total).toBe(1);
      expect(dashboard.agent_status.by_type['IntelligenceAgent'].total).toBe(1);
      expect(dashboard.active_alerts.length).toBeGreaterThan(0);
    });

    it('should provide system-wide metrics summary', async () => {
      // Add metrics for system-wide calculation
      await monitoringSystem.collectMetrics('agent-1', 'TestAgent', {
        resource_metrics: {
          api_calls_made: 100,
          api_costs_incurred: 1.50,
          data_processed_mb: 10,
          compute_time_ms: 5000
        }
      });

      await monitoringSystem.collectMetrics('agent-2', 'TestAgent', {
        resource_metrics: {
          api_calls_made: 150,
          api_costs_incurred: 2.25,
          data_processed_mb: 15,
          compute_time_ms: 7500
        }
      });

      const dashboard = await monitoringSystem.getMonitoringDashboard();
      const systemMetrics = dashboard.system_metrics;

      expect(systemMetrics.total_api_calls).toBe(250);
      expect(systemMetrics.total_cost_incurred).toBe(3.75);
      expect(systemMetrics.total_data_processed).toBe(25);
      expect(systemMetrics.total_compute_time).toBe(12500);
    });
  });

  describe('Alert Management', () => {
    it('should create and manage alerts with proper severity levels', async () => {
      const alertId = await monitoringSystem.createAlert({
        agent_id: agentId,
        agent_type: agentType,
        alert_type: 'performance',
        severity: 'critical',
        title: 'Critical Performance Degradation',
        description: 'Agent success rate dropped below 50%',
        metrics_snapshot: { success_rate: 0.4 }
      });

      expect(alertId).toBeDefined();

      const dashboard = await monitoringSystem.getMonitoringDashboard();
      const createdAlert = dashboard.active_alerts.find(a => a.id === alertId);
      expect(createdAlert).toBeDefined();
      expect(createdAlert!.severity).toBe('critical');
      expect(createdAlert!.acknowledged).toBe(false);
      expect(createdAlert!.resolved).toBe(false);
    });

    it('should handle alert acknowledgment and resolution', async () => {
      const alertId = await monitoringSystem.createAlert({
        agent_id: agentId,
        agent_type: agentType,
        alert_type: 'health',
        severity: 'warning',
        title: 'High Memory Usage',
        description: 'Agent memory usage exceeded 80%',
        metrics_snapshot: { memory_usage: 85 }
      });

      await monitoringSystem.acknowledgeAlert(alertId, 'test-user');
      await monitoringSystem.resolveAlert(alertId, 'Memory optimization completed', 'test-user');

      const dashboard = await monitoringSystem.getMonitoringDashboard();
      const resolvedAlert = dashboard.active_alerts.find(a => a.id === alertId);

      // Should not appear in active alerts since it's resolved
      expect(resolvedAlert).toBeUndefined();
    });

    it('should escalate alerts based on severity and time', async () => {
      const alertId = await monitoringSystem.createAlert({
        agent_id: agentId,
        agent_type: agentType,
        alert_type: 'system',
        severity: 'critical',
        title: 'System Critical Error',
        description: 'Agent is unresponsive',
        metrics_snapshot: { last_heartbeat: Date.now() - 300000 }
      });

      // Check escalation level (should increase for critical alerts)
      const dashboard = await monitoringSystem.getMonitoringDashboard();
      const alert = dashboard.active_alerts.find(a => a.id === alertId);
      expect(alert!.escalation_level).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('AgentHealthManager', () => {
  let healthManager: AgentHealthManager;
  const agentId = 'test-health-agent';
  const agentType = 'TestAgent';

  beforeEach(() => {
    healthManager = new AgentHealthManager();
  });

  describe('Health Check Execution', () => {
    it('should perform comprehensive health checks', async () => {
      const metrics: AgentMetrics = {
        agent_id: agentId,
        agent_type: agentType,
        timestamp: Date.now(),
        performance_metrics: {
          tasks_completed: 10,
          tasks_failed: 1,
          success_rate: 0.91,
          goal_completion_rate: 0.9,
          accuracy_score: 0.95,
          efficiency_score: 0.88,
          response_time_p95: 1500,
          throughput_per_hour: 30
        },
        health_metrics: {
          status: 'healthy',
          cpu_usage: 50,
          memory_usage: 60,
          error_rate: 3,
          last_heartbeat: Date.now() - 60000, // 1 minute ago
          uptime_percentage: 99.2,
          consecutive_failures: 0,
          alert_count: 1
        },
        business_metrics: {
          goals_achieved: 10,
          goals_failed: 1,
          business_value_created: 3000,
          cost_savings_generated: 800,
          risk_mitigated: 500,
          compliance_score: 0.97,
          customer_impact_score: 0.9,
          roi_contribution: 2.2
        },
        resource_metrics: {
          api_calls_made: 120,
          api_costs_incurred: 1.80,
          data_processed_mb: 12,
          storage_used_mb: 4,
          network_requests: 35,
          compute_time_ms: 6000,
          tools_utilized: ['test_tool'],
          permissions_used: ['test.read']
        }
      };

      const healthChecks = await healthManager.performHealthCheck(agentId, agentType, metrics);

      expect(healthChecks.length).toBeGreaterThan(0);
      expect(healthChecks.every(check => check.agent_id === agentId)).toBe(true);
      expect(healthChecks.every(check => ['passing', 'warning', 'critical', 'failing'].includes(check.status))).toBe(true);
    });

    it('should detect unhealthy conditions correctly', async () => {
      const unhealthyMetrics: AgentMetrics = {
        agent_id: agentId,
        agent_type: agentType,
        timestamp: Date.now() - 600000, // 10 minutes ago (should trigger heartbeat warning)
        performance_metrics: {
          tasks_completed: 5,
          tasks_failed: 5,
          success_rate: 0.5, // Low success rate
          goal_completion_rate: 0.5,
          accuracy_score: 0.6,
          efficiency_score: 0.4,
          response_time_p95: 5000,
          throughput_per_hour: 10
        },
        health_metrics: {
          status: 'critical',
          cpu_usage: 95, // High CPU usage
          memory_usage: 98, // High memory usage
          error_rate: 25, // High error rate
          last_heartbeat: Date.now() - 600000,
          uptime_percentage: 85,
          consecutive_failures: 8, // Many consecutive failures
          alert_count: 10
        },
        business_metrics: {
          goals_achieved: 5,
          goals_failed: 5,
          business_value_created: 1000,
          cost_savings_generated: 200,
          risk_mitigated: 100,
          compliance_score: 0.7, // Low compliance score
          customer_impact_score: 0.5,
          roi_contribution: 0.8
        },
        resource_metrics: {
          api_calls_made: 200,
          api_costs_incurred: 5.00,
          data_processed_mb: 50,
          storage_used_mb: 20,
          network_requests: 80,
          compute_time_ms: 15000,
          tools_utilized: ['test_tool'],
          permissions_used: ['test.read']
        }
      };

      const healthChecks = await healthManager.performHealthCheck(agentId, agentType, unhealthyMetrics);

      const criticalChecks = healthChecks.filter(check =>
        check.status === 'critical' || check.status === 'failing'
      );
      expect(criticalChecks.length).toBeGreaterThan(0);
    });
  });

  describe('Health Trend Analysis', () => {
    it('should analyze health trends over time', async () => {
      // Create multiple health snapshots over time
      const snapshots = [];
      for (let i = 0; i < 10; i++) {
        const snapshot = {
          agent_id: agentId,
          timestamp: Date.now() - (9 - i) * 3600000, // Hourly snapshots
          overall_health_score: 70 + (i * 3), // Improving health
          component_scores: {
            performance: 65 + (i * 3),
            availability: 75 + (i * 2),
            resource_utilization: 70 + (i * 2.5),
            business_logic: 68 + (i * 3.5),
            security: 80 + (i * 1)
          },
          active_issues: i < 5 ? [
            { type: 'performance', severity: 'warning', description: 'Slow response', impact: 20 }
          ] : [],
          recent_actions: [],
          recommendations: []
        };
        snapshots.push(snapshot);
      }

      // Manually add snapshots to health manager (would be done automatically in real system)
      for (const snapshot of snapshots) {
        await healthManager['createHealthSnapshot'](agentId, {} as AgentMetrics, []);
      }

      const healthTrend = await healthManager.getHealthTrends(agentId, '24h');

      expect(healthTrend).toBeDefined();
      expect(healthTrend!.agent_id).toBe(agentId);
      expect(healthTrend!.health_score_trend.length).toBeGreaterThan(0);
      expect(healthTrend!.predicted_health.next_hour).toBeGreaterThan(0);
      expect(healthTrend!.predicted_health.confidence).toBeGreaterThan(0);
    });
  });

  describe('Healing Actions', () => {
    it('should trigger healing actions for critical health issues', async () => {
      const actionId = await healthManager.triggerHealingAction(
        agentId,
        'restart',
        'Agent health critical - consecutive failures detected'
      );

      expect(actionId).toBeDefined();

      const healingHistory = await healthManager.getHealingHistory(agentId);
      const triggeredAction = healingHistory.find(action => action.id === actionId);

      expect(triggeredAction).toBeDefined();
      expect(triggeredAction!.action_type).toBe('restart');
      expect(triggeredAction!.status).toBeOneOf(['pending', 'executing', 'completed']);
    });

    it('should track healing action outcomes', async () => {
      const actionId = await healthManager.triggerHealingAction(
        agentId,
        'reconfigure',
        'Performance degradation detected'
      );

      // Wait for action to complete (in real system)
      await new Promise(resolve => setTimeout(resolve, 100));

      const healingHistory = await healthManager.getHealingHistory(agentId);
      const action = healingHistory.find(a => a.id === actionId);

      expect(action).toBeDefined();
      expect(action!.completed_at).toBeDefined();
      expect(action!.result).toBeDefined();
    });
  });

  describe('Health Policy Management', () => {
    it('should create and manage custom health policies', async () => {
      const customPolicy: Omit<HealthPolicy, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Custom High-Performance Policy',
        description: 'Strict health monitoring for high-performance agents',
        agent_types: [agentType],
        health_checks: [
          {
            id: 'custom-performance-check',
            check_type: 'performance',
            condition: 'success_rate < 0.95',
            threshold: 0.95,
            severity: 'high',
            check_interval: 1,
            enabled: true
          }
        ],
        recovery_actions: [
          {
            id: 'custom-performance-recovery',
            trigger_condition: 'performance_score < 0.8',
            action_type: 'reconfigure',
            parameters: { optimize_performance: true },
            max_attempts: 2,
            cooldown_period: 10,
            success_criteria: 'performance_score > 0.9'
          }
        ],
        escalation_rules: [
          {
            id: 'custom-escalation',
            condition: 'consecutive_failures > 2',
            escalation_level: 1,
            action: 'notify_admin',
            recipients: ['admin@test.com'],
            delay_minutes: 5
          }
        ],
        enabled: true
      };

      const policyId = await healthManager.createHealthPolicy(customPolicy);
      expect(policyId).toBeDefined();

      const policies = await healthManager.getHealthPolicies();
      const createdPolicy = policies.find(p => p.id === policyId);

      expect(createdPolicy).toBeDefined();
      expect(createdPolicy!.name).toBe(customPolicy.name);
      expect(createdPolicy!.health_checks.length).toBe(1);
      expect(createdPolicy!.recovery_actions.length).toBe(1);
    });

    it('should apply health policies during checks', async () => {
      // Create a strict policy
      await healthManager.createHealthPolicy({
        name: 'Strict Policy Test',
        description: 'Test policy with strict thresholds',
        agent_types: [agentType],
        health_checks: [
          {
            id: 'strict-success-rate',
            check_type: 'performance',
            condition: 'success_rate < 0.9',
            threshold: 0.9,
            severity: 'high',
            check_interval: 1,
            enabled: true
          }
        ],
        recovery_actions: [],
        escalation_rules: [],
        enabled: true
      });

      const metricsWithLowSuccessRate: AgentMetrics = {
        agent_id: agentId,
        agent_type: agentType,
        timestamp: Date.now(),
        performance_metrics: {
          tasks_completed: 8,
          tasks_failed: 2,
          success_rate: 0.8, // Below strict threshold of 0.9
          goal_completion_rate: 0.8,
          accuracy_score: 0.85,
          efficiency_score: 0.8,
          response_time_p95: 2000,
          throughput_per_hour: 20
        },
        health_metrics: {
          status: 'healthy',
          cpu_usage: 50,
          memory_usage: 60,
          error_rate: 5,
          last_heartbeat: Date.now(),
          uptime_percentage: 98,
          consecutive_failures: 0,
          alert_count: 1
        },
        business_metrics: {
          goals_achieved: 8,
          goals_failed: 2,
          business_value_created: 2000,
          cost_savings_generated: 500,
          risk_mitigated: 300,
          compliance_score: 0.95,
          customer_impact_score: 0.85,
          roi_contribution: 1.8
        },
        resource_metrics: {
          api_calls_made: 100,
          api_costs_incurred: 1.5,
          data_processed_mb: 10,
          storage_used_mb: 5,
          network_requests: 30,
          compute_time_ms: 5000,
          tools_utilized: ['test_tool'],
          permissions_used: ['test.read']
        }
      };

      const healthChecks = await healthManager.performHealthCheck(agentId, agentType, metricsWithLowSuccessRate);

      const performanceChecks = healthChecks.filter(check => check.check_type === 'performance');
      expect(performanceChecks.length).toBeGreaterThan(0);

      // Should detect performance issue due to strict policy
      const problematicChecks = performanceChecks.filter(check =>
        check.status === 'warning' || check.status === 'critical' || check.status === 'failing'
      );
      expect(problematicChecks.length).toBeGreaterThan(0);
    });
  });
});

describe('IntegratedAgentOrchestrator', () => {
  let orchestrator: IntegratedAgentOrchestrator;
  let testAgent: TestAgent;
  const organizationId = 'test-integration-org';
  const userId = 'test-user';

  beforeEach(() => {
    orchestrator = new IntegratedAgentOrchestrator();
    testAgent = new TestAgent('integration-test-agent', organizationId);
  });

  describe('Agent Lifecycle Management', () => {
    it('should register agents with all integrated systems', async () => {
      const agentId = await orchestrator.registerAgent(testAgent, organizationId, userId);

      expect(agentId).toBe(testAgent.getAgentId());

      const systemOverview = await orchestrator.getSystemOverview();
      expect(systemOverview.total_agents).toBe(1);
      expect(systemOverview.active_agents).toBe(0); // Agent is idle, not active
    });

    it('should handle agent start and stop operations', async () => {
      await orchestrator.registerAgent(testAgent, organizationId, userId);

      const goal: AgentGoal = {
        id: 'integration-test-goal',
        description: 'Test goal for integration',
        priority: 'medium',
        goal_type: 'test_goal',
        parameters: {},
        created_at: Date.now(),
        created_by: userId
      };

      await orchestrator.startAgent(testAgent.getAgentId(), goal);

      let systemOverview = await orchestrator.getSystemOverview();
      expect(systemOverview.active_agents).toBe(1);

      await orchestrator.stopAgent(testAgent.getAgentId());

      systemOverview = await orchestrator.getSystemOverview();
      expect(systemOverview.active_agents).toBe(0);
    });

    it('should coordinate agent collaboration', async () => {
      const agent1 = new TestAgent('collab-agent-1', organizationId);
      const agent2 = new TestAgent('collab-agent-2', organizationId);

      await orchestrator.registerAgent(agent1, organizationId, userId);
      await orchestrator.registerAgent(agent2, organizationId, userId);

      const collaborationResult = await orchestrator.coordinateAgentCollaboration(
        agent1.getAgentId(),
        agent2.getAgentId(),
        'message',
        {
          message_type: 'collaboration_request',
          content: 'Requesting collaboration for task processing',
          priority: 'normal'
        }
      );

      expect(collaborationResult.message_id).toBeDefined();
      expect(collaborationResult.status).toBe('delivered');
    });
  });

  describe('System Integration', () => {
    it('should provide comprehensive system overview', async () => {
      await orchestrator.registerAgent(testAgent, organizationId, userId);

      const systemOverview = await orchestrator.getSystemOverview();

      expect(systemOverview.total_agents).toBe(1);
      expect(systemOverview.system_health).toBeGreaterThan(0);
      expect(systemOverview.recent_events).toBeDefined();
      expect(systemOverview.collaboration_summary).toBeDefined();
      expect(systemOverview.performance_summary).toBeDefined();
    });

    it('should track agent performance across all systems', async () => {
      await orchestrator.registerAgent(testAgent, organizationId, userId);

      const goal: AgentGoal = {
        id: 'performance-tracking-goal',
        description: 'Goal for performance tracking',
        priority: 'high',
        goal_type: 'test_goal',
        parameters: { performance_test: true },
        created_at: Date.now(),
        created_by: userId
      };

      await orchestrator.startAgent(testAgent.getAgentId(), goal);

      // Wait a moment for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));

      const agentStatus = await orchestrator.getAgentStatus(testAgent.getAgentId());
      expect(agentStatus).toBeDefined();
      expect(agentStatus!.agent_id).toBe(testAgent.getAgentId());
      expect(agentStatus!.state).toBeDefined();
      expect(agentStatus!.metrics).toBeDefined();
    });
  });

  afterEach(() => {
    // Clean up after each test
    if (orchestrator && testAgent) {
      orchestrator.unregisterAgent(testAgent.getAgentId()).catch(() => {});
    }
  });
});