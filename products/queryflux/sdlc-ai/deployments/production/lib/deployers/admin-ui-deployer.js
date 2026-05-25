/**
 * Admin UI Deployer
 * 
 * Handles the build, deployment, and health check verification
 * for the Admin UI service (Cloudflare Pages).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class AdminUIDeployer {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.serviceName = 'admin-ui';
    this.servicePath = path.join(process.cwd(), 'services/admin-ui');
  }

  /**
   * Deploy the Admin UI service
   * @param {Object} resources - Infrastructure resources
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(resources) {
    this.logger.info(`Deploying Admin UI service...`);

    try {
      // Step 1: Build the service
      await this.build();

      // Step 2: Deploy to Cloudflare Pages
      const deploymentInfo = await this.deployPages();

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
      this.logger.error(`Admin UI deployment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the Admin UI service
   * @returns {Promise<void>}
   */
  async build() {
    this.logger.info('Building Admin UI service...');

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

      // Run build command
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        this.logger.info('Running build script...');
        execSync('npm run build', {
          cwd: this.servicePath,
          stdio: 'inherit'
        });
      } else {
        throw new Error('No build script found in package.json');
      }

      // Verify build output exists
      const buildOutputPath = path.join(this.servicePath, '.next');
      if (!fs.existsSync(buildOutputPath)) {
        throw new Error('Build output not found');
      }

      this.logger.success('✓ Admin UI build completed');

    } catch (error) {
      throw new Error(`Admin UI build failed: ${error.message}`);
    }
  }

  /**
   * Deploy the Admin UI to Cloudflare Pages
   * @returns {Promise<Object>} Deployment information
   */
  async deployPages() {
    this.logger.info('Deploying Admin UI to Cloudflare Pages...');

    try {
      const envFlag = this.config.environment !== 'development' 
        ? `--env ${this.config.environment}` 
        : '';

      // For Pages, we use wrangler pages deploy
      const deployCommand = `npx wrangler pages deploy .next ${envFlag} --project-name=sdlc-admin-ui`;
      
      this.logger.info(`Running: ${deployCommand}`);
      
      const output = execSync(deployCommand, {
        cwd: this.servicePath,
        encoding: 'utf8'
      });

      // Parse deployment output to extract URL
      const urlMatch = output.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : `https://sdlc-admin-ui.pages.dev`;

      this.logger.success('✓ Admin UI deployed to Cloudflare Pages');

      return {
        url,
        version: new Date().toISOString(),
        output
      };

    } catch (error) {
      throw new Error(`Admin UI deployment failed: ${error.message}`);
    }
  }

  /**
   * Verify Admin UI health check endpoint
   * @param {string} url - Service URL
   * @returns {Promise<void>}
   */
  async verifyHealthCheck(url) {
    this.logger.info('Verifying Admin UI health check...');

    const healthCheckUrl = url; // Root URL for Pages
    const maxRetries = 5;
    const retryDelay = 3000; // 3 seconds (Pages may take longer to propagate)

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
          this.logger.success(`✓ Admin UI health check passed`);
          this.logger.info(`  Status: ${response.status}`);
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

    throw new Error(`Admin UI health check failed after ${maxRetries} attempts`);
  }

  /**
   * Get service configuration
   * @returns {Object} Service configuration
   */
  getServiceConfig() {
    return {
      name: this.serviceName,
      path: this.servicePath,
      type: 'pages',
      healthCheckEndpoint: '/',
      dependencies: ['gateway', 'rag', 'dlp', 'llm-gateway', 'lam-system']
    };
  }
}

module.exports = { AdminUIDeployer };
