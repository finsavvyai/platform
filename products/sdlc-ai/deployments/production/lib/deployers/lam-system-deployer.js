/**
 * LAM System Deployer
 * 
 * Handles the build, deployment, and health check verification
 * for the LAM (Large Action Model) System service.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class LAMSystemDeployer {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.serviceName = 'lam-system';
    this.servicePath = path.join(process.cwd(), 'services');
  }

  /**
   * Deploy the LAM System service
   * @param {Object} resources - Infrastructure resources
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(resources) {
    this.logger.info(`Deploying LAM System service...`);

    try {
      // Step 1: Build the service
      await this.build();

      // Step 2: Deploy to Cloudflare Workers
      const deploymentInfo = await this.deployWorker();

      // Step 3: Verify health check
      await this.verifyHealthCheck(deploymentInfo.url);

      return {
        service: this.serviceName,
        success: true,
        url: deploymentInfo.url,
        version: deploymentInfo.version,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`LAM System deployment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the LAM System service
   * @returns {Promise<void>}
   */
  async build() {
    this.logger.info('Building LAM System service...');

    try {
      // Check if package.json exists
      const packageJsonPath = path.join(this.servicePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`package.json not found at ${packageJsonPath}`);
      }

      // Install dependencies if node_modules doesn't exist
      const nodeModulesPath = path.join(this.servicePath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        this.logger.info('Installing dependencies...');
        execSync('npm install', {
          cwd: this.servicePath,
          stdio: 'inherit'
        });
      }

      // Verify LAM System files exist
      const lamSystemPath = path.join(this.servicePath, 'lam-system.js');
      if (!fs.existsSync(lamSystemPath)) {
        throw new Error('lam-system.js not found');
      }

      // Check for build script
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        this.logger.info('Running build script...');
        execSync('npm run build', {
          cwd: this.servicePath,
          stdio: 'inherit'
        });
      }

      this.logger.success('✓ LAM System build completed');

    } catch (error) {
      throw new Error(`LAM System build failed: ${error.message}`);
    }
  }

  /**
   * Deploy the LAM System Worker to Cloudflare
   * @returns {Promise<Object>} Deployment information
   */
  async deployWorker() {
    this.logger.info('Deploying LAM System Worker to Cloudflare...');

    try {
      const envFlag = this.config.environment !== 'development' 
        ? `--env ${this.config.environment}` 
        : '';

      // Check if wrangler.toml exists
      const wranglerPath = path.join(this.servicePath, 'wrangler.toml');
      if (!fs.existsSync(wranglerPath)) {
        throw new Error('wrangler.toml not found for LAM System');
      }

      // Deploy using Wrangler
      const deployCommand = `npx wrangler deploy ${envFlag}`;
      
      this.logger.info(`Running: ${deployCommand}`);
      
      const output = execSync(deployCommand, {
        cwd: this.servicePath,
        encoding: 'utf8'
      });

      // Parse deployment output to extract URL
      const urlMatch = output.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : `https://lam-system-${this.config.environment}.workers.dev`;

      this.logger.success('✓ LAM System Worker deployed');

      return {
        url,
        version: new Date().toISOString(),
        output
      };

    } catch (error) {
      throw new Error(`LAM System Worker deployment failed: ${error.message}`);
    }
  }

  /**
   * Verify LAM System health check endpoint
   * @param {string} url - Service URL
   * @returns {Promise<void>}
   */
  async verifyHealthCheck(url) {
    this.logger.info('Verifying LAM System health check...');

    const healthCheckUrl = `${url}/api/lam/health`;
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Health check attempt ${attempt}/${maxRetries}...`);

        const response = await fetch(healthCheckUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'SDLC-Deployment-Orchestrator/1.0'
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.logger.success(`✓ LAM System health check passed`);
          this.logger.info(`  Status: ${data.status || 'healthy'}`);
          return;
        }

        this.logger.warn(`Health check returned status ${response.status}`);

      } catch (error) {
        this.logger.warn(`Health check attempt ${attempt} failed: ${error.message}`);
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error(`LAM System health check failed after ${maxRetries} attempts`);
  }

  /**
   * Get service configuration
   * @returns {Object} Service configuration
   */
  getServiceConfig() {
    return {
      name: this.serviceName,
      path: this.servicePath,
      type: 'worker',
      healthCheckEndpoint: '/api/lam/health',
      dependencies: ['gateway', 'rag', 'dlp']
    };
  }
}

module.exports = { LAMSystemDeployer };
