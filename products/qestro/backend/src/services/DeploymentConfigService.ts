import { logger } from '../utils/logger.js';

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  version: string;
  buildId?: string;
  deploymentId?: string;
  domains: {
    api: string;
    frontend: string;
    websocket: string;
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
  monitoring: {
    healthCheckPath: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    metricsEnabled: boolean;
    loggingLevel: string;
  };
  features: {
    [key: string]: boolean;
  };
}

class DeploymentConfigService {
  private config: DeploymentConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load deployment configuration from environment variables
   */
  private loadConfiguration(): DeploymentConfig {
    const environment = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';

    return {
      environment,
      version: process.env.npm_package_version || '1.0.0',
      buildId: process.env.RENDER_GIT_COMMIT || process.env.BUILD_ID,
      deploymentId: process.env.RENDER_SERVICE_ID || process.env.DEPLOYMENT_ID,

      domains: {
        api: process.env.API_BASE_URL || this.getDefaultApiUrl(environment),
        frontend: process.env.FRONTEND_URL || this.getDefaultFrontendUrl(environment),
        websocket: process.env.WS_URL || this.getDefaultWebSocketUrl(environment)
      },

      scaling: {
        minInstances: parseInt(process.env.MIN_INSTANCES || '1'),
        maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
        targetCPU: parseInt(process.env.TARGET_CPU_PERCENT || '70'),
        targetMemory: parseInt(process.env.TARGET_MEMORY_PERCENT || '80')
      },

      monitoring: {
        healthCheckPath: '/health',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
        healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '30000'),
        metricsEnabled: process.env.ENABLE_METRICS === 'true',
        loggingLevel: process.env.LOG_LEVEL || 'info'
      },

      features: {
        recording: process.env.ENABLE_RECORDING === 'true',
        mobileTestin: process.env.ENABLE_MOBILE_TESTING === 'true',
        webTesting: process.env.ENABLE_WEB_TESTING === 'true',
        aiGeneration: process.env.ENABLE_AI_GENERATION === 'true',
        pluginSystem: process.env.ENABLE_PLUGIN_SYSTEM === 'true',
        zeroSync: process.env.ENABLE_ZERO_SYNC === 'true',
        performanceMonitoring: process.env.PERFORMANCE_MONITORING === 'true'
      }
    };
  }

  /**
   * Validate the loaded configuration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // Validate scaling configuration
    if (this.config.scaling.minInstances > this.config.scaling.maxInstances) {
      errors.push('MIN_INSTANCES cannot be greater than MAX_INSTANCES');
    }

    if (this.config.scaling.targetCPU < 10 || this.config.scaling.targetCPU > 100) {
      errors.push('TARGET_CPU_PERCENT must be between 10 and 100');
    }

    if (this.config.scaling.targetMemory < 10 || this.config.scaling.targetMemory > 100) {
      errors.push('TARGET_MEMORY_PERCENT must be between 10 and 100');
    }

    // Validate monitoring configuration
    if (this.config.monitoring.healthCheckInterval < 10000) {
      errors.push('HEALTH_CHECK_INTERVAL must be at least 10000ms (10 seconds)');
    }

    if (this.config.monitoring.healthCheckTimeout < 5000) {
      errors.push('HEALTH_CHECK_TIMEOUT must be at least 5000ms (5 seconds)');
    }

    // Log warnings for production environment
    if (this.config.environment === 'production') {
      if (!process.env.REDIS_URL) {
        logger.warn('REDIS_URL not configured - some features may not work properly');
      }

      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OPENAI_API_KEY not configured - AI features will be disabled');
      }

      if (!process.env.LEMONSQUEEZY_API_KEY) {
        logger.warn('LEMONSQUEEZY_API_KEY not configured - payment features will be disabled');
      }
    }

    if (errors.length > 0) {
      logger.error('Configuration validation failed:', { errors });
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    logger.info('Deployment configuration validated successfully');
  }

  /**
   * Get the current deployment configuration
   */
  getConfig(): DeploymentConfig {
    return { ...this.config };
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName: string): boolean {
    return this.config.features[featureName] === true;
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig() {
    return {
      environment: this.config.environment,
      version: this.config.version,
      buildId: this.config.buildId,
      deploymentId: this.config.deploymentId,
      domains: this.config.domains,
      features: this.config.features
    };
  }

  /**
   * Get scaling configuration
   */
  getScalingConfig() {
    return { ...this.config.scaling };
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig() {
    return { ...this.config.monitoring };
  }

  /**
   * Generate deployment info for health checks
   */
  getDeploymentInfo() {
    return {
      environment: this.config.environment,
      version: this.config.version,
      buildId: this.config.buildId,
      deploymentId: this.config.deploymentId,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    };
  }

  /**
   * Check if the deployment is ready to serve traffic
   */
  async isDeploymentReady(): Promise<boolean> {
    try {
      // Check database connectivity
      if (!process.env.DATABASE_URL) {
        return false;
      }

      // Check required services based on enabled features
      if (this.isFeatureEnabled('zeroSync') && !process.env.REDIS_URL) {
        logger.warn('Zero-sync feature enabled but Redis not configured');
        return false;
      }

      // All checks passed
      return true;
    } catch (error) {
      logger.error('Deployment readiness check failed:', error);
      return false;
    }
  }

  /**
   * Get default API URL based on environment
   */
  private getDefaultApiUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return 'https://api.qestro.app';
      case 'staging':
        return 'https://staging-api.qestro.app';
      default:
        return 'http://localhost:3001';
    }
  }

  /**
   * Get default frontend URL based on environment
   */
  private getDefaultFrontendUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return 'https://qestro.app';
      case 'staging':
        return 'https://staging.qestro.app';
      default:
        return 'http://localhost:3000';
    }
  }

  /**
   * Get default WebSocket URL based on environment
   */
  private getDefaultWebSocketUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return 'wss://api.qestro.app';
      case 'staging':
        return 'wss://staging-api.qestro.app';
      default:
        return 'ws://localhost:3001';
    }
  }

  /**
   * Log deployment configuration (without sensitive data)
   */
  logConfiguration(): void {
    const safeConfig = {
      environment: this.config.environment,
      version: this.config.version,
      buildId: this.config.buildId,
      deploymentId: this.config.deploymentId,
      domains: this.config.domains,
      scaling: this.config.scaling,
      monitoring: {
        ...this.config.monitoring,
        // Don't log sensitive monitoring config
      },
      features: this.config.features
    };

    logger.info('Deployment configuration:', safeConfig);
  }
}

// Lazy singleton pattern - config is only loaded when first accessed
let _instance: DeploymentConfigService | null = null;

export const deploymentConfigService = {
  get instance() {
    if (!_instance) {
      _instance = new DeploymentConfigService();
    }
    return _instance;
  },

  // Proxy methods to the instance
  getConfig: () => deploymentConfigService.instance.getConfig(),
  isFeatureEnabled: (name: string) => deploymentConfigService.instance.isFeatureEnabled(name),
  getEnvironmentConfig: () => deploymentConfigService.instance.getEnvironmentConfig(),
  getScalingConfig: () => deploymentConfigService.instance.getScalingConfig(),
  getMonitoringConfig: () => deploymentConfigService.instance.getMonitoringConfig(),
  getDeploymentInfo: () => deploymentConfigService.instance.getDeploymentInfo(),
  isDeploymentReady: () => deploymentConfigService.instance.isDeploymentReady(),
  logConfiguration: () => deploymentConfigService.instance.logConfiguration(),
};