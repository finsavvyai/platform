/**
 * Environment Variable Validation
 * P2-3 FIX: Validate all required environment variables at startup
 */

export class EnvironmentValidator {
  constructor() {
    this.required = [
      'DB',
      'CACHE',
      'JWT_SECRET',
      'LEMONSQUEEZY_API_KEY',
      'LEMONSQUEEZY_WEBHOOK_SECRET'
    ];

    this.optional = [
      'EMAIL_QUEUE',
      'ANTHROPIC_API_KEY',
      'ENVIRONMENT',
      'LOG_LEVEL'
    ];
  }

  /**
   * Validate environment variables
   * @param {Object} env - Environment object from Cloudflare Worker
   * @throws {Error} If validation fails
   */
  validate(env) {
    const errors = [];
    const warnings = [];

    // Check required variables
    for (const key of this.required) {
      if (!env[key]) {
        errors.push(`Missing required environment variable: ${key}`);
      } else {
        // Validate format based on key
        const validation = this.validateFormat(key, env[key]);
        if (!validation.valid) {
          errors.push(`Invalid ${key}: ${validation.error}`);
        }
      }
    }

    // Check optional variables
    for (const key of this.optional) {
      if (!env[key]) {
        warnings.push(`Optional environment variable not set: ${key}`);
      }
    }

    // Throw if there are errors
    if (errors.length > 0) {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    // Log warnings
    if (warnings.length > 0) {
      console.warn('Environment warnings:', warnings.join(', '));
    }

    return {
      valid: true,
      warnings
    };
  }

  /**
   * Validate format of specific environment variables
   */
  validateFormat(key, value) {
    switch (key) {
      case 'JWT_SECRET':
        if (value.length < 32) {
          return {
            valid: false,
            error: 'JWT_SECRET must be at least 32 characters for security'
          };
        }
        break;

      case 'LEMONSQUEEZY_API_KEY':
        if (!value.startsWith('lmsq_')) {
          return {
            valid: false,
            error: 'LEMONSQUEEZY_API_KEY should start with lmsq_'
          };
        }
        break;

      case 'ENVIRONMENT':
        const validEnvs = ['development', 'staging', 'production'];
        if (!validEnvs.includes(value)) {
          return {
            valid: false,
            error: `ENVIRONMENT must be one of: ${validEnvs.join(', ')}`
          };
        }
        break;

      case 'LOG_LEVEL':
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (!validLevels.includes(value.toLowerCase())) {
          return {
            valid: false,
            error: `LOG_LEVEL must be one of: ${validLevels.join(', ')}`
          };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Get environment summary for logging
   */
  getSummary(env) {
    return {
      environment: env.ENVIRONMENT || 'production',
      logLevel: env.LOG_LEVEL || 'info',
      hasCache: !!env.CACHE,
      hasDatabase: !!env.DB,
      hasEmailQueue: !!env.EMAIL_QUEUE,
      hasAIIntegration: !!env.ANTHROPIC_API_KEY
    };
  }
}

export default EnvironmentValidator;
