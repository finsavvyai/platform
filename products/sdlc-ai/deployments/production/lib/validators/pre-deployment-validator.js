/**
 * Pre-Deployment Validator
 * 
 * Main validator that orchestrates all pre-deployment validation checks.
 */

const { DependencyChecker } = require('./dependency-checker');
const { AuthValidator } = require('./auth-validator');
const { ConfigValidator } = require('./config-validator');
const { ValidationAggregator } = require('./validation-aggregator');

class PreDeploymentValidator {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.aggregator = new ValidationAggregator(logger);
  }

  /**
   * Run all pre-deployment validations
   * @returns {Promise<ValidationResult>}
   */
  async validate() {
    this.logger.phase('Pre-Deployment Validation');
    
    try {
      // Run dependency checks
      const dependencyChecker = new DependencyChecker(this.logger);
      const dependencyResult = await dependencyChecker.checkAll();
      this.aggregator.addResult('Dependency Checker', dependencyResult);

      // Run authentication validation
      const authValidator = new AuthValidator(this.logger);
      const authResult = await authValidator.validateAll();
      this.aggregator.addResult('Authentication Validator', authResult);

      // Run configuration validation
      const configValidator = new ConfigValidator(this.logger, this.config);
      const configResult = await configValidator.validateAll();
      this.aggregator.addResult('Configuration Validator', configResult);

      // Display summary
      this.aggregator.displaySummary();

      // Check if validation passed
      if (!this.aggregator.isValid()) {
        this.aggregator.handleFailure();
      }

      return this.aggregator.getSummary();

    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { PreDeploymentValidator };
