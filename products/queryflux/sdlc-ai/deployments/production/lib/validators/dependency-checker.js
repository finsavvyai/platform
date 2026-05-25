/**
 * Dependency Checker Module
 * 
 * Validates that all required CLI tools and dependencies are installed
 * and meet minimum version requirements.
 */

const { execSync } = require('child_process');
const semver = require('semver');

class DependencyChecker {
  constructor(logger) {
    this.logger = logger;
    this.requirements = {
      wrangler: '3.0.0',
      node: '18.0.0'
    };
  }

  /**
   * Check all dependencies
   * @returns {Promise<ValidationResult>}
   */
  async checkAll() {
    const errors = [];
    const warnings = [];

    this.logger.info('Checking dependencies...');

    // Check Wrangler CLI
    const wranglerResult = await this.checkWranglerVersion();
    if (!wranglerResult.valid) {
      errors.push(...wranglerResult.errors);
    }
    if (wranglerResult.warnings.length > 0) {
      warnings.push(...wranglerResult.warnings);
    }

    // Check Node.js version
    const nodeResult = await this.checkNodeVersion();
    if (!nodeResult.valid) {
      errors.push(...nodeResult.errors);
    }
    if (nodeResult.warnings.length > 0) {
      warnings.push(...nodeResult.warnings);
    }

    // Check tool availability
    const toolsResult = await this.checkToolAvailability();
    if (!toolsResult.valid) {
      errors.push(...toolsResult.errors);
    }
    if (toolsResult.warnings.length > 0) {
      warnings.push(...toolsResult.warnings);
    }

    const valid = errors.length === 0;

    if (valid) {
      this.logger.success('✓ All dependencies satisfied');
    } else {
      this.logger.error(`✗ Dependency check failed with ${errors.length} error(s)`);
    }

    return {
      valid,
      errors,
      warnings
    };
  }

  /**
   * Check Wrangler CLI version
   * @returns {Promise<ValidationResult>}
   */
  async checkWranglerVersion() {
    const errors = [];
    const warnings = [];

    try {
      // Check if wrangler is installed
      const version = this.getCommandVersion('wrangler --version');
      
      if (!version) {
        errors.push('Wrangler CLI is not installed');
        return { valid: false, errors, warnings };
      }

      // Parse version (wrangler outputs like "⛅️ wrangler 3.78.12")
      const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
      if (!versionMatch) {
        errors.push(`Unable to parse Wrangler version: ${version}`);
        return { valid: false, errors, warnings };
      }

      const installedVersion = versionMatch[1];
      const requiredVersion = this.requirements.wrangler;

      // Compare versions
      if (semver.lt(installedVersion, requiredVersion)) {
        errors.push(
          `Wrangler CLI version ${installedVersion} is below minimum required version ${requiredVersion}`
        );
        return { valid: false, errors, warnings };
      }

      this.logger.info(`✓ Wrangler CLI version ${installedVersion} (>= ${requiredVersion})`);
      return { valid: true, errors, warnings };

    } catch (error) {
      errors.push(`Failed to check Wrangler CLI: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Check Node.js version
   * @returns {Promise<ValidationResult>}
   */
  async checkNodeVersion() {
    const errors = [];
    const warnings = [];

    try {
      const installedVersion = process.version.replace('v', '');
      const requiredVersion = this.requirements.node;

      // Compare versions
      if (semver.lt(installedVersion, requiredVersion)) {
        errors.push(
          `Node.js version ${installedVersion} is below minimum required version ${requiredVersion}`
        );
        return { valid: false, errors, warnings };
      }

      this.logger.info(`✓ Node.js version ${installedVersion} (>= ${requiredVersion})`);
      return { valid: true, errors, warnings };

    } catch (error) {
      errors.push(`Failed to check Node.js version: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Check availability of required tools
   * @returns {Promise<ValidationResult>}
   */
  async checkToolAvailability() {
    const errors = [];
    const warnings = [];

    const tools = [
      { name: 'git', command: 'git --version' },
      { name: 'npm', command: 'npm --version' }
    ];

    for (const tool of tools) {
      try {
        const version = this.getCommandVersion(tool.command);
        if (version) {
          this.logger.info(`✓ ${tool.name} is available`);
        } else {
          warnings.push(`${tool.name} is not available (optional)`);
        }
      } catch (error) {
        warnings.push(`${tool.name} is not available (optional)`);
      }
    }

    return { valid: true, errors, warnings };
  }

  /**
   * Execute a command and get its version output
   * @param {string} command - Command to execute
   * @returns {string|null} Version string or null if command fails
   */
  getCommandVersion(command) {
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return output.trim();
    } catch (error) {
      return null;
    }
  }
}

module.exports = { DependencyChecker };
