/**
 * RAG Service Deployer
 * 
 * Handles the build, deployment, and health check verification
 * for the RAG (Retrieval-Augmented Generation) service.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class RAGDeployer {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.serviceName = 'rag';
    this.servicePath = path.join(process.cwd(), 'services/rag');
  }

  /**
   * Deploy the RAG service
   * @param {Object} resources - Infrastructure resources
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(resources) {
    this.logger.info(`Deploying RAG service...`);

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
      this.logger.error(`RAG deployment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the RAG service
   * @returns {Promise<void>}
   */
  async build() {
    this.logger.info('Building RAG service...');

    try {
      // Check if requirements.txt exists (Python service)
      const requirementsPath = path.join(this.servicePath, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        this.logger.info('Python-based RAG service detected');
        
        // For Python Workers, we need to ensure dependencies are bundled
        // This is typically handled by Wrangler during deployment
        this.logger.info('Dependencies will be bundled during deployment');
      }

      // Check for any build scripts
      const packageJsonPath = path.join(this.servicePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.scripts && packageJson.scripts.build) {
          this.logger.info('Running build script...');
          execSync('npm run build', {
            cwd: this.servicePath,
            stdio: 'inherit'
          });
        }
      }

      this.logger.success('✓ RAG build completed');

    } catch (error) {
      throw new Error(`RAG build failed: ${error.message}`);
    }
  }

  /**
   * Deploy the RAG Worker to Cloudflare
   * @returns {Promise<Object>} Deployment information
   */
  async deployWorker() {
    this.logger.info('Deploying RAG Worker to Cloudflare...');

    try {
      const envFlag = this.config.environment !== 'development' 
        ? `--env ${this.config.environment}` 
        : '';

      // Check if wrangler.toml exists in service directory
      const wranglerPath = path.join(this.servicePath, 'wrangler.toml');
      if (!fs.existsSync(wranglerPath)) {
        this.logger.warn('No wrangler.toml found, using default configuration');
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
      const url = urlMatch ? urlMatch[0] : `https://rag-${this.config.environment}.workers.dev`;

      this.logger.success('✓ RAG Worker deployed');

      return {
        url,
        version: new Date().toISOString(),
        output
      };

    } catch (error) {
      throw new Error(`RAG Worker deployment failed: ${error.message}`);
    }
  }

  /**
   * Verify RAG health check endpoint
   * @param {string} url - Service URL
   * @returns {Promise<void>}
   */
  async verifyHealthCheck(url) {
    this.logger.info('Verifying RAG health check...');

    const healthCheckUrl = `${url}/api/rag/health`;
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
          this.logger.success(`✓ RAG health check passed`);
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

    throw new Error(`RAG health check failed after ${maxRetries} attempts`);
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
      healthCheckEndpoint: '/api/rag/health',
      dependencies: ['gateway']
    };
  }
}

module.exports = { RAGDeployer };
