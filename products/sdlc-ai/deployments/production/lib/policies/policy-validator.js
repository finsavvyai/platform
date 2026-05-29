/**
 * Policy Validator
 * 
 * Validates compliance policy structure, JSON schema, and rule definitions.
 * Ensures policies meet required standards before storage.
 * 
 * Requirements: 6.5
 */

class PolicyValidator {
  constructor(logger) {
    this.logger = logger;
    
    // Define required policy fields
    this.requiredFields = [
      'name',
      'version',
      'framework',
      'rules'
    ];
    
    // Define required rule fields
    this.requiredRuleFields = [
      'name',
      'description',
      'condition',
      'effect',
      'actions'
    ];
    
    // Valid effect types
    this.validEffects = ['allow', 'deny', 'transform', 'enhance', 'audit'];
    
    // Valid condition types
    this.validConditionTypes = [
      'data_classification',
      'content_contains',
      'organization_type',
      'user_role',
      'data_sensitivity',
      'geographic_location'
    ];
  }

  /**
   * Validate a complete policy object
   * @param {Object} policy - Policy object to validate
   * @returns {Object} Validation result
   */
  validatePolicy(policy) {
    this.logger.debug(`Validating policy: ${policy?.name || 'unknown'}`);
    
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Validate policy is an object
    if (!policy || typeof policy !== 'object') {
      result.valid = false;
      result.errors.push('Policy must be a valid object');
      return result;
    }

    // Validate required fields
    this._validateRequiredFields(policy, result);
    
    // Validate policy structure
    this._validatePolicyStructure(policy, result);
    
    // Validate rules array
    if (policy.rules) {
      this._validateRules(policy.rules, result);
    }
    
    // Validate version format
    this._validateVersion(policy.version, result);
    
    // Validate framework
    this._validateFramework(policy.framework, result);
    
    // Additional validations
    this._validateAdditionalFields(policy, result);

    if (result.valid) {
      this.logger.success(`✓ Policy validation passed: ${policy.name}`);
    } else {
      this.logger.error(`✗ Policy validation failed: ${policy.name}`);
      result.errors.forEach(error => this.logger.error(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => this.logger.warn(`  ⚠ ${warning}`));
    }

    return result;
  }

  /**
   * Validate JSON schema of policy
   * @param {string} policyJson - JSON string to validate
   * @returns {Object} Validation result
   */
  validateJSON(policyJson) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      const policy = JSON.parse(policyJson);
      return this.validatePolicy(policy);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Invalid JSON: ${error.message}`);
      this.logger.error(`JSON validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate a single policy rule
   * @param {Object} rule - Rule object to validate
   * @param {number} index - Rule index for error reporting
   * @returns {Object} Validation result
   */
  validateRule(rule, index = 0) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    const ruleId = rule?.name || `rule[${index}]`;

    // Check rule is an object
    if (!rule || typeof rule !== 'object') {
      result.valid = false;
      result.errors.push(`${ruleId}: Rule must be a valid object`);
      return result;
    }

    // Validate required rule fields
    for (const field of this.requiredRuleFields) {
      if (!rule[field]) {
        result.valid = false;
        result.errors.push(`${ruleId}: Missing required field '${field}'`);
      }
    }

    // Validate effect
    if (rule.effect && !this.validEffects.includes(rule.effect)) {
      result.valid = false;
      result.errors.push(
        `${ruleId}: Invalid effect '${rule.effect}'. Must be one of: ${this.validEffects.join(', ')}`
      );
    }

    // Validate condition
    if (rule.condition) {
      this._validateCondition(rule.condition, ruleId, result);
    }

    // Validate actions
    if (rule.actions) {
      this._validateActions(rule.actions, ruleId, result);
    }

    return result;
  }

  /**
   * Validate multiple policies
   * @param {Array} policies - Array of policy objects
   * @returns {Object} Validation result
   */
  validateAll(policies) {
    this.logger.info(`Validating ${policies.length} policies...`);
    
    const result = {
      valid: true,
      policies: {},
      errors: [],
      warnings: []
    };

    for (const policy of policies) {
      const policyResult = this.validatePolicy(policy);
      const framework = policy.framework || 'unknown';
      
      result.policies[framework] = policyResult;
      
      if (!policyResult.valid) {
        result.valid = false;
        result.errors.push(`${framework}: ${policyResult.errors.join(', ')}`);
      }
      
      if (policyResult.warnings.length > 0) {
        result.warnings.push(`${framework}: ${policyResult.warnings.join(', ')}`);
      }
    }

    if (result.valid) {
      this.logger.success(`✓ All policies validated successfully`);
    } else {
      this.logger.error(`✗ Policy validation failed for ${result.errors.length} policies`);
    }

    return result;
  }

  /**
   * Validate required fields exist
   * @private
   */
  _validateRequiredFields(policy, result) {
    for (const field of this.requiredFields) {
      if (!policy[field]) {
        result.valid = false;
        result.errors.push(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Validate policy structure
   * @private
   */
  _validatePolicyStructure(policy, result) {
    // Validate name is a string
    if (policy.name && typeof policy.name !== 'string') {
      result.valid = false;
      result.errors.push('Policy name must be a string');
    }

    // Validate description if present
    if (policy.description && typeof policy.description !== 'string') {
      result.warnings.push('Policy description should be a string');
    }

    // Validate rules is an array
    if (policy.rules && !Array.isArray(policy.rules)) {
      result.valid = false;
      result.errors.push('Policy rules must be an array');
    }

    // Check for empty rules
    if (policy.rules && policy.rules.length === 0) {
      result.warnings.push('Policy has no rules defined');
    }
  }

  /**
   * Validate all rules in a policy
   * @private
   */
  _validateRules(rules, result) {
    if (!Array.isArray(rules)) {
      result.valid = false;
      result.errors.push('Rules must be an array');
      return;
    }

    rules.forEach((rule, index) => {
      const ruleResult = this.validateRule(rule, index);
      
      if (!ruleResult.valid) {
        result.valid = false;
        result.errors.push(...ruleResult.errors);
      }
      
      if (ruleResult.warnings.length > 0) {
        result.warnings.push(...ruleResult.warnings);
      }
    });
  }

  /**
   * Validate version format (semantic versioning)
   * @private
   */
  _validateVersion(version, result) {
    if (!version) return;

    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    
    if (!semverRegex.test(version)) {
      result.warnings.push(
        `Version '${version}' does not follow semantic versioning (e.g., 1.0.0)`
      );
    }
  }

  /**
   * Validate framework name
   * @private
   */
  _validateFramework(framework, result) {
    if (!framework) return;

    const validFrameworks = ['HIPAA', 'GDPR', 'PCI-DSS', 'FINRA', 'SOC2', 'ISO27001'];
    
    if (!validFrameworks.includes(framework.toUpperCase())) {
      result.warnings.push(
        `Framework '${framework}' is not a standard compliance framework`
      );
    }
  }

  /**
   * Validate rule condition
   * @private
   */
  _validateCondition(condition, ruleId, result) {
    if (typeof condition !== 'object') {
      result.valid = false;
      result.errors.push(`${ruleId}: Condition must be an object`);
      return;
    }

    if (!condition.type) {
      result.valid = false;
      result.errors.push(`${ruleId}: Condition must have a 'type' field`);
      return;
    }

    if (!this.validConditionTypes.includes(condition.type)) {
      result.warnings.push(
        `${ruleId}: Condition type '${condition.type}' is not standard`
      );
    }

    // Validate condition has a value or patterns
    if (!condition.value && !condition.values && !condition.patterns) {
      result.warnings.push(
        `${ruleId}: Condition should have 'value', 'values', or 'patterns'`
      );
    }
  }

  /**
   * Validate rule actions
   * @private
   */
  _validateActions(actions, ruleId, result) {
    if (typeof actions !== 'object') {
      result.valid = false;
      result.errors.push(`${ruleId}: Actions must be an object`);
      return;
    }

    // Validate transformations if present
    if (actions.transformations) {
      if (!Array.isArray(actions.transformations)) {
        result.warnings.push(
          `${ruleId}: Transformations should be an array`
        );
      }
    }

    // Validate audit level if present
    if (actions.audit_level) {
      const validLevels = ['low', 'medium', 'high', 'critical'];
      if (!validLevels.includes(actions.audit_level)) {
        result.warnings.push(
          `${ruleId}: Audit level '${actions.audit_level}' is not standard`
        );
      }
    }
  }

  /**
   * Validate additional optional fields
   * @private
   */
  _validateAdditionalFields(policy, result) {
    // Validate risk level if present
    if (policy.risk_level) {
      const validLevels = ['low', 'medium', 'high', 'critical'];
      if (!validLevels.includes(policy.risk_level)) {
        result.warnings.push(
          `Risk level '${policy.risk_level}' is not standard (low, medium, high, critical)`
        );
      }
    }

    // Validate retention years if present
    if (policy.retention_years !== undefined) {
      if (typeof policy.retention_years !== 'number' || policy.retention_years < 0) {
        result.warnings.push('Retention years should be a positive number');
      }
    }

    // Validate timestamps if present
    if (policy.created_at || policy.updated_at) {
      this._validateTimestamp(policy.created_at, 'created_at', result);
      this._validateTimestamp(policy.updated_at, 'updated_at', result);
    }
  }

  /**
   * Validate ISO 8601 timestamp
   * @private
   */
  _validateTimestamp(timestamp, fieldName, result) {
    if (!timestamp) return;

    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    
    if (!iso8601Regex.test(timestamp)) {
      result.warnings.push(
        `${fieldName} '${timestamp}' is not in ISO 8601 format`
      );
    }
  }

  /**
   * Get validation statistics
   * @param {Object} validationResult - Result from validateAll
   * @returns {Object} Statistics
   */
  getValidationStats(validationResult) {
    const stats = {
      total: Object.keys(validationResult.policies).length,
      valid: 0,
      invalid: 0,
      warnings: validationResult.warnings.length,
      errors: validationResult.errors.length
    };

    for (const policyResult of Object.values(validationResult.policies)) {
      if (policyResult.valid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }
    }

    return stats;
  }
}

module.exports = PolicyValidator;
