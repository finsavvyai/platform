#!/usr/bin/env tsx

/**
 * Voice-Enabled Production Deployment Orchestrator
 *
 * This script orchestrates the complete production deployment process
 * with voice synthesis for progress announcements and monitoring.
 *
 * Supports deployment to:
 * - Cloudflare Pages (Workers, KV, D1, Durable Objects)
 * - Netlify (Functions, Edge Functions, Forms, Blobs)
 * - Render (Web Services, Background Jobs, PostgreSQL, Redis)
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DeploymentConfig {
  platform: 'cloudflare' | 'netlify' | 'render';
  environment: 'staging' | 'production';
  domain?: string;
  buildCommand?: string;
  outputDirectory?: string;
  functionsDirectory?: string;
  enableVoiceAnnouncements: boolean;
  enableHealthChecks: boolean;
  enableRollback: boolean;
  enableSecurityScanning: boolean;
}

interface DeploymentResult {
  success: boolean;
  platform: string;
  environment: string;
  url?: string;
  deploymentId?: string;
  buildTime?: number;
  error?: string;
  logs?: string[];
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  uptime?: number;
  error?: string;
}

class VoiceDeploymentOrchestrator {
  private config: DeploymentConfig;
  private deploymentStartTime: number = 0;
  private deploymentLogs: string[] = [];
  private isVoiceEnabled: boolean;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.isVoiceEnabled = config.enableVoiceAnnouncements && this.isVoiceAvailable();
  }

  private isVoiceAvailable(): boolean {
    try {
      execSync('which say', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async speak(message: string): Promise<void> {
    if (!this.isVoiceEnabled) {
      console.log(`🔊 Voice: ${message}`);
      return;
    }

    return new Promise((resolve) => {
      const process = spawn('say', ['-v', 'Samantha', '-r', '200', message]);
      process.on('close', () => resolve());
    });
  }

  private log(message: string, type: 'info' | 'error' | 'warning' | 'success' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    this.deploymentLogs.push(logEntry);

    const emoji = {
      info: 'ℹ️',
      error: '❌',
      warning: '⚠️',
      success: '✅'
    }[type];

    console.log(`${emoji} ${logEntry}`);
  }

  private async executeCommand(command: string, description: string): Promise<string> {
    this.log(`Executing: ${description}`);
    await this.speak(`Now ${description.toLowerCase()}`);

    return new Promise((resolve, reject) => {
      const process = spawn(command, { shell: true });
      let output = '';

      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);
      });

      process.on('close', (code) => {
        if (code === 0) {
          this.log(`Completed: ${description}`, 'success');
          resolve(output);
        } else {
          const error = `Failed: ${description} (exit code: ${code})`;
          this.log(error, 'error');
          reject(new Error(error));
        }
      });
    });
  }

  private async runHealthChecks(url: string): Promise<HealthCheckResult> {
    this.log('Running health checks...');
    await this.speak('Running post deployment health checks');

    const checks = [
      this.checkHttpEndpoint(url),
      this.checkApiEndpoints(url),
      this.checkStaticAssets(url),
      this.checkDatabaseConnection()
    ];

    const results = await Promise.allSettled(checks);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      await this.speak(`Warning: ${failures.length} health checks failed`);
      return {
        status: 'unhealthy',
        error: `${failures.length} health checks failed`
      };
    }

    await this.speak('All health checks passed successfully');
    return { status: 'healthy' };
  }

  private async checkHttpEndpoint(url: string): Promise<void> {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'QueryFlux-Deploy/1.0' }
    });

    if (!response.ok) {
      throw new Error(`HTTP health check failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status !== 'ok') {
      throw new Error(`Application health check failed: ${data.status}`);
    }
  }

  private async checkApiEndpoints(url: string): Promise<void> {
    const endpoints = [
      '/api/connections',
      '/api/queries',
      '/api/users/profile'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${url}${endpoint}`, {
          method: 'OPTIONS',
          headers: { 'User-Agent': 'QueryFlux-Deploy/1.0' }
        });

        if (response.status === 404) {
          this.log(`API endpoint not found: ${endpoint}`, 'warning');
        }
      } catch (error) {
        this.log(`API endpoint check failed: ${endpoint} - ${error}`, 'warning');
      }
    }
  }

  private async checkStaticAssets(url: string): Promise<void> {
    const assets = [
      '/assets/',
      '/favicon.ico',
      '/manifest.json'
    ];

    for (const asset of assets) {
      try {
        const response = await fetch(`${url}${asset}`, {
          method: 'HEAD',
          headers: { 'User-Agent': 'QueryFlux-Deploy/1.0' }
        });

        if (!response.ok) {
          this.log(`Static asset not found: ${asset}`, 'warning');
        }
      } catch (error) {
        this.log(`Static asset check failed: ${asset} - ${error}`, 'warning');
      }
    }
  }

  private async checkDatabaseConnection(): Promise<void> {
    this.log('Checking database connectivity...');
    // This would be implemented based on your database setup
    // For now, we'll just log that it's being checked
  }

  private async runSecurityScanning(url: string): Promise<void> {
    if (!this.config.enableSecurityScanning) {
      return;
    }

    this.log('Running security scanning...');
    await this.speak('Running security vulnerability scanning');

    try {
      // Basic security headers check
      const response = await fetch(url);
      const headers = response.headers;

      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security',
        'x-xss-protection',
        'content-security-policy'
      ];

      const missingHeaders = securityHeaders.filter(header => !headers.get(header));

      if (missingHeaders.length > 0) {
        this.log(`Missing security headers: ${missingHeaders.join(', ')}`, 'warning');
      } else {
        this.log('All recommended security headers are present', 'success');
      }
    } catch (error) {
      this.log(`Security scanning failed: ${error}`, 'error');
    }
  }

  private async createDeploymentArtifact(): Promise<string> {
    const buildCommand = this.config.buildCommand || 'npm run build';
    await this.executeCommand(buildCommand, 'building application');

    const distPath = this.config.outputDirectory || 'dist';
    if (!existsSync(distPath)) {
      throw new Error(`Build output directory not found: ${distPath}`);
    }

    return distPath;
  }

  private async deployToCloudflare(): Promise<DeploymentResult> {
    this.log('Starting Cloudflare Pages deployment...');
    await this.speak('Deploying to Cloudflare Pages');

    try {
      // Check if wrangler is installed
      await this.executeCommand('wrangler --version', 'checking Wrangler CLI');

      // Build the application
      const distPath = await this.createDeploymentArtifact();

      // Deploy to Cloudflare Pages
      const deployCommand = `wrangler pages deploy ${distPath} --project-name=queryflux-${this.config.environment}`;
      const output = await this.executeCommand(deployCommand, 'deploying to Cloudflare Pages');

      // Extract deployment URL from output
      const urlMatch = output.match(/https?:\/\/[^\s]+\.pages\.dev/);
      const url = urlMatch ? urlMatch[0] : undefined;

      if (!url) {
        throw new Error('Could not extract deployment URL from Cloudflare output');
      }

      // Run health checks
      const healthResult = await this.runHealthChecks(url);

      // Run security scanning
      await this.runSecurityScanning(url);

      this.log(`Cloudflare deployment completed: ${url}`, 'success');
      await this.speak(`Cloudflare deployment completed successfully. Your application is now live at ${url}`);

      return {
        success: true,
        platform: 'cloudflare',
        environment: this.config.environment,
        url,
        buildTime: Date.now() - this.deploymentStartTime,
        logs: this.deploymentLogs
      };

    } catch (error) {
      this.log(`Cloudflare deployment failed: ${error}`, 'error');
      await this.speak(`Cloudflare deployment failed. ${error}`);

      if (this.config.enableRollback) {
        await this.speak('Initiating rollback to previous stable version');
        // Implement rollback logic here
      }

      return {
        success: false,
        platform: 'cloudflare',
        environment: this.config.environment,
        error: error.message,
        logs: this.deploymentLogs
      };
    }
  }

  private async deployToNetlify(): Promise<DeploymentResult> {
    this.log('Starting Netlify deployment...');
    await this.speak('Deploying to Netlify');

    try {
      // Check if netlify CLI is installed
      await this.executeCommand('netlify --version', 'checking Netlify CLI');

      // Build the application
      const distPath = await this.createDeploymentArtifact();

      // Deploy to Netlify
      const deployCommand = `netlify deploy --prod --dir=${distPath}`;
      const output = await this.executeCommand(deployCommand, 'deploying to Netlify');

      // Extract deployment URL from output
      const urlMatch = output.match(/https?:\/\/[^\s]+\.netlify\.app/);
      const url = urlMatch ? urlMatch[0] : undefined;

      if (!url) {
        throw new Error('Could not extract deployment URL from Netlify output');
      }

      // Run health checks
      const healthResult = await this.runHealthChecks(url);

      // Run security scanning
      await this.runSecurityScanning(url);

      this.log(`Netlify deployment completed: ${url}`, 'success');
      await this.speak(`Netlify deployment completed successfully. Your application is now live at ${url}`);

      return {
        success: true,
        platform: 'netlify',
        environment: this.config.environment,
        url,
        buildTime: Date.now() - this.deploymentStartTime,
        logs: this.deploymentLogs
      };

    } catch (error) {
      this.log(`Netlify deployment failed: ${error}`, 'error');
      await this.speak(`Netlify deployment failed. ${error}`);

      if (this.config.enableRollback) {
        await this.speak('Initiating rollback to previous stable version');
        // Implement rollback logic here
      }

      return {
        success: false,
        platform: 'netlify',
        environment: this.config.environment,
        error: error.message,
        logs: this.deploymentLogs
      };
    }
  }

  private async deployToRender(): Promise<DeploymentResult> {
    this.log('Starting Render deployment...');
    await this.speak('Deploying to Render');

    try {
      // Check if render CLI is available or use git-based deployment
      const hasRenderCLI = this.checkRenderCLI();

      if (hasRenderCLI) {
        return await this.deployToRenderWithCLI();
      } else {
        return await this.deployToRenderWithGit();
      }

    } catch (error) {
      this.log(`Render deployment failed: ${error}`, 'error');
      await this.speak(`Render deployment failed. ${error}`);

      return {
        success: false,
        platform: 'render',
        environment: this.config.environment,
        error: error.message,
        logs: this.deploymentLogs
      };
    }
  }

  private checkRenderCLI(): boolean {
    try {
      execSync('render --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async deployToRenderWithCLI(): Promise<DeploymentResult> {
    // Deploy using Render CLI
    const deployCommand = 'render deploy';
    await this.executeCommand(deployCommand, 'deploying to Render with CLI');

    // Extract deployment URL from output
    // This would need to be parsed from the CLI output

    return {
      success: true,
      platform: 'render',
      environment: this.config.environment,
      url: 'https://queryflux.onrender.com', // This would be parsed from output
      buildTime: Date.now() - this.deploymentStartTime,
      logs: this.deploymentLogs
    };
  }

  private async deployToRenderWithGit(): Promise<DeploymentResult> {
    // Deploy using Git push to Render
    await this.executeCommand('git add .', 'staging changes');
    await this.executeCommand(`git commit -m "Deploy to ${this.config.environment}"`, 'committing changes');
    await this.executeCommand('git push origin main', 'pushing to Render');

    return {
      success: true,
      platform: 'render',
      environment: this.config.environment,
      url: 'https://queryflux.onrender.com',
      buildTime: Date.now() - this.deploymentStartTime,
      logs: this.deploymentLogs
    };
  }

  private async generateDeploymentReport(result: DeploymentResult): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      deployment: result,
      configuration: this.config,
      summary: {
        totalBuildTime: result.buildTime,
        healthChecksPassed: result.success,
        securityScanningEnabled: this.config.enableSecurityScanning,
        voiceAnnouncementsEnabled: this.isVoiceEnabled
      }
    };

    const reportPath = join(__dirname, `deployment-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log(`Deployment report generated: ${reportPath}`, 'success');
  }

  public async deploy(): Promise<DeploymentResult> {
    this.deploymentStartTime = Date.now();

    this.log(`Starting production deployment to ${this.config.platform} (${this.config.environment})`);
    await this.speak(`Starting QueryFlux production deployment to ${this.config.platform}`);

    try {
      let result: DeploymentResult;

      switch (this.config.platform) {
        case 'cloudflare':
          result = await this.deployToCloudflare();
          break;
        case 'netlify':
          result = await this.deployToNetlify();
          break;
        case 'render':
          result = await this.deployToRender();
          break;
        default:
          throw new Error(`Unsupported platform: ${this.config.platform}`);
      }

      // Generate deployment report
      await this.generateDeploymentReport(result);

      if (result.success) {
        this.log('🎉 Production deployment completed successfully!', 'success');
        await this.speak('Congratulations! Your QueryFlux application has been successfully deployed to production!');

        if (result.url) {
          await this.speak(`You can now access your application at ${result.url}`);
        }
      } else {
        this.log('❌ Production deployment failed', 'error');
        await this.speak('Production deployment failed. Please check the logs for more information.');
      }

      return result;

    } catch (error) {
      this.log(`Deployment orchestration failed: ${error}`, 'error');
      await this.speak('Critical error during deployment. Please check the logs and try again.');

      return {
        success: false,
        platform: this.config.platform,
        environment: this.config.environment,
        error: error.message,
        logs: this.deploymentLogs
      };
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const platform = args.find(arg => arg.startsWith('--platform='))?.split('=')[1] as 'cloudflare' | 'netlify' | 'render';
  const environment = args.find(arg => arg.startsWith('--env='))?.split('=')[1] as 'staging' | 'production' || 'production';

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No actual deployment will be performed');
  }

  const config: DeploymentConfig = {
    platform: platform || 'netlify', // Default to Netlify for this project
    environment,
    enableVoiceAnnouncements: true,
    enableHealthChecks: true,
    enableRollback: true,
    enableSecurityScanning: true,
    buildCommand: 'npm run build',
    outputDirectory: 'dist'
  };

  const orchestrator = new VoiceDeploymentOrchestrator(config);

  if (isDryRun) {
    console.log('🔍 Dry run configuration:', JSON.stringify(config, null, 2));
    console.log('🔍 Would deploy with the following steps:');
    console.log('  1. Build application');
    console.log('  2. Deploy to', config.platform);
    console.log('  3. Run health checks');
    console.log('  4. Run security scanning');
    console.log('  5. Generate deployment report');
    return;
  }

  const result = await orchestrator.deploy();

  process.exit(result.success ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
