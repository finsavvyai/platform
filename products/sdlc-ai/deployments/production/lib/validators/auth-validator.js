/**
 * Authentication Validator Module
 * 
 * Validates Cloudflare authentication credentials and permissions.
 */

const { execSync } = require('child_process');

class AuthValidator {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Validate all authentication requirements
   * @returns {Promise<ValidationResult>}
   */
  async validateAll() {
    const errors = [];
    const warnings = [];

    this.logger.info('Validating authentication...');

    // Check Cloudflare authentication
    const authResult = await this.checkCloudflareAuth();
    if (!authResult.valid) {
      errors.push(...authResult.errors);
    }
    if (authResult.warnings.length > 0) {
      warnings.push(...authResult.warnings);
    }

    // Verify account ID
    const accountResult = await this.verifyAccountId();
    if (!accountResult.valid) {
      errors.push(...accountResult.errors);
    }
    if (accountResult.warnings.length > 0) {
      warnings.push(...accountResult.warnings);
    }

    // Validate API token
    const tokenResult = await this.validateApiToken();
    if (!tokenResult.valid) {
      errors.push(...tokenResult.errors);
    }
    if (tokenResult.warnings.length > 0) {
      warnings.push(...tokenResult.warnings);
    }

    const valid = errors.length === 0;

    if (valid) {
      this.logger.success('✓ Authentication validated');
    } else {
      this.logger.error(`✗ Authentication validation failed with ${errors.length} error(s)`);
    }

    return {
      valid,
      errors,
      warnings
    };
  }

  /**
   * Check Cloudflare authentication status
   * @returns {Promise<ValidationResult>}
   */
  async checkCloudflareAuth() {
    const errors = [];
    const warnings = [];

    try {
      // Try to run wrangler whoami to check authentication
      const output = execSync('wrangler whoami', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Check if output indicates successful authentication
      if (output.includes('You are logged in') || output.includes('account')) {
        this.logger.info('✓ Cloudflare authentication verified');
        return { valid: true, errors, warnings };
      } else {
        errors.push('Cloudflare authentication status unclear');
        return { valid: false, errors, warnings };
      }

    } catch (error) {
      // Check if error indicates not logged in
      if (error.message.includes('not authenticated') || 
          error.message.includes('login') ||
          error.stderr?.includes('not authenticated')) {
        errors.push('Not authenticated with Cloudflare. Run "wrangler login" to authenticate.');
      } else {
        errors.push(`Failed to verify Cloudflare authentication: ${error.message}`);
      }
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Verify account ID is configured
   * @returns {Promise<ValidationResult>}
   */
  async verifyAccountId() {
    const errors = [];
    const warnings = [];

    try {
      // Check for account ID in environment variable
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

      if (!accountId) {
        errors.push('CLOUDFLARE_ACCOUNT_ID environment variable is not set');
        return { valid: false, errors, warnings };
      }

      // Validate account ID format (should be 32 hex characters)
      const accountIdPattern = /^[a-f0-9]{32}$/i;
      if (!accountIdPattern.test(accountId)) {
        errors.push(`Invalid CLOUDFLARE_ACCOUNT_ID format: ${accountId.substring(0, 8)}...`);
        return { valid: false, errors, warnings };
      }

      this.logger.info(`✓ Account ID configured: ${accountId.substring(0, 8)}...`);
      return { valid: true, errors, warnings };

    } catch (error) {
      errors.push(`Failed to verify account ID: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate API token permissions
   * @returns {Promise<ValidationResult>}
   */
  async validateApiToken() {
    const errors = [];
    const warnings = [];

    try {
      // Check for API token in environment variable
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!apiToken) {
        // API token is optional if using wrangler login
        warnings.push('CLOUDFLARE_API_TOKEN not set (using wrangler login authentication)');
        return { valid: true, errors, warnings };
      }

      // Validate token format (should be a long alphanumeric string)
      if (apiToken.length < 40) {
        errors.push('CLOUDFLARE_API_TOKEN appears to be invalid (too short)');
        return { valid: false, errors, warnings };
      }

      // Try to verify token by making a simple API call
      try {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        if (accountId) {
          // Use wrangler to verify token works
          execSync('wrangler whoami', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              CLOUDFLARE_API_TOKEN: apiToken
            }
          });
          this.logger.info('✓ API token validated');
        } else {
          this.logger.info('✓ API token format valid');
        }
      } catch (tokenError) {
        errors.push('API token validation failed - token may be invalid or expired');
        return { valid: false, errors, warnings };
      }

      return { valid: true, errors, warnings };

    } catch (error) {
      errors.push(`Failed to validate API token: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }
}

module.exports = { AuthValidator };
