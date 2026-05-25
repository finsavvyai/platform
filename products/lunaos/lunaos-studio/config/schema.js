/**
 * Configuration Schema
 * Defines the structure and validation rules for application configuration
 * Requirements: 6.5 - Configuration validation
 */

/**
 * Configuration schema definition
 */
export const configSchema = {
  // Environment identification
  environment: {
    type: 'string',
    required: true,
    enum: ['development', 'staging', 'production']
  },
  
  // API configuration
  apiUrl: {
    type: 'string',
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Base URL for API endpoints'
  },
  
  // Logging configuration
  logLevel: {
    type: 'string',
    required: true,
    enum: ['debug', 'info', 'warn', 'error'],
    description: 'Logging level for the application'
  },
  
  // Analytics configuration
  enableAnalytics: {
    type: 'boolean',
    required: true,
    description: 'Whether to enable analytics tracking'
  },
  
  // Security configuration
  security: {
    type: 'object',
    required: true,
    properties: {
      enforceHTTPS: {
        type: 'boolean',
        required: true,
        description: 'Whether to enforce HTTPS connections'
      },
      contentSecurityPolicy: {
        type: 'object',
        required: true,
        properties: {
          enabled: { type: 'boolean', required: true },
          reportOnly: { type: 'boolean', required: true }
        }
      },
      inputSanitization: {
        type: 'object',
        required: true,
        properties: {
          enabled: { type: 'boolean', required: true },
          allowedTags: { type: 'array', required: true },
          allowedAttributes: { type: 'array', required: true }
        }
      }
    }
  },
  
  // Performance configuration
  performance: {
    type: 'object',
    required: true,
    properties: {
      enableServiceWorker: { type: 'boolean', required: true },
      enableCodeSplitting: { type: 'boolean', required: true },
      enableCompression: { type: 'boolean', required: true },
      maxBundleSize: { type: 'number', required: true, min: 1 },
      targetFPS: { type: 'number', required: true, min: 30, max: 120 }
    }
  },
  
  // Feature flags
  featureFlags: {
    type: 'object',
    required: true,
    properties: {
      aiAssistant: { type: 'boolean', required: true },
      collaboration: { type: 'boolean', required: true },
      gamification: { type: 'boolean', required: true },
      advancedNodes: { type: 'boolean', required: true },
      themeCustomization: { type: 'boolean', required: true },
      exportFormats: { type: 'boolean', required: true }
    }
  },
  
  // Monitoring configuration (optional)
  sentryDSN: {
    type: 'string',
    required: false,
    pattern: /^https:\/\/[a-f0-9]+@[a-z0-9.-]+\/[0-9]+$/,
    description: 'Sentry DSN for error tracking'
  },
  
  datadogAppId: {
    type: 'string',
    required: false,
    description: 'DataDog application ID for RUM'
  },
  
  datadogClientToken: {
    type: 'string',
    required: false,
    description: 'DataDog client token for RUM'
  }
};

/**
 * Environment-specific validation rules
 */
export const environmentRules = {
  production: {
    // Production-specific requirements
    required: ['sentryDSN'],
    constraints: {
      'security.enforceHTTPS': true,
      'logLevel': { not: 'debug' },
      'apiUrl': { protocol: 'https' }
    },
    warnings: {
      'datadogAppId': 'DataDog monitoring recommended for production',
      'datadogClientToken': 'DataDog monitoring recommended for production'
    }
  },
  
  staging: {
    // Staging-specific requirements
    constraints: {
      'security.enforceHTTPS': true,
      'apiUrl': { protocol: 'https' }
    },
    warnings: {
      'sentryDSN': 'Error tracking recommended for staging'
    }
  },
  
  development: {
    // Development allows more flexibility
    constraints: {},
    warnings: {}
  }
};

/**
 * Validate a value against a schema property
 * @param {*} value - Value to validate
 * @param {object} schema - Schema property definition
 * @param {string} path - Property path for error messages
 * @returns {object} Validation result
 */
function validateProperty(value, schema, path) {
  const errors = [];
  const warnings = [];
  
  // Check if required
  if (schema.required && (value === undefined || value === null)) {
    errors.push(`${path} is required`);
    return { errors, warnings };
  }
  
  // Skip further validation if value is undefined/null and not required
  if (value === undefined || value === null) {
    return { errors, warnings };
  }
  
  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      errors.push(`${path} must be of type ${schema.type}, got ${actualType}`);
      return { errors, warnings };
    }
  }
  
  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
  }
  
  // Pattern validation
  if (schema.pattern && typeof value === 'string' && !schema.pattern.test(value)) {
    errors.push(`${path} does not match required pattern`);
  }
  
  // Number constraints
  if (typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push(`${path} must be at least ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      errors.push(`${path} must be at most ${schema.max}`);
    }
  }
  
  // Object validation
  if (schema.type === 'object' && schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = `${path}.${propName}`;
      const propResult = validateProperty(value[propName], propSchema, propPath);
      errors.push(...propResult.errors);
      warnings.push(...propResult.warnings);
    }
  }
  
  return { errors, warnings };
}

/**
 * Validate configuration against schema
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result
 */
export function validateConfigSchema(config) {
  const errors = [];
  const warnings = [];
  
  // Validate against base schema
  for (const [key, schema] of Object.entries(configSchema)) {
    const result = validateProperty(config[key], schema, key);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  
  // Apply environment-specific rules
  const envRules = environmentRules[config.environment];
  if (envRules) {
    // Check environment-specific required fields
    if (envRules.required) {
      for (const field of envRules.required) {
        if (!config[field]) {
          errors.push(`${field} is required in ${config.environment} environment`);
        }
      }
    }
    
    // Check environment-specific constraints
    if (envRules.constraints) {
      for (const [path, constraint] of Object.entries(envRules.constraints)) {
        const value = getNestedValue(config, path);
        
        if (typeof constraint === 'boolean' && value !== constraint) {
          errors.push(`${path} must be ${constraint} in ${config.environment} environment`);
        }
        
        if (constraint.not && value === constraint.not) {
          errors.push(`${path} cannot be ${constraint.not} in ${config.environment} environment`);
        }
        
        if (constraint.protocol && typeof value === 'string') {
          const url = new URL(value);
          if (url.protocol !== `${constraint.protocol}:`) {
            errors.push(`${path} must use ${constraint.protocol} protocol in ${config.environment} environment`);
          }
        }
      }
    }
    
    // Check environment-specific warnings
    if (envRules.warnings) {
      for (const [field, message] of Object.entries(envRules.warnings)) {
        if (!config[field]) {
          warnings.push(message);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get nested value from object using dot notation
 * @param {object} obj - Object to search
 * @param {string} path - Dot-separated path
 * @returns {*} Value at path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Generate configuration documentation
 * @returns {string} Markdown documentation
 */
export function generateConfigDocs() {
  let docs = '# Configuration Schema\n\n';
  docs += 'This document describes the configuration options for LunaOS Studio.\n\n';
  
  for (const [key, schema] of Object.entries(configSchema)) {
    docs += `## ${key}\n\n`;
    docs += `- **Type**: ${schema.type}\n`;
    docs += `- **Required**: ${schema.required ? 'Yes' : 'No'}\n`;
    
    if (schema.description) {
      docs += `- **Description**: ${schema.description}\n`;
    }
    
    if (schema.enum) {
      docs += `- **Valid values**: ${schema.enum.join(', ')}\n`;
    }
    
    if (schema.pattern) {
      docs += `- **Pattern**: ${schema.pattern}\n`;
    }
    
    if (schema.min !== undefined || schema.max !== undefined) {
      docs += `- **Range**: ${schema.min ?? 'any'} to ${schema.max ?? 'any'}\n`;
    }
    
    docs += '\n';
  }
  
  return docs;
}