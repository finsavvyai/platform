/**
 * Deployment configuration parser
 */

const fs = require('fs');
const path = require('path');

class DeploymentConfig {
  constructor(args) {
    this.environment = args.environment || 'development';
    this.dryRun = args.dryRun || false;
    this.skipSteps = args.skipSteps || [];
    this.autoRollback = args.autoRollback !== false;
    
    // Load configuration from file if provided
    if (args.config) {
      this.loadFromFile(args.config);
    } else {
      this.loadDefaults();
    }

    // Load environment variables
    this.loadEnvironmentVariables();
  }

  /**
   * Load configuration from file
   * @param {string} configPath - Path to configuration file
   */
  loadFromFile(configPath) {
    try {
      const fullPath = path.resolve(configPath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Configuration file not found: ${fullPath}`);
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const config = JSON.parse(content);

      // Merge file configuration
      Object.assign(this, config);

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load default configuration
   */
  loadDefaults() {
    this.region = 'auto';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.customDomain = process.env.CUSTOM_DOMAIN || null;
    this.enableSSL = true;
    
    // Service configuration
    this.services = [
      { name: 'gateway', path: './services/gateway', healthCheck: '/api/health' },
      { name: 'rag', path: './services/rag', healthCheck: '/api/rag/health' },
      { name: 'dlp', path: './services/dlp', healthCheck: '/api/dlp/health' },
      { name: 'llm-gateway', path: './services/llm-gateway', healthCheck: '/api/llm/health' },
      { name: 'lam-system', path: './services/lam-system', healthCheck: '/api/lam/health' },
      { name: 'admin-ui', path: './services/admin-ui', healthCheck: '/health' }
    ];

    // Database configuration
    this.databases = [
      { name: 'primary', type: 'd1' },
      { name: 'events', type: 'd1' },
      { name: 'read-replica', type: 'd1' }
    ];

    // Storage configuration
    this.storage = {
      documents: { type: 'r2', name: 'documents' },
      embeddings: { type: 'r2', name: 'embeddings' },
      auditLogs: { type: 'r2', name: 'audit-logs' }
    };

    // Cache configuration
    this.cache = {
      sessions: { type: 'kv', name: 'sessions' },
      rateLimits: { type: 'kv', name: 'rate-limits' },
      cache: { type: 'kv', name: 'cache' }
    };

    // Vector database configuration
    this.vectorize = {
      name: 'embeddings',
      dimensions: 1536,
      metric: 'cosine'
    };

    // Queue configuration
    this.queues = [
      { name: 'processing', type: 'queue' }
    ];
  }

  /**
   * Load and validate environment variables
   */
  loadEnvironmentVariables() {
    const required = [];
    const optional = [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'CUSTOM_DOMAIN'
    ];

    // Check required variables
    for (const varName of required) {
      if (!process.env[varName]) {
        throw new Error(`Required environment variable not set: ${varName}`);
      }
    }

    // Load optional variables
    for (const varName of optional) {
      if (process.env[varName]) {
        const key = this.envVarToConfigKey(varName);
        this[key] = process.env[varName];
      }
    }
  }

  /**
   * Convert environment variable name to config key
   * @param {string} envVar - Environment variable name
   * @returns {string} Config key
   */
  envVarToConfigKey(envVar) {
    return envVar
      .toLowerCase()
      .replace(/^cloudflare_/, '')
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Validate configuration
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validate environment
    if (!['development', 'staging', 'production'].includes(this.environment)) {
      errors.push(`Invalid environment: ${this.environment}`);
    }

    // Validate Cloudflare credentials for non-dry-run
    if (!this.dryRun) {
      if (!this.accountId) {
        warnings.push('CLOUDFLARE_ACCOUNT_ID not set');
      }
      if (!this.apiToken) {
        warnings.push('CLOUDFLARE_API_TOKEN not set');
      }
    }

    // Validate services
    if (!this.services || this.services.length === 0) {
      errors.push('No services configured');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getSummary() {
    return {
      environment: this.environment,
      dryRun: this.dryRun,
      autoRollback: this.autoRollback,
      skipSteps: this.skipSteps,
      serviceCount: this.services.length,
      databaseCount: this.databases.length
    };
  }
}

module.exports = { DeploymentConfig };
