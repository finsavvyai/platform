/**
 * Configuration Validator
 * Provides startup validation and error handling for configuration
 * Requirements: 6.5 - Configuration validation with error handling
 */

import { validateConfigSchema, generateConfigDocs } from './schema.js';

/**
 * Configuration validation error class
 */
export class ConfigValidationError extends Error {
  constructor(errors, warnings = []) {
    const message = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    super(message);
    this.name = 'ConfigValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

/**
 * Validate configuration on startup
 * @param {object} config - Configuration to validate
 * @param {object} options - Validation options
 * @returns {object} Validation result
 */
export function validateStartupConfig(config, options = {}) {
  const {
    throwOnError = true,
    logWarnings = true,
    generateDocs = false
  } = options;
  
  try {
    // Perform schema validation
    const result = validateConfigSchema(config);
    
    // Handle validation errors
    if (!result.valid) {
      const errorMessage = `Configuration validation failed with ${result.errors.length} error(s)`;
      
      if (config.isDevelopment) {
        // eslint-disable-next-line no-console
        console.error('❌ Configuration Validation Failed');
        // eslint-disable-next-line no-console
        console.error('Errors:');
        // eslint-disable-next-line no-console
        result.errors.forEach(error => console.error(`  - ${error}`));
        
        if (result.warnings.length > 0) {
          // eslint-disable-next-line no-console
          console.warn('Warnings:');
          // eslint-disable-next-line no-console
          result.warnings.forEach(warning => console.warn(`  - ${warning}`));
        }
        
        if (generateDocs) {
          // eslint-disable-next-line no-console
          console.log('\n📖 Configuration Documentation:');
          // eslint-disable-next-line no-console
          console.log(generateConfigDocs());
        }
      }
      
      if (throwOnError) {
        throw new ConfigValidationError(result.errors, result.warnings);
      }
      
      return {
        ...result,
        message: errorMessage
      };
    }
    
    // Handle warnings
    if (result.warnings.length > 0 && logWarnings) {
      if (config.isDevelopment) {
        // eslint-disable-next-line no-console
        console.warn('⚠️  Configuration Warnings:');
        // eslint-disable-next-line no-console
        result.warnings.forEach(warning => console.warn(`  - ${warning}`));
      } else {
        // In production, log warnings but don't spam console
        // eslint-disable-next-line no-console
        console.warn(`Configuration loaded with ${result.warnings.length} warning(s)`);
      }
    }
    
    // Success message
    if (config.isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('✅ Configuration validation passed');
    }
    
    return {
      ...result,
      message: 'Configuration validation passed'
    };
    
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }
    
    // Unexpected validation error
    const validationError = new ConfigValidationError(
      [`Unexpected validation error: ${error.message}`],
      []
    );
    
    if (throwOnError) {
      throw validationError;
    }
    
    return {
      valid: false,
      errors: validationError.errors,
      warnings: [],
      message: validationError.message
    };
  }
}

/**
 * Create a safe configuration object for logging
 * Removes sensitive information like tokens and DSNs
 * @param {object} config - Full configuration
 * @returns {object} Safe configuration for logging
 */
export function createSafeConfig(config) {
  const safeConfig = { ...config };
  
  // Remove or mask sensitive fields
  if (safeConfig.sentryDSN) {
    safeConfig.sentryDSN = '***masked***';
  }
  
  if (safeConfig.datadogClientToken) {
    safeConfig.datadogClientToken = '***masked***';
  }
  
  // Add metadata about sensitive fields
  safeConfig._metadata = {
    hasSentryDSN: !!config.sentryDSN,
    hasDatadogConfig: !!(config.datadogAppId && config.datadogClientToken),
    configuredAt: new Date().toISOString(),
    validationPassed: true
  };
  
  return safeConfig;
}

/**
 * Validate configuration and provide helpful error messages
 * @param {object} config - Configuration to validate
 * @returns {object} Enhanced validation result
 */
export function validateWithHelp(config) {
  const result = validateConfigSchema(config);
  
  if (!result.valid) {
    // Enhance error messages with helpful suggestions
    const enhancedErrors = result.errors.map(error => {
      let suggestion = '';
      
      if (error.includes('apiUrl')) {
        suggestion = ' (Check your .env file or environment variables)';
      } else if (error.includes('HTTPS')) {
        suggestion = ' (Set VITE_API_URL to use https:// protocol)';
      } else if (error.includes('sentryDSN')) {
        suggestion = ' (Set VITE_SENTRY_DSN environment variable)';
      } else if (error.includes('logLevel')) {
        suggestion = ' (Use: debug, info, warn, or error)';
      }
      
      return error + suggestion;
    });
    
    return {
      ...result,
      errors: enhancedErrors
    };
  }
  
  return result;
}

/**
 * Configuration health check
 * Performs runtime validation of configuration values
 * @param {object} config - Configuration to check
 * @returns {Promise<object>} Health check result
 */
export async function configHealthCheck(config) {
  const checks = [];
  
  // Check API connectivity
  if (config.apiUrl) {
    try {
      const response = await fetch(`${config.apiUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      checks.push({
        name: 'API Connectivity',
        status: response.ok ? 'healthy' : 'unhealthy',
        message: response.ok ? 'API is reachable' : `API returned ${response.status}`
      });
    } catch (error) {
      checks.push({
        name: 'API Connectivity',
        status: 'unhealthy',
        message: `API unreachable: ${error.message}`
      });
    }
  }
  
  // Check Sentry connectivity (if configured)
  if (config.sentryDSN) {
    checks.push({
      name: 'Error Tracking',
      status: 'healthy',
      message: 'Sentry DSN configured'
    });
  }
  
  // Check DataDog configuration
  if (config.datadogAppId && config.datadogClientToken) {
    checks.push({
      name: 'Performance Monitoring',
      status: 'healthy',
      message: 'DataDog RUM configured'
    });
  }
  
  const healthyChecks = checks.filter(c => c.status === 'healthy').length;
  const totalChecks = checks.length;
  
  return {
    overall: healthyChecks === totalChecks ? 'healthy' : 'degraded',
    score: totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100,
    checks,
    timestamp: new Date().toISOString()
  };
}

/**
 * Export configuration validation utilities
 */
export default {
  validateStartupConfig,
  validateWithHelp,
  createSafeConfig,
  configHealthCheck,
  ConfigValidationError
};