/**
 * LAM Base Agent Class
 * Provides common functionality for all LAM agents
 */

class LAMBaseAgent {
  constructor(config = {}) {
    this.config = {
      name: config.name || 'base-agent',
      version: config.version || '1.0.0',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      debug: config.debug || false,
      knowledgeBase: config.knowledgeBase || null,
      coreService: config.coreService || null
    };

    this.state = {
      initialized: false,
      health: {
        status: 'initializing',
        lastCheck: new Date().toISOString(),
        errors: [],
        metrics: {}
      },
      statistics: {
        requestsProcessed: 0,
        errors: 0,
        averageResponseTime: 0,
        uptime: new Date().toISOString()
      }
    };

    this.eventHandlers = new Map();
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    try {
      this.log(`Initializing ${this.config.name} agent...`);

      // Agent-specific initialization
      await this.onInitialize();

      this.state.initialized = true;
      this.state.health.status = 'healthy';
      this.state.health.lastCheck = new Date().toISOString();

      this.log(`${this.config.name} agent initialized successfully`);
      return { success: true, agent: this.config.name };

    } catch (error) {
      this.log(`Failed to initialize ${this.config.name}: ${error.message}`, 'error');
      this.state.health.status = 'error';
      this.state.health.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Process request (to be implemented by subclasses)
   */
  async process(request, context = {}) {
    throw new Error('process() method must be implemented by subclass');
  }

  /**
   * Analyze request (to be implemented by subclasses)
   */
  async analyze(request, context = {}) {
    throw new Error('analyze() method must be implemented by subclass');
  }

  /**
   * Get agent health status
   */
  async getHealth() {
    try {
      // Agent-specific health check
      const agentHealth = await this.checkHealth();

      this.state.health = {
        ...this.state.health,
        ...agentHealth,
        lastCheck: new Date().toISOString(),
        status: this.state.health.errors.length > 0 ? 'degraded' : 'healthy'
      };

      return this.state.health;

    } catch (error) {
      this.state.health.status = 'error';
      this.state.health.errors.push(error.message);
      return this.state.health;
    }
  }

  /**
   * Get agent statistics
   */
  getStatistics() {
    const uptime = Date.now() - new Date(this.state.statistics.uptime).getTime();

    return {
      ...this.state.statistics,
      uptime: this.formatUptime(uptime),
      health: this.state.health,
      config: {
        name: this.config.name,
        version: this.config.version
      }
    };
  }

  /**
   * Log message with agent context
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.config.name}] [${level.toUpperCase()}] ${message}`;

    if (this.config.debug || level === 'error') {
      console.log(logMessage);
    }

    // Store in event handlers for logging
    this.emit('log', { timestamp, level, message, agent: this.config.name });
  }

  /**
   * Event handling
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Error in event handler for ${event}: ${error.message}`, 'error');
        }
      });
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async retry(operation, maxRetries = this.config.maxRetries) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.log(`Attempt ${attempt} failed: ${error.message}`, 'warn');

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format uptime
   */
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

  /**
   * Generate unique ID
   */
  generateId() {
    return `${this.config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize data for logging/storage
   */
  sanitize(data) {
    if (!data) return data;

    try {
      // Remove sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
      const sanitized = JSON.parse(JSON.stringify(data));

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
    } catch (error) {
      return '[SANITIZATION_ERROR]';
    }
  }

  /**
   * Performance monitoring
   */
  async withTiming(operation, operationName = 'operation') {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.state.statistics.requestsProcessed++;

      // Update average response time
      const totalTime = this.state.statistics.averageResponseTime * (this.state.statistics.requestsProcessed - 1) + duration;
      this.state.statistics.averageResponseTime = totalTime / this.state.statistics.requestsProcessed;

      this.log(`${operationName} completed in ${duration}ms`, 'debug');

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.state.statistics.errors++;
      this.log(`${operationName} failed after ${duration}ms: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(requiredFields = []) {
    const missing = requiredFields.filter(field => !this.config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  async onInitialize() {
    // Override in subclasses
  }

  async checkHealth() {
    // Override in subclasses
    return {
      status: 'healthy',
      checks: []
    };
  }

  async cleanup() {
    // Override in subclasses for cleanup tasks
    this.log(`Cleaning up ${this.config.name} agent`);
    this.state.initialized = false;
  }
}

export { LAMBaseAgent };
export default LAMBaseAgent;