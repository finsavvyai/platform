/**
 * Validation Aggregator Module
 * 
 * Aggregates validation results from multiple validators,
 * formats error messages, and handles validation failures.
 */

class ValidationAggregator {
  constructor(logger) {
    this.logger = logger;
    this.results = [];
  }

  /**
   * Add a validation result
   * @param {string} validatorName - Name of the validator
   * @param {ValidationResult} result - Validation result
   */
  addResult(validatorName, result) {
    this.results.push({
      validator: validatorName,
      ...result
    });
  }

  /**
   * Check if all validations passed
   * @returns {boolean}
   */
  isValid() {
    return this.results.every(result => result.valid);
  }

  /**
   * Get all errors from all validators
   * @returns {Array<string>}
   */
  getAllErrors() {
    const errors = [];
    for (const result of this.results) {
      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors.map(err => `[${result.validator}] ${err}`));
      }
    }
    return errors;
  }

  /**
   * Get all warnings from all validators
   * @returns {Array<string>}
   */
  getAllWarnings() {
    const warnings = [];
    for (const result of this.results) {
      if (result.warnings && result.warnings.length > 0) {
        warnings.push(...result.warnings.map(warn => `[${result.validator}] ${warn}`));
      }
    }
    return warnings;
  }

  /**
   * Format error messages for display
   * @returns {string}
   */
  formatErrors() {
    const errors = this.getAllErrors();
    
    if (errors.length === 0) {
      return '';
    }

    let output = '\n\x1b[31m╔═══════════════════════════════════════════════════════════════╗\x1b[0m\n';
    output += '\x1b[31m║                   VALIDATION FAILED                           ║\x1b[0m\n';
    output += '\x1b[31m╚═══════════════════════════════════════════════════════════════╝\x1b[0m\n\n';
    
    output += `\x1b[31mFound ${errors.length} error(s):\x1b[0m\n\n`;
    
    errors.forEach((error, index) => {
      output += `  ${index + 1}. ${error}\n`;
    });

    return output;
  }

  /**
   * Format warning messages for display
   * @returns {string}
   */
  formatWarnings() {
    const warnings = this.getAllWarnings();
    
    if (warnings.length === 0) {
      return '';
    }

    let output = '\n\x1b[33m⚠ Warnings:\x1b[0m\n\n';
    
    warnings.forEach((warning, index) => {
      output += `  ${index + 1}. ${warning}\n`;
    });

    return output;
  }

  /**
   * Display validation summary
   */
  displaySummary() {
    const errors = this.getAllErrors();
    const warnings = this.getAllWarnings();

    if (errors.length > 0) {
      console.log(this.formatErrors());
    }

    if (warnings.length > 0) {
      console.log(this.formatWarnings());
    }

    if (errors.length === 0 && warnings.length === 0) {
      this.logger.success('\n✓ All validations passed\n');
    }
  }

  /**
   * Handle validation failure and exit
   * @param {number} exitCode - Exit code (default: 1)
   */
  handleFailure(exitCode = 1) {
    this.displaySummary();

    console.log('\n\x1b[31m╔═══════════════════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[31m║              DEPLOYMENT CANNOT PROCEED                        ║\x1b[0m');
    console.log('\x1b[31m╚═══════════════════════════════════════════════════════════════╝\x1b[0m\n');
    console.log('Please fix the errors above and try again.\n');

    // Provide helpful suggestions based on error types
    this.provideSuggestions();

    process.exit(exitCode);
  }

  /**
   * Provide helpful suggestions based on validation errors
   */
  provideSuggestions() {
    const errors = this.getAllErrors();
    const suggestions = new Set();

    for (const error of errors) {
      if (error.includes('Wrangler CLI')) {
        suggestions.add('  • Install or update Wrangler CLI: npm install -g wrangler');
      }
      if (error.includes('Node.js')) {
        suggestions.add('  • Update Node.js to version 18 or higher: https://nodejs.org/');
      }
      if (error.includes('not authenticated') || error.includes('login')) {
        suggestions.add('  • Authenticate with Cloudflare: wrangler auth login');
      }
      if (error.includes('CLOUDFLARE_ACCOUNT_ID')) {
        suggestions.add('  • Set CLOUDFLARE_ACCOUNT_ID environment variable');
        suggestions.add('  • Find your account ID at: https://dash.cloudflare.com/');
      }
      if (error.includes('CLOUDFLARE_API_TOKEN')) {
        suggestions.add('  • Set CLOUDFLARE_API_TOKEN environment variable');
        suggestions.add('  • Create an API token at: https://dash.cloudflare.com/profile/api-tokens');
      }
      if (error.includes('environment variable')) {
        suggestions.add('  • Check your .env.production file or environment variables');
      }
      if (error.includes('Invalid environment')) {
        suggestions.add('  • Use --environment flag with: development, staging, or production');
      }
    }

    if (suggestions.size > 0) {
      console.log('\x1b[36mSuggestions:\x1b[0m\n');
      suggestions.forEach(suggestion => console.log(suggestion));
      console.log('');
    }
  }

  /**
   * Get validation summary object
   * @returns {Object}
   */
  getSummary() {
    return {
      valid: this.isValid(),
      totalValidators: this.results.length,
      passedValidators: this.results.filter(r => r.valid).length,
      failedValidators: this.results.filter(r => !r.valid).length,
      totalErrors: this.getAllErrors().length,
      totalWarnings: this.getAllWarnings().length,
      errors: this.getAllErrors(),
      warnings: this.getAllWarnings()
    };
  }
}

module.exports = { ValidationAggregator };
