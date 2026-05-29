/**
 * LLM Gateway Deployer
 * 
 * Handles the build, deployment, and health check verification
 * for the LLM Gateway service.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class LLMGatewayDeployer {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.serviceName = 'llm-gateway';
    this.servicePath = path.join(process.cwd(), 'services/llm-gateway');
  }

  /**
   * Deploy the LLM Gateway service
   * @param {Object} resources - Infrastructure resources
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(resources) {
    this.logger.info(`Deploying LLM Gateway service...`);

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
      this.logger.error(`LLM Gateway deployment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the LLM Gateway service
   * @returns {Promise<void>}
   */
  async build() {
    this.logger.info('Building LLM Gateway service...');

    try {
      // Check if go.mod exists (Go service)
      const goModPath = path.join(this.servicePath, 'go.mod');
      if (fs.existsSync(goModPath)) {
        this.logger.info('Go-based LLM Gateway service detected');
        
        // For Go Workers, we need to build the binary
        this.logger.info('Building Go binary...');
        
        // Build for Workers runtime (WASM target)
        execSync('go build -o main.wasm ./cmd/worker', {
          cwd: this.servicePath,
          stdio: 'inherit',
          env: {
            ...process.env,
            GOOS: 'js',
            GOARCH: 'wasm'
          }
        });
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

      this.logger.success('✓ LLM Gateway build completed');

    } catch (error) {
      throw new Error(`LLM Gateway build failed: ${error.message}`);
    }
  }

  /**
   * Deploy the LLM Gateway Worker to Cloudflare
   * @returns {Promise<Object>} Deployment information
   */
  async deployWorker() {
    this.logger.info('Deploying LLM Gateway Worker to Cloudflare...');

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
      const url = urlMatch ? urlMatch[0] : `https://llm-gateway-${this.config.environment}.workers.dev`;

      this.logger.success('✓ LLM Gateway Worker deployed');

      return {
        url,
        version: new Date().toISOString(),
        output
      };

    } catch (error) {
      throw new Error(`LLM Gateway Worker deployment failed: ${error.message}`);
    }
  }

  /**
   * Verify LLM Gateway health check endpoint
   * @param {string} url - Service URL
   * @returns {Promise<void>}
   */
  async verifyHealthCheck(url) {
    this.logger.info('Verifying LLM Gateway health check...');

    const healthCheckUrl = `${url}/api/llm/health`;
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
          this.logger.success(`✓ LLM Gateway health check passed`);
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

    throw new Error(`LLM Gateway health check failed after ${maxRetries} attempts`);
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
      healthCheckEndpoint: '/api/llm/health',
      dependencies: ['gateway']
    };
  }
}

module.exports = { LLMGatewayDeployer };
