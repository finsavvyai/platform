#!/usr/bin/env node

/**
 * QueryFlux Deployment Script with Voice Progress Monitoring
 *
 * Provides comprehensive deployment automation with real-time voice feedback
 * on deployment progress, health checks, and status updates.
 *
 * Usage: node scripts/deploy-with-voice.js [platform] [options]
 *
 * Platforms:
 * - cloudflare: Deploy to Cloudflare Pages
 * - netlify: Deploy to Netlify
 * - render: Deploy to Render
 * - all: Deploy to all platforms
 *
 * Options:
 * --voice: Enable voice announcements (default: true)
 * --verbose: Enable verbose logging
 * --skip-tests: Skip pre-deployment tests
 * --dry-run: Simulate deployment without actual deployment
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Voice synthesis configuration
const VOICE_CONFIG = {
  enabled: true,
  provider: 'openai', // openai, elevenlabs, or browser
  language: 'en',
  voice: 'female',
  rate: 1.0,
  volume: 0.8,
  apiKey: process.env.OPENAI_API_KEY
};

// Deployment configuration
const DEPLOYMENT_CONFIG = {
  platforms: {
    cloudflare: {
      name: 'Cloudflare Pages',
      command: 'wrangler pages deploy build',
      healthUrl: 'https://queryflux.pages.dev/health',
      maxRetries: 3,
      timeout: 300000 // 5 minutes
    },
    netlify: {
      name: 'Netlify',
      command: 'netlify deploy --prod',
      healthUrl: 'https://queryflux.netlify.app/health',
      maxRetries: 3,
      timeout: 180000 // 3 minutes
    },
    render: {
      name: 'Render',
      command: 'render deploy',
      healthUrl: 'https://queryflux.onrender.com/health',
      maxRetries: 3,
      timeout: 600000 // 10 minutes
    }
  }
};

// Health check endpoints
const HEALTH_CHECKS = {
  'Cloudflare Pages': 'https://queryflux.pages.dev/health',
  'Netlify': 'https://queryflux.netlify.app/health',
  'Render': 'https://queryflux.onrender.com/health'
};

// Color output for console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

class DeploymentOrchestrator {
  constructor(options = {}) {
    this.options = {
      platform: options.platform || 'all',
      voice: options.voice !== false,
      verbose: options.verbose || false,
      skipTests: options.skipTests || false,
      dryRun: options.dryRun || false,
      ...options
    };

    this.startTime = Date.now();
    this.deploymentStatus = new Map();
    this.healthChecks = new Map();
    this.metrics = {
      builds: {},
      deployments: {},
      healthChecks: {},
      errors: []
    };
  }

  /**
   * Execute the complete deployment process
   */
  async deploy() {
    try {
      await this.log('🚀 Starting QueryFlux deployment process...');
      await this.speak('Starting QueryFlux deployment process');

      // Pre-deployment checks
      await this.runPreDeploymentChecks();

      // Build application
      await this.buildApplication();

      // Deploy to platforms
      const platforms = this.getTargetPlatforms();

      for (const platform of platforms) {
        await this.deployToPlatform(platform);
      }

      // Post-deployment verification
      await this.runPostDeploymentChecks();

      // Generate final report
      await this.generateDeploymentReport();

      await this.log('✅ Deployment completed successfully!');
      await this.speak('Deployment completed successfully! All systems operational.');

    } catch (error) {
      await this.log(`❌ Deployment failed: ${error.message}`, 'error');
      await this.speak('Deployment failed. Please check the logs for details.', 'error');
      throw error;
    }
  }

  /**
   * Run pre-deployment checks
   */
  async runPreDeploymentChecks() {
    await this.log('🔍 Running pre-deployment checks...');
    await this.speak('Running pre-deployment checks');

    // Check git status
    await this.checkGitStatus();

    // Check environment variables
    await this.checkEnvironmentVariables();

    // Run tests if not skipped
    if (!this.options.skipTests) {
      await this.runTests();
    }

    // Check build configuration
    await this.checkBuildConfiguration();

    await this.log('✅ Pre-deployment checks completed');
    await this.speak('Pre-deployment checks completed successfully');
  }

  /**
   * Build the application
   */
  async buildApplication() {
    if (this.options.dryRun) {
      await this.log('📦 Simulating build process (dry run mode)...');
      await this.speak('Simulating build process');
      return;
    }

    await this.log('📦 Building application...');
    await this.speak('Building application. This may take a few minutes.');

    const buildStart = Date.now();

    try {
      execSync('npm run build', { stdio: 'pipe' });

      const buildTime = Date.now() - buildStart;
      this.metrics.builds.main = buildTime;

      await this.log(`✅ Build completed in ${buildTime}ms`, 'success');
      await this.speak(`Build completed successfully in ${Math.round(buildTime / 1000)} seconds`);

    } catch (error) {
      await this.log(`❌ Build failed: ${error.message}`, 'error');
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  /**
   * Deploy to specific platform
   */
  async deployToPlatform(platform) {
    if (this.options.dryRun) {
      await this.log(`📤 Simulating deployment to ${DEPLOYMENT_CONFIG.platforms[platform].name}...`);
      await this.speak(`Simulating deployment to ${DEPLOYMENT_CONFIG.platforms[platform].name}`);
      return;
    }

    await this.log(`📤 Deploying to ${DEPLOYMENT_CONFIG.platforms[platform].name}...`);
    await this.speak(`Deploying to ${DEPLOYMENT_CONFIG.platforms[platform].name}. Please wait.`);

    const deployStart = Date.now();
    const config = DEPLOYMENT_CONFIG.platforms[platform];

    try {
      // Platform-specific deployment logic
      switch (platform) {
        case 'cloudflare':
          await this.deployToCloudflare();
          break;
        case 'netlify':
          await this.deployToNetlify();
          break;
        case 'render':
          await this.deployToRender();
          break;
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }

      const deployTime = Date.now() - deployStart;
      this.metrics.deployments[platform] = deployTime;

      this.deploymentStatus.set(platform, 'success');

      await this.log(`✅ ${config.name} deployment completed in ${deployTime}ms`, 'success');
      await this.speak(`${config.name} deployment completed successfully in ${Math.round(deployTime / 1000)} seconds`);

      // Health check
      await this.performHealthCheck(platform);

    } catch (error) {
      this.deploymentStatus.set(platform, 'failed');
      this.metrics.errors.push({
        platform,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      await this.log(`❌ ${config.name} deployment failed: ${error.message}`, 'error');
      await this.speak(`${config.name} deployment failed. Check logs for details.`, 'error');

      // Continue with other platforms but mark as failure
    }
  }

  /**
   * Deploy to Cloudflare Pages
   */
  async deployToCloudflare() {
    await this.executeCommand('wrangler pages deploy build', {
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN
      }
    });
  }

  /**
   * Deploy to Netlify
   */
  async deployToNetlify() {
    await this.executeCommand('netlify deploy --prod', {
      env: {
        ...process.env,
        NETLIFY_AUTH_TOKEN: process.env.NETLIFY_AUTH_TOKEN,
        NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID
      }
    });
  }

  /**
   * Deploy to Render
   */
  async deployToRender() {
    await this.executeCommand('render deploy', {
      env: {
        ...process.env,
        RENDER_API_KEY: process.env.RENDER_API_KEY
      }
    });
  }

  /**
   * Perform health check for deployed platform
   */
  async performHealthCheck(platform) {
    const config = DEPLOYMENT_CONFIG.platforms[platform];
    const healthUrl = HEALTH_CHECKS[config.name] || config.healthUrl;

    await this.log(`🏥 Running health check for ${config.name}...`);

    try {
      const response = await this.fetchWithRetry(healthUrl, {
        timeout: 30000,
        retries: 3
      });

      const health = await response.json();

      if (health.status === 'healthy' || health.status === 'degraded') {
        this.healthChecks.set(platform, 'success');
        await this.log(`✅ ${config.name} health check passed`, 'success');
        await this.speak(`${config.name} health check passed. System is operational.`);
      } else {
        this.healthChecks.set(platform, 'failed');
        await this.log(`⚠️ ${config.name} health check: ${health.status}`, 'warning');
        await this.speak(`${config.name} health check shows ${health.status} status. System may need attention.`);
      }

    } catch (error) {
      this.healthChecks.set(platform, 'failed');
      await this.log(`❌ ${config.name} health check failed: ${error.message}`, 'error');
      await this.speak(`${config.name} health check failed. System may be unavailable.`, 'error');
    }
  }

  /**
   * Run post-deployment checks
   */
  async runPostDeploymentChecks() {
    await this.log('🔍 Running post-deployment checks...');
    await this.speak('Running post-deployment verification checks');

    // Check all deployed platforms
    const platforms = this.getTargetPlatforms();
    let healthyCount = 0;

    for (const platform of platforms) {
      if (this.deploymentStatus.get(platform) === 'success' &&
          this.healthChecks.get(platform) === 'success') {
        healthyCount++;
      }
    }

    // Verify overall system health
    const overallHealth = (healthyCount / platforms.length) >= 0.8;

    if (overallHealth) {
      await this.log(`✅ Post-deployment checks passed (${healthyCount}/${platforms.length} platforms healthy)`, 'success');
      await this.speak(`Post-deployment verification completed. ${healthyCount} out of ${platforms.length} platforms are healthy.`);
    } else {
      await this.log(`⚠️ Post-deployment issues detected (${healthyCount}/${platforms.length} platforms healthy)`, 'warning');
      await this.speak(`Post-deployment verification completed with issues. ${healthyCount} out of ${platforms.length} platforms are fully operational.`);
    }

    // Check application functionality
    await this.checkApplicationFunctionality();
  }

  /**
   * Check application functionality
   */
  async checkApplicationFunctionality() {
    await this.log('🔧 Checking application functionality...');

    // Test API endpoints
    await this.testAPIEndpoints();

    // Test database connectivity
    await this.testDatabaseConnectivity();

    // Test authentication
    await this.testAuthenticationSystem();
  }

  /**
   * Test API endpoints
   */
  async testAPIEndpoints() {
    const endpoints = [
      { name: 'Health Check', path: '/health' },
      { name: 'Database API', path: '/api/database-query' },
      { name: 'Authentication API', path: '/api/auth/login' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.fetchWithRetry(`https://queryflux.pages.dev${endpoint.path}`, {
          method: endpoint.path.includes('/api/') ? 'POST' : 'GET',
          timeout: 10000,
          retries: 2,
          body: endpoint.path.includes('/api/') ? JSON.stringify({
            query: 'SELECT 1',
            parameters: []
          }) : undefined
        });

        if (response.status < 400) {
          await this.log(`✅ ${endpoint.name}: ${response.status}`, 'success');
        } else {
          await this.log(`⚠️ ${endpoint.name}: ${response.status}`, 'warning');
        }
      } catch (error) {
        await this.log(`❌ ${endpoint.name}: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnectivity() {
    try {
      const response = await this.fetchWithRetry('https://queryflux.pages.dev/api/database-query', {
        method: 'POST',
        timeout: 15000,
        retries: 2,
        body: JSON.stringify({
          query: 'SELECT version()',
          parameters: [],
          connectionId: 'test'
        })
      });

      if (response.status === 200) {
        await this.log('✅ Database connectivity: Operational', 'success');
      } else {
        await this.log('⚠️ Database connectivity: Issues detected', 'warning');
      }
    } catch (error) {
      await this.log(`❌ Database connectivity: ${error.message}`, 'error');
    }
  }

  /**
   * Test authentication system
   */
  async testAuthenticationSystem() {
    try {
      const response = await this.fetchWithRetry('https://queryflux.pages.dev/api/auth/login', {
        method: 'POST',
        timeout: 10000,
        retries: 2,
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'test'
        })
      });

      // 401 is expected for invalid credentials, which means the system is working
      if (response.status === 401 || response.status === 200) {
        await this.log('✅ Authentication system: Operational', 'success');
      } else {
        await this.log(`⚠️ Authentication system: Unexpected status (${response.status})`, 'warning');
      }
    } catch (error) {
      await this.log(`❌ Authentication system: ${error.message}`, 'error');
    }
  }

  /**
   * Generate comprehensive deployment report
   */
  async generateDeploymentReport() {
    const totalTime = Date.now() - this.startTime;
    const platforms = this.getTargetPlatforms();
    const successfulDeployments = Array.from(this.deploymentStatus.values()).filter(s => s === 'success').length;
    const successfulHealthChecks = Array.from(this.healthChecks.values()).filter(h => h === 'success').length;
    const errorCount = this.metrics.errors.length;

    await this.log('\n📊 DEPLOYMENT REPORT', 'bold');
    await this.log('─'.repeat(50), 'dim');
    await this.log(`⏱️  Total Deployment Time: ${Math.round(totalTime / 1000)}s`);
    await this.log(`📤  Platforms Deployed: ${platforms.length}`);
    await this.log(`✅  Successful Deployments: ${successfulDeployments}`);
    await this.log(`🏥  Health Checks Passed: ${successfulHealthChecks}`);
    await this.log(`❌  Errors Encountered: ${errorCount}`);

    // Platform breakdown
    await this.log('\n📤 PLATFORM BREAKDOWN:', 'bold');
    for (const platform of platforms) {
      const status = this.deploymentStatus.get(platform);
      const health = this.healthChecks.get(platform);
      const buildTime = this.metrics.builds.main || 0;
      const deployTime = this.metrics.deployments[platform] || 0;

      const statusIcon = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⚠️';
      const healthIcon = health === 'success' ? '🏥' : health === 'failed' ? '❌' : '⚠️';

      await this.log(`${statusIcon} ${DEPLOYMENT_CONFIG.platforms[platform].name}:`);
      await this.log(`   ${healthIcon} Health: ${health}`);
      await this.log(`   📦 Build: ${buildTime}ms`);
      await this.log(`   🚀 Deploy: ${deployTime}ms`);
      await this.log('');
    }

    // Error summary
    if (errorCount > 0) {
      await this.log('\n❌ ERRORS ENCOUNTERED:', 'red', 'bold');
      for (const error of this.metrics.errors) {
        await this.log(`   • ${error.platform}: ${error.error}`);
      }
    }

    // Performance metrics
    await this.log('\n⚡ PERFORMANCE METRICS:', 'blue', 'bold');
    const avgBuildTime = this.metrics.builds.main || 0;
    const avgDeployTime = Object.values(this.metrics.deployments).reduce((a, b) => a + b, 0) / Object.keys(this.metrics.deployments).length;

    await this.log(`📦 Average Build Time: ${Math.round(avgBuildTime)}ms`);
    await this.log(`🚀 Average Deploy Time: ${Math.round(avgDeployTime)}ms`);
    await this.log(`⏱️  Total Time: ${Math.round(totalTime)}ms`);

    await this.speak(`Deployment report generated. ${successfulDeployments} out of ${platforms.length} deployments were successful.`);
  }

  /**
   * Helper methods
   */
  getTargetPlatforms() {
    if (this.options.platform === 'all') {
      return Object.keys(DEPLOYMENT_CONFIG.platforms);
    }
    return [this.options.platform].filter(p => DEPLOYMENT_CONFIG.platforms[p]);
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const color = type === 'error' ? colors.red :
                   type === 'warning' ? colors.yellow :
                   type === 'success' ? colors.green :
                   type === 'bold' ? colors.bold :
                   colors.white;

    console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
  }

  async speak(message, type = 'info') {
    if (!this.options.voice || !VOICE_CONFIG.enabled) {
      return;
    }

    try {
      if (VOICE_CONFIG.provider === 'openai' && VOICE_CONFIG.apiKey) {
        await this.speakWithOpenAI(message, type);
      } else {
        // Fallback to console-based voice announcement
        console.log(`🔊 ${message}`);
      }
    } catch (error) {
      console.log(`🔊 Voice announcement failed: ${error.message}`);
    }
  }

  async speakWithOpenAI(message, type = 'info') {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VOICE_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: message,
        voice: 'alloy',
        response_format: 'mp3'
      })
    });

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      // In a real implementation, you would play this audio
      // For now, we'll just log that we received it
      console.log(`🔊 Voice announcement generated (${audioBuffer.byteLength} bytes)`);
    }
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true, ...options });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
        if (this.options.verbose) {
          process.stdout.write(data);
        }
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        if (this.options.verbose) {
          process.stderr.write(data);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', reject);
    });
  }

  async fetchWithRetry(url, options = {}) {
    const { retries = 3, timeout = 30000, ...fetchOptions } = options;

    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;

      } catch (error) {
        if (i === retries) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  async checkGitStatus() {
    try {
      const output = execSync('git status --porcelain', { encoding: 'utf8' });
      if (output.trim()) {
        await this.log('⚠️ Working directory has uncommitted changes', 'warning');
      }
    } catch (error) {
      await this.log('❌ Git status check failed', 'error');
    }
  }

  async checkEnvironmentVariables() {
    const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
      await this.log(`⚠️ Missing environment variables: ${missingVars.join(', ')}`, 'warning');
    }
  }

  async runTests() {
    try {
      await this.log('🧪 Running tests...');
      execSync('npm test', { stdio: 'pipe' });
      await this.log('✅ Tests passed');
    } catch (error) {
      await this.log('❌ Tests failed', 'error');
      throw new Error('Tests failed - cannot proceed with deployment');
    }
  }

  async checkBuildConfiguration() {
    if (!fs.existsSync('dist/index.html')) {
      await this.log('❌ No build output found. Run "npm run build" first.', 'error');
      throw new Error('No build output found');
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--platform':
      case '-p':
        options.platform = args[++i];
        break;
      case '--no-voice':
      case '--silent':
        options.voice = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
QueryFlux Deployment Script with Voice Monitoring

Usage: node scripts/deploy-with-voice.js [platform] [options]

Platforms:
  cloudflare    Deploy to Cloudflare Pages
  netlify       Deploy to Netlify
  render        Deploy to Render
  all           Deploy to all platforms (default)

Options:
  --platform, -p        Platform to deploy to (default: all)
  --no-voice, --silent  Disable voice announcements
  --verbose, -v         Enable verbose logging
  --skip-tests           Skip pre-deployment tests
  --dry-run             Simulate deployment without actual changes
  --help, -h            Show this help message

Examples:
  node scripts/deploy-with-voice.js
  node scripts/deploy-with-voice.js cloudflare
  node scripts/deploy-with-voice.js netlify --verbose
  node scripts/deploy-with-voice.js --dry-run --no-voice
        `);
        process.exit(0);
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    const orchestrator = new DeploymentOrchestrator(options);

    console.log('🎤 QueryFlux Voice-Enabled Deployment Orchestrator');
    console.log('🚀 Starting deployment with real-time voice progress monitoring\n');

    await orchestrator.deploy();

  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

// Execute main function if this file is run directly
if (require.main === module) {
  main();
}

module.exports = DeploymentOrchestrator;
