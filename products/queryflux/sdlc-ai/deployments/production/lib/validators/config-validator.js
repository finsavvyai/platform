/**
 * Configuration Validator Module
 * 
 * Validates deployment configuration including environment variables,
 * configuration files, and schema validation.
 */

const fs = require('fs');
const path = require('path');

class ConfigValidator {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Validate all configuration requirements
   * @returns {Promise<ValidationResult>}
   */
  async validateAll() {
    const errors = [];
    const warnings = [];

    this.logger.info('Validating configuration...');

    // Validate environment variables
    const envResult = await this.validateEnvironmentVariables();
    if (!envResult.valid) {
      errors.push(...envResult.errors);
    }
    if (envResult.warnings.length > 0) {
      warnings.push(...envResult.warnings);
    }

    // Parse configuration file
    const configResult = await this.parseConfigurationFile();
    if (!configResult.valid) {
      errors.push(...configResult.errors);
    }
    if (configResult.warnings.length > 0) {
      warnings.push(...configResult.warnings);
    }

    // Validate configuration schema
    const schemaResult = await this.validateConfigurationSchema();
    if (!schemaResult.valid) {
      errors.push(...schemaResult.errors);
    }
    if (schemaResult.warnings.length > 0) {
      warnings.push(...schemaResult.warnings);
    }

    const valid = errors.length === 0;

    if (valid) {
      this.logger.success('✓ Configuration validated');
    } else {
      this.logger.error(`✗ Configuration validation failed with ${errors.length} error(s)`);
    }

    return {
      valid,
      errors,
      warnings
    };
  }

  /**
   * Validate required environment variables
   * @returns {Promise<ValidationResult>}
   */
  async validateEnvironmentVariables() {
    const errors = [];
    const warnings = [];

    const requiredVars = [
      'CLOUDFLARE_ACCOUNT_ID'
    ];

    const optionalVars = [
      'CLOUDFLARE_API_TOKEN',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'GOOGLE_API_KEY'
    ];

    // Check required variables
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        errors.push(`Required environment variable ${varName} is not set`);
      } else {
        this.logger.info(`✓ ${varName} is set`);
      }
    }

    // Check optional variables
    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        warnings.push(`Optional environment variable ${varName} is not set`);
      } else {
        this.logger.info(`✓ ${varName} is set`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse and validate configuration file
   * @returns {Promise<ValidationResult>}
   */
  async parseConfigurationFile() {
    const errors = [];
    const warnings = [];

    try {
      // Check if .env file exists
      const envPath = path.join(process.cwd(), '.env.production');
      
      if (!fs.existsSync(envPath)) {
        warnings.push('.env.production file not found (using environment variables)');
        return { valid: true, errors, warnings };
      }

      // Read and parse .env file
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');

      let validLines = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Validate line format (KEY=VALUE)
        if (!trimmed.includes('=')) {
          warnings.push(`Invalid line in .env.production: ${trimmed.substring(0, 50)}`);
          continue;
        }

        validLines++;
      }

      this.logger.info(`✓ Configuration file parsed (${validLines} variables)`);
      return { valid: true, errors, warnings };

    } catch (error) {
      errors.push(`Failed to parse configuration file: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate configuration schema
   * @returns {Promise<ValidationResult>}
   */
  async validateConfigurationSchema() {
    const errors = [];
    const warnings = [];

    try {
      // Validate environment
      const validEnvironments = ['development', 'staging', 'production'];
      if (!validEnvironments.includes(this.config.environment)) {
        errors.push(
          `Invalid environment: ${this.config.environment}. Must be one of: ${validEnvironments.join(', ')}`
        );
      } else {
        this.logger.info(`✓ Environment: ${this.config.environment}`);
      }

      // Validate skipSteps if provided
      if (this.config.skipSteps && this.config.skipSteps.length > 0) {
        const validSteps = [
          'pre-deployment-validation',
          'infrastructure-provisioning',
          'secret-management',
          'service-deployment',
          'database-migration',
          'policy-loading',
          'health-check',
          'performance-benchmarking',
          'documentation-generation',
          'audit-trail-recording'
        ];

        for (const step of this.config.skipSteps) {
          if (!validSteps.includes(step)) {
            warnings.push(`Unknown step in skipSteps: ${step}`);
          }
        }

        if (this.config.skipSteps.length > 0) {
          this.logger.info(`✓ Skip steps: ${this.config.skipSteps.join(', ')}`);
        }
      }

      // Validate boolean flags
      if (typeof this.config.dryRun !== 'boolean') {
        errors.push('dryRun must be a boolean value');
      } else if (this.config.dryRun) {
        this.logger.info('✓ Dry run mode enabled');
      }

      if (typeof this.config.autoRollback !== 'boolean') {
        errors.push('autoRollback must be a boolean value');
      } else {
        this.logger.info(`✓ Auto rollback: ${this.config.autoRollback ? 'enabled' : 'disabled'}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`Failed to validate configuration schema: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }
}

module.exports = { ConfigValidator };
