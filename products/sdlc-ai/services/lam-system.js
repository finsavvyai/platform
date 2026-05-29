/**
 * LAM System - Integrated LAM Services
 * Main orchestration layer for all LAM capabilities
 */

import { LAMCoreService } from './lam-core-intelligence.js';
import { LAMKnowledgeBase } from './lam-knowledge-base.js';
import { LAMFeedbackLoop } from './lam-feedback-loop.js';
import { LAMPatternSharing } from './lam-pattern-sharing.js';

export class LAMSystem {
  constructor(config = {}) {
    this.config = {
      environment: config.environment || 'development',
      debug: config.debug || false,
      services: {
        coreIntelligence: config.services?.coreIntelligence !== false,
        knowledgeBase: config.services?.knowledgeBase !== false,
        feedbackLoop: config.services?.feedbackLoop !== false,
        patternSharing: config.services?.patternSharing !== false,
        monitoring: config.services?.monitoring !== false
      },
      agents: {
        policyLearner: config.agents?.policyLearner !== false,
        riskAssessor: config.agents?.riskAssessor !== false,
        providerRouter: config.agents?.providerRouter !== false
      },
      ...config
    };

    this.state = {
      initialized: false,
      services: new Map(),
      agents: new Map(),
      metrics: {
        requestsProcessed: 0,
        decisionsMade: 0,
        patternsLearned: 0,
        errors: 0,
        uptime: Date.now()
      },
      health: {
        status: 'initializing',
        lastCheck: null,
        issues: []
      }
    };

    this.log('LAM System initialized');
  }

  /**
   * Initialize the entire LAM system
   */
  async initialize(env = {}) {
    try {
      this.log('🚀 Initializing LAM System...');

      // Initialize knowledge base first (other services depend on it)
      if (this.config.services.knowledgeBase) {
        const knowledgeBase = new LAMKnowledgeBase({
          vectorStore: env.VECTOR_STORE,
          embeddingModel: env.EMBEDDING_MODEL || 'text-embedding-ada-002'
        });
        await knowledgeBase.initialize();
        this.state.services.set('knowledgeBase', knowledgeBase);
      }

      // Initialize core intelligence service
      if (this.config.services.coreIntelligence) {
        const coreService = new LAMCoreService({
          knowledgeBase: this.state.services.get('knowledgeBase'),
          policyEngine: env.POLICY_ENGINE,
          agents: {
            policyLearner: this.config.agents.policyLearner,
            riskAssessor: this.config.agents.riskAssessor,
            providerRouter: this.config.agents.providerRouter
          },
          learning: {
            autonomousMode: env.LAM_AUTONOMOUS_MODE === 'true',
            feedbackLoop: this.config.services.feedbackLoop,
            crossProductLearning: this.config.services.patternSharing
          },
          safety: {
            humanApprovalRequired: ['critical'],
            rollbackEnabled: true,
            maxLearningRate: 0.1
          }
        });
        await coreService.initialize();
        this.state.services.set('coreIntelligence', coreService);
      }

      // Initialize feedback loop
      if (this.config.services.feedbackLoop) {
        const feedbackLoop = new LAMFeedbackLoop({
          learningInterval: env.LEARNING_INTERVAL || '1h',
          batchSize: parseInt(env.LEARNING_BATCH_SIZE) || 100,
          minConfidenceThreshold: 0.7,
          safetyChecks: {
            maxChangePerCycle: 0.1,
            requireHumanApproval: ['critical'],
            rollbackEnabled: true,
            testingRequired: true
          }
        });
        await feedbackLoop.initialize();
        this.state.services.set('feedbackLoop', feedbackLoop);
      }

      // Initialize pattern sharing
      if (this.config.services.patternSharing) {
        const patternSharing = new LAMPatternSharing({
          sharingMode: env.SHARING_MODE || 'federated',
          privacyLevel: env.PRIVACY_LEVEL || 'high',
          minConfidence: 0.8,
          minOccurrences: 5,
          syncInterval: env.SYNC_INTERVAL || '1h'
        });
        await patternSharing.initialize();
        this.state.services.set('patternSharing', patternSharing);
      }

      // Initialize monitoring dashboard (disabled for now due to import issues)
      if (this.config.services.monitoring) {
        // TODO: Fix monitoring dashboard import and re-enable
        this.log('⚠️ Monitoring dashboard temporarily disabled due to import issues');
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.state.initialized = true;
      this.state.health.status = 'healthy';
      this.state.health.lastCheck = new Date().toISOString();

      this.log('✅ LAM System initialized successfully');

      return {
        success: true,
        servicesInitialized: this.state.services.size,
        agentsConfigured: Object.values(this.config.agents).filter(Boolean).length,
        environment: this.config.environment
      };

    } catch (error) {
      this.log(`❌ Failed to initialize LAM System: ${error.message}`, 'error');
      this.state.health.status = 'error';
      this.state.health.issues.push(error.message);
      throw error;
    }
  }

  /**
   * Process a request through the LAM system
   */
  async processRequest(request, context = {}) {
    if (!this.state.initialized) {
      throw new Error('LAM System not initialized');
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.log(`🔄 Processing request ${requestId}`, 'debug');

      // Get core intelligence service
      const coreService = this.state.services.get('coreIntelligence');
      if (!coreService) {
        throw new Error('Core intelligence service not available');
      }

      // Process through LAM intelligence
      const result = await coreService.processRequest(request, {
        ...context,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Record in feedback loop
      const feedbackLoop = this.state.services.get('feedbackLoop');
      if (feedbackLoop) {
        await feedbackLoop.recordExecution({
          requestId,
          request: this.sanitizeRequest(request),
          context: this.sanitizeContext(context),
          decision: result.lamInsights?.synthesis?.decision,
          prediction: result.lamInsights?.synthesis?.confidence,
          actual: result.success ? 1 : 0,
          outcome: result.success ? 'success' : 'failure',
          confidence: result.lamInsights?.synthesis?.confidence || 0,
          processingTime: Date.now() - startTime,
          error: result.error,
          metadata: result.lamInsights
        });
      }

      // Record metrics
      this.state.metrics.requestsProcessed++;
      if (result.lamInsights?.synthesis?.decision) {
        this.state.metrics.decisionsMade++;
      }

      this.log(`✅ Request ${requestId} processed in ${Date.now() - startTime}ms`, 'debug');

      return {
        ...result,
        requestId,
        systemMetrics: {
          processingTime: Date.now() - startTime,
          totalRequests: this.state.metrics.requestsProcessed,
          uptime: Date.now() - this.state.metrics.uptime
        }
      };

    } catch (error) {
      this.state.metrics.errors++;
      this.log(`❌ Request ${requestId} failed: ${error.message}`, 'error');

      // Record error in feedback loop
      const feedbackLoop = this.state.services.get('feedbackLoop');
      if (feedbackLoop) {
        await feedbackLoop.recordExecution({
          requestId,
          request: this.sanitizeRequest(request),
          context: this.sanitizeContext(context),
          error: error.message,
          outcome: 'error',
          processingTime: Date.now() - startTime
        });
      }

      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus() {
    const health = {
      ...this.state.health,
      initialized: this.state.initialized,
      services: {},
      metrics: this.state.metrics,
      uptime: Date.now() - this.state.metrics.uptime
    };

    // Check each service
    for (const [name, service] of this.state.services) {
      try {
        if (typeof service.getHealth === 'function') {
          health.services[name] = await service.getHealth();
        } else if (typeof service.getStatistics === 'function') {
          health.services[name] = {
            status: 'healthy',
            statistics: service.getStatistics()
          };
        } else {
          health.services[name] = { status: 'unknown' };
        }
      } catch (error) {
        health.services[name] = {
          status: 'error',
          error: error.message
        };
      }
    }

    // Determine overall health
    const serviceStatuses = Object.values(health.services);
    const healthyServices = serviceStatuses.filter(s => s.status === 'healthy').length;
    const totalServices = serviceStatuses.length;

    if (healthyServices === totalServices) {
      health.status = 'healthy';
    } else if (healthyServices > totalServices / 2) {
      health.status = 'degraded';
    } else {
      health.status = 'unhealthy';
    }

    health.lastCheck = new Date().toISOString();
    this.state.health = health;

    return health;
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    const statistics = {
      ...this.state.metrics,
      services: {},
      uptime: Date.now() - this.state.metrics.uptime,
      uptimeFormatted: this.formatUptime(Date.now() - this.state.metrics.uptime)
    };

    // Collect statistics from each service
    for (const [name, service] of this.state.services) {
      try {
        if (typeof service.getStatistics === 'function') {
          statistics.services[name] = service.getStatistics();
        }
      } catch (error) {
        statistics.services[name] = { error: error.message };
      }
    }

    return statistics;
  }

  /**
   * Shutdown the LAM system gracefully
   */
  async shutdown() {
    this.log('🔄 Shutting down LAM System...');

    for (const [name, service] of this.state.services) {
      try {
        if (typeof service.cleanup === 'function') {
          await service.cleanup();
        }
        this.log(`✅ Service ${name} shutdown successfully`);
      } catch (error) {
        this.log(`❌ Error shutting down service ${name}: ${error.message}`, 'error');
      }
    }

    this.state.initialized = false;
    this.state.health.status = 'shutdown';

    this.log('✅ LAM System shutdown complete');
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.getHealthStatus();
      } catch (error) {
        this.log(`Health check error: ${error.message}`, 'error');
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Utility methods
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [LAM-SYSTEM] [${level.toUpperCase()}] ${message}`;

    if (this.config.debug || level === 'error') {
      console.log(logMessage);
    }
  }

  generateRequestId() {
    return `lam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeRequest(request) {
    // Remove sensitive data from request for logging/learning
    const sanitized = JSON.parse(JSON.stringify(request));

    // Remove common sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const removeSensitive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          removeSensitive(obj[key]);
        }
      }
    };

    removeSensitive(sanitized);
    return sanitized;
  }

  sanitizeContext(context) {
    // Remove sensitive data from context
    return this.sanitizeRequest(context);
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export default LAMSystem;