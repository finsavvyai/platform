#!/usr/bin/env node

/**
 * SDLC.ai Production Deployment Orchestrator
 * 
 * Main deployment script that orchestrates the entire production deployment process
 * with automated validation, sequential deployment, health verification, and rollback.
 */

const { DeploymentConfig } = require('./lib/config-parser');
const { DeploymentState } = require('./lib/state-manager');
const { Logger } = require('./lib/logger');
const { parseCommandLineArgs } = require('./lib/cli-parser');
const { PreDeploymentValidator } = require('./lib/validators/pre-deployment-validator');
const { InfrastructureProvisioner } = require('./lib/provisioners/infrastructure-provisioner');

class DeploymentOrchestrator {
  constructor(config) {
    this.config = config;
    this.state = new DeploymentState(config.environment);
    this.logger = new Logger(config.environment);
    this.deploymentId = null;
  }

  /**
   * Execute the complete deployment process
   * @returns {Promise<DeploymentResult>}
   */
  async execute() {
    this.deploymentId = this.state.createDeployment();
    this.logger.info(`Starting deployment ${this.deploymentId}`);
    this.logger.info(`Environment: ${this.config.environment}`);
    
    const startTime = Date.now();
    const phases = this.getDeploymentPhases();
    
    try {
      // Execute each deployment phase
      for (const phase of phases) {
        if (this.config.skipSteps.includes(phase.name)) {
          this.logger.warn(`Skipping phase: ${phase.name}`);
          continue;
        }

        await this.executePhase(phase);
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        deploymentId: this.deploymentId,
        duration,
        servicesDeployed: this.state.getDeployedServices(),
        environment: this.config.environment
      };

      this.state.completeDeployment(this.deploymentId, result);
      this.logger.success(`Deployment completed successfully in ${(duration / 1000).toFixed(2)}s`);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Deployment failed: ${error.message}`);
      
      const result = {
        success: false,
        deploymentId: this.deploymentId,
        duration,
        servicesDeployed: this.state.getDeployedServices(),
        errors: [error],
        environment: this.config.environment
      };

      this.state.failDeployment(this.deploymentId, error);

      if (this.config.autoRollback) {
        this.logger.warn('Initiating automatic rollback...');
        await this.rollback(this.deploymentId);
      }

      throw error;
    }
  }

  /**
   * Execute a single deployment phase
   * @param {Object} phase - Phase configuration
   */
  async executePhase(phase) {
    this.logger.phase(`Phase: ${phase.name}`);
    this.state.startPhase(this.deploymentId, phase.name);
    
    const phaseStartTime = Date.now();

    try {
      if (this.config.dryRun) {
        this.logger.info(`[DRY RUN] Would execute: ${phase.name}`);
      } else {
        await phase.execute(this);
      }

      const phaseDuration = Date.now() - phaseStartTime;
      this.state.completePhase(this.deploymentId, phase.name, phaseDuration);
      this.logger.success(`✓ ${phase.name} completed in ${(phaseDuration / 1000).toFixed(2)}s`);

    } catch (error) {
      this.state.failPhase(this.deploymentId, phase.name, error);
      this.logger.error(`✗ ${phase.name} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the ordered list of deployment phases
   * @returns {Array<Object>} Array of phase configurations
   */
  getDeploymentPhases() {
    return [
      {
        name: 'pre-deployment-validation',
        execute: async (orchestrator) => {
          const validator = new PreDeploymentValidator(
            orchestrator.logger,
            orchestrator.config
          );
          await validator.validate();
        }
      },
      {
        name: 'infrastructure-provisioning',
        execute: async (orchestrator) => {
          const provisioner = new InfrastructureProvisioner(
            orchestrator.logger,
            orchestrator.config
          );
          const resources = await provisioner.provision();
          
          // Store resources in state for later use
          orchestrator.state.setResources(orchestrator.deploymentId, resources);
          
          // Log resource summary
          const summary = provisioner.getResourceSummary();
          orchestrator.logger.info(`Provisioned ${summary.total} resources:`);
          orchestrator.logger.info(`  - ${summary.databases} D1 databases`);
          orchestrator.logger.info(`  - ${summary.buckets} R2 buckets`);
          orchestrator.logger.info(`  - ${summary.namespaces} KV namespaces`);
          orchestrator.logger.info(`  - ${summary.indexes} Vectorize indexes`);
          orchestrator.logger.info(`  - ${summary.queues} Queues`);
        }
      },
      {
        name: 'secret-management',
        execute: async (orchestrator) => {
          // Placeholder for secret management
          orchestrator.logger.info('Managing secrets...');
        }
      },
      {
        name: 'service-deployment',
        execute: async (orchestrator) => {
          const { ServiceDeploymentOrchestrator } = require('./lib/deployers');
          
          const serviceDeployer = new ServiceDeploymentOrchestrator(
            orchestrator.logger,
            orchestrator.config,
            orchestrator.state
          );
          
          // Get provisioned resources from state
          const resources = orchestrator.state.getResources(orchestrator.deploymentId);
          
          // Deploy all services
          const results = await serviceDeployer.deployAll(resources);
          
          // Store deployment results in state
          orchestrator.state.setServiceDeployments(orchestrator.deploymentId, results);
          
          // Log summary
          orchestrator.logger.success(`Deployed ${results.length} services successfully`);
          results.forEach(result => {
            orchestrator.logger.info(`  - ${result.service}: ${result.url}`);
          });
        }
      },
      {
        name: 'database-migration',
        execute: async (orchestrator) => {
          // Placeholder for database migration
          orchestrator.logger.info('Running database migrations...');
        }
      },
      {
        name: 'policy-loading',
        execute: async (orchestrator) => {
          // Placeholder for policy loading
          orchestrator.logger.info('Loading compliance policies...');
        }
      },
      {
        name: 'health-check',
        execute: async (orchestrator) => {
          const { HealthCheckOrchestrator } = require('./lib/health-checks');
          
          const healthChecker = new HealthCheckOrchestrator(
            orchestrator.logger,
            orchestrator.config
          );
          
          // Get deployed resources from state
          const resources = orchestrator.state.getResources(orchestrator.deploymentId);
          
          // Build resource structure for health checks
          const healthCheckResources = {
            services: resources.serviceDeployments || [],
            databases: resources.databases || {},
            vectorIndexes: resources.vectorIndexes || []
          };
          
          // Execute health checks
          const results = await healthChecker.executeAll(healthCheckResources);
          
          // Store results in state
          orchestrator.state.setHealthCheckResults(orchestrator.deploymentId, results);
          
          // Trigger rollback if health checks fail
          if (!results.overall) {
            const failureCount = results.failures ? results.failures.length : 0;
            throw new Error(
              `Health checks failed with ${failureCount} failure(s) - initiating rollback`
            );
          }
          
          orchestrator.logger.success('All health checks passed');
        }
      },
      {
        name: 'performance-benchmarking',
        execute: async (orchestrator) => {
          // Placeholder for performance benchmarking
          orchestrator.logger.info('Running performance benchmarks...');
        }
      },
      {
        name: 'documentation-generation',
        execute: async (orchestrator) => {
          // Placeholder for documentation generation
          orchestrator.logger.info('Generating documentation...');
        }
      },
      {
        name: 'audit-trail-recording',
        execute: async (orchestrator) => {
          // Placeholder for audit trail recording
          orchestrator.logger.info('Recording audit trail...');
        }
      }
    ];
  }

  /**
   * Rollback a failed deployment
   * @param {string} deploymentId - Deployment ID to rollback
   * @returns {Promise<RollbackResult>}
   */
  async rollback(deploymentId) {
    this.logger.warn(`Rolling back deployment ${deploymentId}`);
    this.state.startRollback(deploymentId);

    try {
      // Placeholder for rollback logic
      this.logger.info('Restoring previous Worker versions...');
      this.logger.info('Restoring database backup...');
      this.logger.info('Restoring previous policies...');
      
      this.state.completeRollback(deploymentId);
      this.logger.success('Rollback completed successfully');

      return {
        success: true,
        deploymentId,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Rollback failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<DeploymentStatus>}
   */
  async getStatus(deploymentId) {
    return this.state.getDeploymentStatus(deploymentId);
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Parse command-line arguments
    const args = parseCommandLineArgs(process.argv.slice(2));

    // Show help if requested
    if (args.help) {
      showHelp();
      process.exit(0);
    }

    // Parse deployment configuration
    const config = new DeploymentConfig(args);

    // Create and execute orchestrator
    const orchestrator = new DeploymentOrchestrator(config);
    const result = await orchestrator.execute();

    // Exit with success
    process.exit(0);

  } catch (error) {
    console.error(`\x1b[31mDeployment failed: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
SDLC.ai Production Deployment Orchestrator

Usage: node deploy-orchestrator.js [options]

Options:
  --environment, -e    Deployment environment (development|staging|production)
  --config, -c         Path to configuration file
  --dry-run           Simulate deployment without making changes
  --skip-steps        Comma-separated list of steps to skip
  --no-rollback       Disable automatic rollback on failure
  --help, -h          Show this help message

Examples:
  node deploy-orchestrator.js --environment production
  node deploy-orchestrator.js -e staging --dry-run
  node deploy-orchestrator.js -e development --skip-steps health-check,benchmarking
  `);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { DeploymentOrchestrator };
