/**
 * Gateway Service Deployer
 * 
 * Handles the build, deployment, and health check verification
 * for the Gateway Worker service.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class GatewayDeployer {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.serviceName = 'gateway';
    this.servicePath = path.join(process.cwd(), 'services/gateway-worker');
  }

  /**
   * Deploy the Gateway service
   * @param {Object} resources - Infrastructure resources
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(resources) {
    this.logger.info(`Deploying Gateway service...`);

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
      this.logger.error(`Gateway deployment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the Gateway service
   * @returns {Promise<void>}
   */
  async build() {
    this.logger.info('Building Gateway service...');

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

      // Run build command if it exists
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        this.logger.info('Running build script...');
        execSync('npm run build', {
          cwd: this.servicePath,
          stdio: 'inherit'
        });
      }

      this.logger.success('✓ Gateway build completed');

    } catch (error) {
      throw new Error(`Gateway build failed: ${error.message}`);
    }
  }

  /**
   * Deploy the Gateway Worker to Cloudflare
   * @returns {Promise<Object>} Deployment information
   */
  async deployWorker() {
    this.logger.info('Deploying Gateway Worker to Cloudflare...');

    try {
      const envFlag = this.config.environment !== 'development' 
        ? `--env ${this.config.environment}` 
        : '';

      // Deploy using Wrangler
      const deployCommand = `npx wrangler deploy ${envFlag}`;
      
      this.logger.info(`Running: ${deployCommand}`);
      
      const output = execSync(deployCommand, {
        cwd: this.servicePath,
        encoding: 'utf8'
      });

      // Parse deployment output to extract URL
      const urlMatch = output.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : `https://gateway-${this.config.environment}.workers.dev`;

      this.logger.success('✓ Gateway Worker deployed');

      return {
        url,
        version: new Date().toISOString(),
        output
      };

    } catch (error) {
      throw new Error(`Gateway Worker deployment failed: ${error.message}`);
    }
  }

  /**
   * Verify Gateway health check endpoint
   * @param {string} url - Service URL
   * @returns {Promise<void>}
   */
  async verifyHealthCheck(url) {
    this.logger.info('Verifying Gateway health check...');

    const healthCheckUrl = `${url}/api/health`;
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
          this.logger.success(`✓ Gateway health check passed`);
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

    throw new Error(`Gateway health check failed after ${maxRetries} attempts`);
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
      healthCheckEndpoint: '/api/health',
      dependencies: []
    };
  }
}

module.exports = { GatewayDeployer };
