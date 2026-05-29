/**
 * Service Deployment Orchestrator
 * 
 * Manages the sequential deployment of all services in the correct order,
 * handling dependencies and deployment failures.
 */

class ServiceDeploymentOrchestrator {
  constructor(logger, config, state) {
    this.logger = logger;
    this.config = config;
    this.state = state;
    this.deployedServices = [];
    this.failedService = null;
  }

  /**
   * Get the deployment order for all services
   * Services are deployed in dependency order
   * @returns {Array<Object>} Array of service configurations
   */
  getDeploymentOrder() {
    return [
      {
        name: 'gateway',
        path: 'services/gateway-worker',
        type: 'worker',
        healthCheckEndpoint: '/api/health',
        dependencies: []
      },
      {
        name: 'rag',
        path: 'services/rag',
        type: 'worker',
        healthCheckEndpoint: '/api/rag/health',
        dependencies: ['gateway']
      },
      {
        name: 'dlp',
        path: 'services/dlp',
        type: 'worker',
        healthCheckEndpoint: '/api/dlp/health',
        dependencies: ['gateway']
      },
      {
        name: 'llm-gateway',
        path: 'services/llm-gateway',
        type: 'worker',
        healthCheckEndpoint: '/api/llm/health',
        dependencies: ['gateway']
      },
      {
        name: 'lam-system',
        path: 'services',
        type: 'worker',
        healthCheckEndpoint: '/api/lam/health',
        dependencies: ['gateway', 'rag', 'dlp']
      },
      {
        name: 'admin-ui',
        path: 'services/admin-ui',
        type: 'pages',
        healthCheckEndpoint: '/',
        dependencies: ['gateway', 'rag', 'dlp', 'llm-gateway', 'lam-system']
      }
    ];
  }

  /**
   * Deploy all services in the correct order
   * @param {Object} resources - Provisioned infrastructure resources
   * @returns {Promise<Array<Object>>} Array of deployment results
   */
  async deployAll(resources) {
    this.logger.info('Starting service deployment...');
    
    const services = this.getDeploymentOrder();
    const results = [];

    for (const service of services) {
      try {
        this.logger.info(`Deploying service: ${service.name}`);
        
        // Check dependencies
        await this.verifyDependencies(service);
        
        // Deploy the service
        const result = await this.deployService(service, resources);
        
        // Track successful deployment
        this.deployedServices.push(service.name);
        results.push(result);
        
        this.logger.success(`✓ ${service.name} deployed successfully`);
        
      } catch (error) {
        this.failedService = service.name;
        this.logger.error(`✗ ${service.name} deployment failed: ${error.message}`);
        
        // Add failure information
        results.push({
          service: service.name,
          success: false,
          error: error.message
        });
        
        throw new Error(
          `Service deployment failed at ${service.name}: ${error.message}`
        );
      }
    }

    this.logger.success(`All ${services.length} services deployed successfully`);
    return results;
  }

  /**
   * Verify that service dependencies are deployed
   * @param {Object} service - Service configuration
   * @throws {Error} If dependencies are not met
   */
  async verifyDependencies(service) {
    if (!service.dependencies || service.dependencies.length === 0) {
      return;
    }

    for (const dependency of service.dependencies) {
      if (!this.deployedServices.includes(dependency)) {
        throw new Error(
          `Dependency not met: ${service.name} requires ${dependency} to be deployed first`
        );
      }
    }
  }

  /**
   * Deploy a single service
   * @param {Object} service - Service configuration
   * @param {Object} resources - Infrastructure resources
   * @returns {Promise<Object>} Deployment result
   */
  async deployService(service, resources) {
    // Get the appropriate deployer for this service
    const deployer = this.getDeployer(service.name);
    
    if (!deployer) {
      throw new Error(`No deployer found for service: ${service.name}`);
    }

    // Deploy the service using its specific deployer
    return await deployer.deploy(resources);
  }

  /**
   * Get the deployer instance for a service
   * @param {string} serviceName - Name of the service
   * @returns {Object} Deployer instance
   */
  getDeployer(serviceName) {
    const { 
      GatewayDeployer,
      RAGDeployer,
      DLPDeployer,
      LLMGatewayDeployer,
      LAMSystemDeployer,
      AdminUIDeployer
    } = require('./index');

    const deployerMap = {
      'gateway': new GatewayDeployer(this.logger, this.config),
      'rag': new RAGDeployer(this.logger, this.config),
      'dlp': new DLPDeployer(this.logger, this.config),
      'llm-gateway': new LLMGatewayDeployer(this.logger, this.config),
      'lam-system': new LAMSystemDeployer(this.logger, this.config),
      'admin-ui': new AdminUIDeployer(this.logger, this.config)
    };

    return deployerMap[serviceName];
  }

  /**
   * Get list of successfully deployed services
   * @returns {Array<string>} Service names
   */
  getDeployedServices() {
    return [...this.deployedServices];
  }

  /**
   * Get the service that failed deployment
   * @returns {string|null} Service name or null
   */
  getFailedService() {
    return this.failedService;
  }

  /**
   * Handle deployment failure
   * @param {string} serviceName - Name of failed service
   * @param {Error} error - Error that occurred
   */
  handleDeploymentFailure(serviceName, error) {
    this.logger.error(`Deployment failure in ${serviceName}`);
    this.logger.error(`Error: ${error.message}`);
    
    // Log deployed services for rollback
    if (this.deployedServices.length > 0) {
      this.logger.warn(`Services deployed before failure: ${this.deployedServices.join(', ')}`);
      this.logger.warn('These services will need to be rolled back');
    }
    
    throw error;
  }
}

module.exports = { ServiceDeploymentOrchestrator };
