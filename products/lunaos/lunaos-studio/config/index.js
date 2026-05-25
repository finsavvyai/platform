/**
 * Environment Configuration
 * Manages environment-specific settings
 * Requirements: 1.4, 6.1, 6.2 - Use environment variables for configuration
 */

import developmentConfig from './development.js';
import stagingConfig from './staging.js';
import productionConfig from './production.js';
import { validateConfigSchema } from './schema.js';
import { validateStartupConfig, createSafeConfig } from './validator.js';

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable key
 * @param {*} defaultValue - Default value if not found
 * @returns {*}
 */
function getEnvVar(key, defaultValue = '') {
  // Vite exposes env vars with VITE_ prefix
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Environment configurations
 */
const environments = {
  development: {
    ...developmentConfig,
    // Override with environment variables
    apiUrl: getEnvVar('VITE_API_URL', developmentConfig.apiUrl),
    sentryDSN: getEnvVar('VITE_SENTRY_DSN', null),
    datadogAppId: getEnvVar('VITE_DATADOG_APP_ID', null),
    datadogClientToken: getEnvVar('VITE_DATADOG_CLIENT_TOKEN', null),
    logLevel: getEnvVar('VITE_LOG_LEVEL', developmentConfig.logLevel),
    enableAnalytics: getEnvVar('VITE_ENABLE_ANALYTICS', 'false') === 'true',
    featureFlags: {
      ...developmentConfig.featureFlags,
      aiAssistant: getEnvVar('VITE_ENABLE_AI_ASSISTANT', 'true') === 'true',
      collaboration: getEnvVar('VITE_ENABLE_COLLABORATION', 'true') === 'true',
      gamification: getEnvVar('VITE_ENABLE_GAMIFICATION', 'false') === 'true'
    }
  },
  
  staging: {
    ...stagingConfig,
    // Override with environment variables
    apiUrl: getEnvVar('VITE_API_URL', stagingConfig.apiUrl),
    sentryDSN: getEnvVar('VITE_SENTRY_DSN', null),
    datadogAppId: getEnvVar('VITE_DATADOG_APP_ID', null),
    datadogClientToken: getEnvVar('VITE_DATADOG_CLIENT_TOKEN', null),
    logLevel: getEnvVar('VITE_LOG_LEVEL', stagingConfig.logLevel),
    enableAnalytics: getEnvVar('VITE_ENABLE_ANALYTICS', 'true') === 'true',
    featureFlags: {
      ...stagingConfig.featureFlags,
      aiAssistant: getEnvVar('VITE_ENABLE_AI_ASSISTANT', 'true') === 'true',
      collaboration: getEnvVar('VITE_ENABLE_COLLABORATION', 'true') === 'true',
      gamification: getEnvVar('VITE_ENABLE_GAMIFICATION', 'true') === 'true'
    }
  },
  
  production: {
    ...productionConfig,
    // Override with environment variables
    apiUrl: getEnvVar('VITE_API_URL', productionConfig.apiUrl),
    sentryDSN: getEnvVar('VITE_SENTRY_DSN', null),
    datadogAppId: getEnvVar('VITE_DATADOG_APP_ID', null),
    datadogClientToken: getEnvVar('VITE_DATADOG_CLIENT_TOKEN', null),
    logLevel: getEnvVar('VITE_LOG_LEVEL', productionConfig.logLevel),
    enableAnalytics: getEnvVar('VITE_ENABLE_ANALYTICS', 'true') === 'true',
    featureFlags: {
      ...productionConfig.featureFlags,
      aiAssistant: getEnvVar('VITE_ENABLE_AI_ASSISTANT', 'true') === 'true',
      collaboration: getEnvVar('VITE_ENABLE_COLLABORATION', 'true') === 'true',
      gamification: getEnvVar('VITE_ENABLE_GAMIFICATION', 'true') === 'true'
    }
  }
};

/**
 * Get current environment
 * @returns {string}
 */
function getCurrentEnvironment() {
  const nodeEnv = getEnvVar('VITE_NODE_ENV', getEnvVar('MODE', 'development'));
  
  // Map Vite modes to our environments
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'staging') return 'staging';
  return 'development';
}

/**
 * Get configuration for current environment
 * @returns {object}
 */
function getConfig() {
  const environment = getCurrentEnvironment();
  const config = environments[environment];
  
  if (!config) {
    console.warn(`Unknown environment: ${environment}, falling back to development`);
    return environments.development;
  }
  
  return {
    ...config,
    environment,
    isDevelopment: environment === 'development',
    isStaging: environment === 'staging',
    isProduction: environment === 'production'
  };
}

/**
 * Legacy validation function (kept for backward compatibility)
 * @param {object} config
 * @returns {object} Validation result
 */
function validateConfig(config) {
  // Use the new schema validation
  return validateConfigSchema(config);
}

// Export configuration
export const config = getConfig();

// Validate configuration on startup
try {
  validateStartupConfig(config, {
    throwOnError: true,
    logWarnings: true,
    generateDocs: config.isDevelopment
  });
  
  // Log safe configuration in development
  if (config.isDevelopment) {
    const safeConfig = createSafeConfig(config);
    // eslint-disable-next-line no-console
    console.log('📋 Configuration loaded:', safeConfig);
  }
  
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('💥 Configuration validation failed:', error.message);
  
  if (config.isDevelopment) {
    // eslint-disable-next-line no-console
    console.error('🔧 Fix the configuration errors above and restart the application');
  }
  
  throw error;
}

// Export utilities
export { getEnvVar, getCurrentEnvironment, validateConfig };
export { validateStartupConfig, createSafeConfig } from './validator.js';
export { validateConfigSchema, generateConfigDocs } from './schema.js';

// Make config available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.appConfig = config;
}
