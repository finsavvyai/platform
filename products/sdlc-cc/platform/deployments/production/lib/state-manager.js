/**
 * Deployment state management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DeploymentState {
  constructor(environment) {
    this.environment = environment;
    this.stateDir = path.join(__dirname, '..', '.deployment-state');
    this.deployments = new Map();
    
    // Ensure state directory exists
    this.ensureStateDirectory();
    
    // Load existing state
    this.loadState();
  }

  /**
   * Ensure state directory exists
   */
  ensureStateDirectory() {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /**
   * Generate unique deployment ID
   * @returns {string} Deployment ID
   */
  generateDeploymentId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `deploy-${this.environment}-${timestamp}-${random}`;
  }

  /**
   * Create a new deployment
   * @returns {string} Deployment ID
   */
  createDeployment() {
    const deploymentId = this.generateDeploymentId();
    
    const deployment = {
      id: deploymentId,
      environment: this.environment,
      status: 'in-progress',
      startTime: new Date().toISOString(),
      endTime: null,
      currentPhase: null,
      completedPhases: [],
      failedPhase: null,
      error: null,
      resourcesCreated: [],
      servicesDeployed: [],
      phases: []
    };

    this.deployments.set(deploymentId, deployment);
    this.saveState();
    
    return deploymentId;
  }

  /**
   * Start a deployment phase
   * @param {string} deploymentId - Deployment ID
   * @param {string} phaseName - Phase name
   */
  startPhase(deploymentId, phaseName) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.currentPhase = phaseName;
    
    const phase = {
      name: phaseName,
      status: 'in-progress',
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      error: null
    };

    deployment.phases.push(phase);
    this.saveState();
  }

  /**
   * Complete a deployment phase
   * @param {string} deploymentId - Deployment ID
   * @param {string} phaseName - Phase name
   * @param {number} duration - Phase duration in milliseconds
   */
  completePhase(deploymentId, phaseName, duration) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const phase = deployment.phases.find(p => p.name === phaseName && p.status === 'in-progress');
    if (phase) {
      phase.status = 'completed';
      phase.endTime = new Date().toISOString();
      phase.duration = duration;
    }

    deployment.completedPhases.push(phaseName);
    deployment.currentPhase = null;
    this.saveState();
  }

  /**
   * Fail a deployment phase
   * @param {string} deploymentId - Deployment ID
   * @param {string} phaseName - Phase name
   * @param {Error} error - Error that caused failure
   */
  failPhase(deploymentId, phaseName, error) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const phase = deployment.phases.find(p => p.name === phaseName && p.status === 'in-progress');
    if (phase) {
      phase.status = 'failed';
      phase.endTime = new Date().toISOString();
      phase.error = {
        message: error.message,
        stack: error.stack
      };
    }

    deployment.failedPhase = phaseName;
    deployment.currentPhase = null;
    this.saveState();
  }

  /**
   * Complete a deployment
   * @param {string} deploymentId - Deployment ID
   * @param {Object} result - Deployment result
   */
  completeDeployment(deploymentId, result) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = 'completed';
    deployment.endTime = new Date().toISOString();
    deployment.result = result;
    this.saveState();
  }

  /**
   * Fail a deployment
   * @param {string} deploymentId - Deployment ID
   * @param {Error} error - Error that caused failure
   */
  failDeployment(deploymentId, error) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = 'failed';
    deployment.endTime = new Date().toISOString();
    deployment.error = {
      message: error.message,
      stack: error.stack
    };
    this.saveState();
  }

  /**
   * Start rollback
   * @param {string} deploymentId - Deployment ID
   */
  startRollback(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = 'rolling-back';
    deployment.rollbackStartTime = new Date().toISOString();
    this.saveState();
  }

  /**
   * Complete rollback
   * @param {string} deploymentId - Deployment ID
   */
  completeRollback(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.status = 'rolled-back';
    deployment.rollbackEndTime = new Date().toISOString();
    this.saveState();
  }

  /**
   * Add created resource
   * @param {string} deploymentId - Deployment ID
   * @param {Object} resource - Resource details
   */
  addResource(deploymentId, resource) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.resourcesCreated.push({
      ...resource,
      createdAt: new Date().toISOString()
    });
    this.saveState();
  }

  /**
   * Set provisioned resources
   * @param {string} deploymentId - Deployment ID
   * @param {Object} resources - Provisioned resources
   */
  setResources(deploymentId, resources) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.resources = resources;
    this.saveState();
  }

  /**
   * Add deployed service
   * @param {string} deploymentId - Deployment ID
   * @param {string} serviceName - Service name
   */
  addService(deploymentId, serviceName) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    if (!deployment.servicesDeployed.includes(serviceName)) {
      deployment.servicesDeployed.push(serviceName);
      this.saveState();
    }
  }

  /**
   * Get deployed services
   * @returns {Array<string>} List of deployed services
   */
  getDeployedServices() {
    const deployments = Array.from(this.deployments.values());
    const latest = deployments[deployments.length - 1];
    return latest ? latest.servicesDeployed : [];
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {Object} Deployment status
   */
  getDeploymentStatus(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    return {
      id: deployment.id,
      environment: deployment.environment,
      status: deployment.status,
      startTime: deployment.startTime,
      endTime: deployment.endTime,
      currentPhase: deployment.currentPhase,
      completedPhases: deployment.completedPhases,
      failedPhase: deployment.failedPhase,
      servicesDeployed: deployment.servicesDeployed,
      resourcesCreated: deployment.resourcesCreated
    };
  }

  /**
   * Get all deployments
   * @returns {Array<Object>} List of all deployments
   */
  getAllDeployments() {
    return Array.from(this.deployments.values());
  }

  /**
   * Get latest deployment
   * @returns {Object|null} Latest deployment or null
   */
  getLatestDeployment() {
    const deployments = this.getAllDeployments();
    return deployments.length > 0 ? deployments[deployments.length - 1] : null;
  }

  /**
   * Save state to disk
   */
  saveState() {
    const stateFile = path.join(this.stateDir, `${this.environment}.json`);
    const state = {
      environment: this.environment,
      deployments: Array.from(this.deployments.values()),
      lastUpdated: new Date().toISOString()
    };

    try {
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      console.error(`Failed to save state: ${error.message}`);
    }
  }

  /**
   * Load state from disk
   */
  loadState() {
    const stateFile = path.join(this.stateDir, `${this.environment}.json`);
    
    if (!fs.existsSync(stateFile)) {
      return;
    }

    try {
      const content = fs.readFileSync(stateFile, 'utf8');
      const state = JSON.parse(content);
      
      if (state.deployments) {
        for (const deployment of state.deployments) {
          this.deployments.set(deployment.id, deployment);
        }
      }
    } catch (error) {
      console.error(`Failed to load state: ${error.message}`);
    }
  }

  /**
   * Clean up old deployments
   * @param {number} retentionDays - Number of days to retain
   */
  cleanup(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deploymentsToRemove = [];

    for (const [id, deployment] of this.deployments.entries()) {
      const deploymentDate = new Date(deployment.startTime);
      if (deploymentDate < cutoffDate && deployment.status !== 'in-progress') {
        deploymentsToRemove.push(id);
      }
    }

    for (const id of deploymentsToRemove) {
      this.deployments.delete(id);
    }

    if (deploymentsToRemove.length > 0) {
      this.saveState();
    }

    return deploymentsToRemove.length;
  }
}

module.exports = { DeploymentState };
