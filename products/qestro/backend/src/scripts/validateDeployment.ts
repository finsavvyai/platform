#!/usr/bin/env tsx

import { logger } from '../utils/logger.js';
import { healthCheckService } from '../services/HealthCheckService.js';
import { deploymentConfigService } from '../services/DeploymentConfigService.js';
import { checkDatabaseHealth } from '../lib/db.js';

interface ValidationResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class DeploymentValidator {
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<boolean> {
    logger.info('Starting deployment validation...');

    // Run all validation checks
    await this.validateEnvironmentVariables();
    await this.validateDatabaseConnection();
    await this.validateRedisConnection();
    await this.validateExternalServices();
    await this.validateHealthChecks();
    await this.validateConfiguration();
    await this.validateFeatureFlags();

    // Generate report
    this.generateReport();

    // Return overall status
    const failures = this.results.filter(r => r.status === 'fail');
    return failures.length === 0;
  }

  private async validateEnvironmentVariables(): Promise<void> {
    const requiredVars = [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'JWT_SECRET',
      'CORS_ORIGIN'
    ];

    const optionalVars = [
      'REDIS_URL',
      'OPENAI_API_KEY',
      'LEMONSQUEEZY_API_KEY',
      'SMTP_USER',
      'SMTP_PASS'
    ];

    // Check required variables
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        this.results.push({
          check: 'Environment Variables',
          status: 'fail',
          message: `Required environment variable ${varName} is not set`
        });
      } else {
        this.results.push({
          check: 'Environment Variables',
          status: 'pass',
          message: `Required environment variable ${varName} is set`
        });
      }
    }

    // Check optional variables
    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        this.results.push({
          check: 'Environment Variables',
          status: 'warning',
          message: `Optional environment variable ${varName} is not set - some features may be disabled`
        });
      } else {
        this.results.push({
          check: 'Environment Variables',
          status: 'pass',
          message: `Optional environment variable ${varName} is set`
        });
      }
    }
  }

  private async validateDatabaseConnection(): Promise<void> {
    try {
      const isHealthy = await checkDatabaseHealth();
      
      if (isHealthy) {
        this.results.push({
          check: 'Database Connection',
          status: 'pass',
          message: 'Database connection is healthy'
        });
      } else {
        this.results.push({
          check: 'Database Connection',
          status: 'fail',
          message: 'Database connection failed'
        });
      }
    } catch (error) {
      this.results.push({
        check: 'Database Connection',
        status: 'fail',
        message: 'Database connection validation failed',
        details: error.message
      });
    }
  }

  private async validateRedisConnection(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        this.results.push({
          check: 'Redis Connection',
          status: 'warning',
          message: 'Redis URL not configured - caching and real-time features will be disabled'
        });
        return;
      }

      const Redis = (await import('redis')).default;
      const client = Redis.createClient({ url: redisUrl });
      
      await client.connect();
      const pong = await client.ping();
      await client.quit();

      if (pong === 'PONG') {
        this.results.push({
          check: 'Redis Connection',
          status: 'pass',
          message: 'Redis connection is healthy'
        });
      } else {
        this.results.push({
          check: 'Redis Connection',
          status: 'fail',
          message: 'Redis ping failed'
        });
      }
    } catch (error) {
      this.results.push({
        check: 'Redis Connection',
        status: 'fail',
        message: 'Redis connection validation failed',
        details: error.message
      });
    }
  }

  private async validateExternalServices(): Promise<void> {
    // Validate OpenAI API
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      if (openaiKey.startsWith('sk-') && openaiKey.length > 20) {
        this.results.push({
          check: 'OpenAI API',
          status: 'pass',
          message: 'OpenAI API key format is valid'
        });
      } else {
        this.results.push({
          check: 'OpenAI API',
          status: 'fail',
          message: 'OpenAI API key format is invalid'
        });
      }
    } else {
      this.results.push({
        check: 'OpenAI API',
        status: 'warning',
        message: 'OpenAI API key not configured - AI features will be disabled'
      });
    }

    // Validate LemonSqueezy API
    const lemonSqueezyKey = process.env.LEMONSQUEEZY_API_KEY;
    if (lemonSqueezyKey) {
      this.results.push({
        check: 'LemonSqueezy API',
        status: 'pass',
        message: 'LemonSqueezy API key is configured'
      });
    } else {
      this.results.push({
        check: 'LemonSqueezy API',
        status: 'warning',
        message: 'LemonSqueezy API key not configured - payment features will be disabled'
      });
    }

    // Validate SMTP configuration
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      this.results.push({
        check: 'SMTP Configuration',
        status: 'pass',
        message: 'SMTP configuration is complete'
      });
    } else {
      this.results.push({
        check: 'SMTP Configuration',
        status: 'warning',
        message: 'SMTP configuration incomplete - email features may not work'
      });
    }
  }

  private async validateHealthChecks(): Promise<void> {
    try {
      const healthStatus = await healthCheckService.checkSystemHealth();
      
      const unhealthyServices = healthStatus.services.filter(s => s.status === 'unhealthy');
      const degradedServices = healthStatus.services.filter(s => s.status === 'degraded');

      if (unhealthyServices.length === 0) {
        this.results.push({
          check: 'Health Checks',
          status: 'pass',
          message: 'All health checks are passing',
          details: {
            totalServices: healthStatus.services.length,
            healthyServices: healthStatus.services.filter(s => s.status === 'healthy').length,
            degradedServices: degradedServices.length
          }
        });
      } else {
        this.results.push({
          check: 'Health Checks',
          status: 'fail',
          message: `${unhealthyServices.length} health checks are failing`,
          details: {
            unhealthyServices: unhealthyServices.map(s => s.service),
            degradedServices: degradedServices.map(s => s.service)
          }
        });
      }
    } catch (error) {
      this.results.push({
        check: 'Health Checks',
        status: 'fail',
        message: 'Health check validation failed',
        details: error.message
      });
    }
  }

  private async validateConfiguration(): Promise<void> {
    try {
      const config = deploymentConfigService.getConfig();
      const isReady = await deploymentConfigService.isDeploymentReady();

      if (isReady) {
        this.results.push({
          check: 'Deployment Configuration',
          status: 'pass',
          message: 'Deployment configuration is valid and ready',
          details: {
            environment: config.environment,
            version: config.version,
            features: Object.keys(config.features).filter(f => config.features[f])
          }
        });
      } else {
        this.results.push({
          check: 'Deployment Configuration',
          status: 'fail',
          message: 'Deployment configuration validation failed'
        });
      }
    } catch (error) {
      this.results.push({
        check: 'Deployment Configuration',
        status: 'fail',
        message: 'Configuration validation failed',
        details: error.message
      });
    }
  }

  private async validateFeatureFlags(): Promise<void> {
    const config = deploymentConfigService.getConfig();
    const enabledFeatures = Object.keys(config.features).filter(f => config.features[f]);
    const disabledFeatures = Object.keys(config.features).filter(f => !config.features[f]);

    this.results.push({
      check: 'Feature Flags',
      status: 'pass',
      message: `Feature flags configured: ${enabledFeatures.length} enabled, ${disabledFeatures.length} disabled`,
      details: {
        enabled: enabledFeatures,
        disabled: disabledFeatures
      }
    });

    // Validate feature dependencies
    if (config.features.zeroSync && !process.env.REDIS_URL) {
      this.results.push({
        check: 'Feature Dependencies',
        status: 'warning',
        message: 'Zero-sync feature enabled but Redis not configured'
      });
    }

    if (config.features.aiGeneration && !process.env.OPENAI_API_KEY) {
      this.results.push({
        check: 'Feature Dependencies',
        status: 'warning',
        message: 'AI generation feature enabled but OpenAI API key not configured'
      });
    }
  }

  private generateReport(): void {
    const passCount = this.results.filter(r => r.status === 'pass').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;

    logger.info('='.repeat(60));
    logger.info('DEPLOYMENT VALIDATION REPORT');
    logger.info('='.repeat(60));
    logger.info(`Total Checks: ${this.results.length}`);
    logger.info(`✅ Passed: ${passCount}`);
    logger.info(`❌ Failed: ${failCount}`);
    logger.info(`⚠️  Warnings: ${warningCount}`);
    logger.info('='.repeat(60));

    // Group results by check type
    const groupedResults = this.results.reduce((acc, result) => {
      if (!acc[result.check]) {
        acc[result.check] = [];
      }
      acc[result.check].push(result);
      return acc;
    }, {} as Record<string, ValidationResult[]>);

    // Print detailed results
    for (const [checkType, results] of Object.entries(groupedResults)) {
      logger.info(`\n${checkType}:`);
      for (const result of results) {
        const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
        logger.info(`  ${icon} ${result.message}`);
        if (result.details) {
          logger.info(`     Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      }
    }

    logger.info('\n' + '='.repeat(60));
    
    if (failCount === 0) {
      logger.info('🎉 DEPLOYMENT VALIDATION PASSED');
      logger.info('The application is ready for production deployment!');
    } else {
      logger.error('💥 DEPLOYMENT VALIDATION FAILED');
      logger.error(`Please fix ${failCount} failing checks before deploying.`);
    }
    
    logger.info('='.repeat(60));
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  
  validator.runAllValidations()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('Deployment validation failed with error:', error);
      process.exit(1);
    });
}

export { DeploymentValidator };