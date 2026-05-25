/**
 * Service Health Checker
 * 
 * Verifies that deployed services are operational by checking their health endpoints.
 * Implements health checks for Gateway, RAG, DLP, and LLM Gateway services.
 * 
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */

class ServiceHealthChecker {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.timeout = 5000; // 5 second timeout
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds between retries
  }

  /**
   * Check health of all services
   * @param {Array<Object>} services - Array of service configurations with URLs
   * @returns {Promise<Object>} Health check results
   */
  async checkAllServices(services) {
    this.logger.info('Checking health of all services...');
    
    const results = {
      overall: true,
      services: {},
      timestamp: new Date().toISOString()
    };

    for (const service of services) {
      const health = await this.checkService(service);
      results.services[service.name] = health;
      
      if (!health.healthy) {
        results.overall = false;
      }
    }

    return results;
  }

  /**
   * Check health of a single service
   * @param {Object} service - Service configuration
   * @returns {Promise<Object>} Health status
   */
  async checkService(service) {
    this.logger.info(`Checking health: ${service.name}`);
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const health = await this.performHealthCheck(service);
        
        if (health.healthy) {
          this.logger.success(`✓ ${service.name} is healthy (${health.responseTime}ms)`);
          return health;
        }
        
        lastError = new Error(`Health check returned unhealthy status: ${health.statusCode}`);
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          this.logger.warn(
            `Health check failed for ${service.name} (attempt ${attempt}/${this.maxRetries}): ${error.message}`
          );
          this.logger.info(`Retrying in ${this.retryDelay / 1000}s...`);
          await this.sleep(this.retryDelay);
        }
      }
    }

    // All retries failed
    this.logger.error(`✗ ${service.name} health check failed after ${this.maxRetries} attempts`);
    
    return {
      healthy: false,
      responseTime: 0,
      statusCode: 0,
      error: lastError.message,
      service: service.name
    };
  }

  /**
   * Perform a single health check request
   * @param {Object} service - Service configuration
   * @returns {Promise<Object>} Health status
   */
  async performHealthCheck(service) {
    const url = this.buildHealthCheckUrl(service);
    const startTime = Date.now();

    try {
      const response = await this.makeRequest(url);
      const responseTime = Date.now() - startTime;

      // Check if response is successful (HTTP 200)
      const healthy = response.status === 200;

      return {
        healthy,
        responseTime,
        statusCode: response.status,
        service: service.name,
        url: url
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      throw new Error(
        `Health check request failed: ${error.message} (${responseTime}ms)`
      );
    }
  }

  /**
   * Build health check URL for a service
   * @param {Object} service - Service configuration
   * @returns {string} Health check URL
   */
  buildHealthCheckUrl(service) {
    // Use the service URL and append health check endpoint
    const baseUrl = service.url || this.getDefaultServiceUrl(service.name);
    const endpoint = service.healthCheckEndpoint || '/health';
    
    // Ensure URL has protocol
    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    
    // Combine base URL and endpoint
    return `${url}${endpoint}`;
  }

  /**
   * Get default service URL based on Cloudflare Workers naming
   * @param {string} serviceName - Name of the service
   * @returns {string} Default service URL
   */
  getDefaultServiceUrl(serviceName) {
    const accountId = this.config.accountId || 'unknown';
    const subdomain = this.config.workersSubdomain || 'workers';
    
    // Cloudflare Workers default URL format
    return `https://${serviceName}.${subdomain}.dev`;
  }

  /**
   * Make HTTP request with timeout
   * @param {string} url - URL to request
   * @returns {Promise<Object>} Response object
   */
  async makeRequest(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SDLC-Deployment-Health-Checker/1.0'
        }
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Check Gateway service health
   * @param {string} url - Gateway service URL
   * @returns {Promise<Object>} Health status
   */
  async checkGateway(url) {
    return await this.checkService({
      name: 'gateway',
      url: url,
      healthCheckEndpoint: '/api/health'
    });
  }

  /**
   * Check RAG service health
   * @param {string} url - RAG service URL
   * @returns {Promise<Object>} Health status
   */
  async checkRAGService(url) {
    return await this.checkService({
      name: 'rag',
      url: url,
      healthCheckEndpoint: '/api/rag/health'
    });
  }

  /**
   * Check DLP service health
   * @param {string} url - DLP service URL
   * @returns {Promise<Object>} Health status
   */
  async checkDLPService(url) {
    return await this.checkService({
      name: 'dlp',
      url: url,
      healthCheckEndpoint: '/api/dlp/health'
    });
  }

  /**
   * Check LLM Gateway health
   * @param {string} url - LLM Gateway URL
   * @returns {Promise<Object>} Health status
   */
  async checkLLMGateway(url) {
    return await this.checkService({
      name: 'llm-gateway',
      url: url,
      healthCheckEndpoint: '/api/llm/health'
    });
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set timeout for health checks
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.timeout = timeout;
  }

  /**
   * Set maximum retries
   * @param {number} retries - Maximum number of retries
   */
  setMaxRetries(retries) {
    this.maxRetries = retries;
  }

  /**
   * Set retry delay
   * @param {number} delay - Delay in milliseconds
   */
  setRetryDelay(delay) {
    this.retryDelay = delay;
  }
}

module.exports = { ServiceHealthChecker };
