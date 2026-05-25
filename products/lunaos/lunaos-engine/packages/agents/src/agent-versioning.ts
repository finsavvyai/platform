import { EventEmitter } from 'events';
import { Agent, AgentVersion, VersionMetadata, DeploymentStatus } from './interfaces';
import { logger } from '@claude-agent/utils';

export interface VersioningConfig {
  maxVersionsPerAgent?: number;
  retentionDays?: number;
  autoCleanup?: boolean;
  backupEnabled?: boolean;
}

export interface VersionDeploymentResult {
  success: boolean;
  version: AgentVersion;
  deploymentTime: Date;
  rollbackVersion?: AgentVersion;
  error?: string;
}

export class AgentVersioningSystem extends EventEmitter {
  private versions = new Map<string, AgentVersion[]>();
  private currentVersions = new Map<string, string>();
  private deployments = new Map<string, VersionDeploymentResult[]>();
  private config: VersioningConfig;

  constructor(config: VersioningConfig = {}) {
    super();
    this.config = {
      maxVersionsPerAgent: 10,
      retentionDays: 30,
      autoCleanup: true,
      backupEnabled: true,
      ...config
    };
  }

  async createVersion(agent: Agent, changelog?: string): Promise<AgentVersion> {
    const versionId = this.generateVersionId(agent.id);
    const semanticVersion = this.generateSemanticVersion(agent.id);

    const version: AgentVersion = {
      id: versionId,
      agentId: agent.id,
      version: semanticVersion,
      config: { ...agent.config },
      capabilities: [...agent.capabilities],
      dependencies: [...agent.dependencies],
      metadata: {
        changelog,
        createdBy: 'system', // Should come from auth context
        tags: [],
        deploymentNotes: '',
        rollbackInfo: undefined,
        compatibleWith: []
      },
      status: DeploymentStatus.DRAFT,
      createdAt: new Date(),
      deployedAt: undefined,
      isStable: false,
      isProductionReady: false,
      backupPath: this.config.backupEnabled ? this.createBackup(agent) : undefined
    };

    // Store version
    const agentVersions = this.versions.get(agent.id) || [];
    agentVersions.push(version);
    this.versions.set(agent.id, agentVersions);

    logger.info(`Created version ${semanticVersion} for agent ${agent.id}`);

    // Emit version created event
    this.emit('version:created', {
      agentId: agent.id,
      versionId,
      version: semanticVersion,
      timestamp: new Date()
    });

    // Cleanup old versions if enabled
    if (this.config.autoCleanup) {
      await this.cleanupOldVersions(agent.id);
    }

    return version;
  }

  async deployVersion(agentId: string, versionId: string, targetEnvironment: string = 'production'): Promise<VersionDeploymentResult> {
    const version = await this.getVersion(agentId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for agent ${agentId}`);
    }

    logger.info(`Deploying version ${version.version} for agent ${agentId} to ${targetEnvironment}`);

    const deploymentResult: VersionDeploymentResult = {
      success: false,
      version,
      deploymentTime: new Date()
    };

    try {
      // Pre-deployment checks
      await this.performPreDeploymentChecks(version, targetEnvironment);

      // Get previous version for potential rollback
      const previousVersionId = this.currentVersions.get(agentId);
      const previousVersion = previousVersionId ?
        await this.getVersion(agentId, previousVersionId) : undefined;

      // Update version status
      version.status = DeploymentStatus.DEPLOYING;
      version.deployedAt = new Date();

      // Simulate deployment process
      await this.performDeployment(version, targetEnvironment);

      // Update version status to deployed
      version.status = DeploymentStatus.DEPLOYED;

      // Update current version tracking
      this.currentVersions.set(agentId, versionId);

      // Mark version as stable if deployment succeeds
      if (targetEnvironment === 'production') {
        version.isProductionReady = true;
      }
      version.isStable = true;

      // Store deployment result
      deploymentResult.success = true;

      // Store in deployment history
      const agentDeployments = this.deployments.get(agentId) || [];
      agentDeployments.push(deploymentResult);
      this.deployments.set(agentId, agentDeployments);

      logger.info(`Successfully deployed version ${version.version} for agent ${agentId}`);

      // Emit deployment success event
      this.emit('version:deployed', {
        agentId,
        versionId,
        version: version.version,
        environment: targetEnvironment,
        previousVersionId,
        timestamp: new Date()
      });

      return deploymentResult;

    } catch (error) {
      // Mark deployment as failed
      version.status = DeploymentStatus.FAILED;
      deploymentResult.success = false;
      deploymentResult.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Failed to deploy version ${version.version} for agent ${agentId}:`, error);

      // Emit deployment failure event
      this.emit('version:deployment:failed', {
        agentId,
        versionId,
        version: version.version,
        environment: targetEnvironment,
        error: deploymentResult.error,
        timestamp: new Date()
      });

      return deploymentResult;
    }
  }

  async rollbackVersion(agentId: string, targetVersionId?: string): Promise<VersionDeploymentResult> {
    const currentVersionId = this.currentVersions.get(agentId);
    if (!currentVersionId) {
      throw new Error(`No current version found for agent ${agentId}`);
    }

    const currentVersion = await this.getVersion(agentId, currentVersionId);
    if (!currentVersion) {
      throw new Error(`Current version ${currentVersionId} not found for agent ${agentId}`);
    }

    // Determine rollback target
    let targetVersion: AgentVersion;

    if (targetVersionId) {
      targetVersion = await this.getVersion(agentId, targetVersionId);
      if (!targetVersion) {
        throw new Error(`Target rollback version ${targetVersionId} not found for agent ${agentId}`);
      }
    } else {
      // Find previous stable version
      targetVersion = await this.findPreviousStableVersion(agentId, currentVersionId);
      if (!targetVersion) {
        throw new Error(`No stable version found for rollback of agent ${agentId}`);
      }
    }

    logger.info(`Rolling back agent ${agentId} from version ${currentVersion.version} to ${targetVersion.version}`);

    const rollbackResult: VersionDeploymentResult = {
      success: false,
      version: targetVersion,
      rollbackVersion: currentVersion,
      deploymentTime: new Date()
    };

    try {
      // Pre-rollback checks
      await this.performPreRollbackChecks(targetVersion, currentVersion);

      // Update current version status to rolling back
      currentVersion.status = DeploymentStatus.ROLLING_BACK;

      // Simulate rollback process
      await this.performRollback(targetVersion, currentVersion);

      // Update target version status
      targetVersion.status = DeploymentStatus.DEPLOYED;
      targetVersion.deployedAt = new Date();

      // Update current version status
      currentVersion.status = DeploymentStatus.ROLLED_BACK;

      // Update current version tracking
      this.currentVersions.set(agentId, targetVersion.id);

      // Store rollback result
      rollbackResult.success = true;

      // Store in deployment history
      const agentDeployments = this.deployments.get(agentId) || [];
      agentDeployments.push(rollbackResult);
      this.deployments.set(agentId, agentDeployments);

      logger.info(`Successfully rolled back agent ${agentId} to version ${targetVersion.version}`);

      // Emit rollback success event
      this.emit('version:rolledback', {
        agentId,
        fromVersion: currentVersion.version,
        toVersion: targetVersion.version,
        fromVersionId: currentVersion.id,
        toVersionId: targetVersion.id,
        timestamp: new Date()
      });

      return rollbackResult;

    } catch (error) {
      // Mark rollback as failed
      rollbackResult.success = false;
      rollbackResult.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Failed to rollback agent ${agentId} to version ${targetVersion.version}:`, error);

      // Emit rollback failure event
      this.emit('version:rollback:failed', {
        agentId,
        fromVersion: currentVersion.version,
        toVersion: targetVersion.version,
        error: rollbackResult.error,
        timestamp: new Date()
      });

      return rollbackResult;
    }
  }

  async getVersion(agentId: string, versionId: string): Promise<AgentVersion | null> {
    const agentVersions = this.versions.get(agentId);
    if (!agentVersions) {
      return null;
    }

    return agentVersions.find(v => v.id === versionId) || null;
  }

  async getVersions(agentId: string, status?: DeploymentStatus): Promise<AgentVersion[]> {
    const agentVersions = this.versions.get(agentId) || [];

    if (status) {
      return agentVersions.filter(v => v.status === status);
    }

    return [...agentVersions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCurrentVersion(agentId: string): Promise<AgentVersion | null> {
    const currentVersionId = this.currentVersions.get(agentId);
    if (!currentVersionId) {
      return null;
    }

    return this.getVersion(agentId, currentVersionId);
  }

  async getDeploymentHistory(agentId: string): Promise<VersionDeploymentResult[]> {
    const deployments = this.deployments.get(agentId) || [];
    return [...deployments].sort((a, b) => b.deploymentTime.getTime() - a.deploymentTime.getTime());
  }

  async compareVersions(agentId: string, versionId1: string, versionId2: string): Promise<{
    version1: AgentVersion;
    version2: AgentVersion;
    differences: {
      config: boolean;
      capabilities: boolean;
      dependencies: boolean;
      metadata: boolean;
    };
  }> {
    const version1 = await this.getVersion(agentId, versionId1);
    const version2 = await this.getVersion(agentId, versionId2);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    const differences = {
      config: JSON.stringify(version1.config) !== JSON.stringify(version2.config),
      capabilities: JSON.stringify(version1.capabilities) !== JSON.stringify(version2.capabilities),
      dependencies: JSON.stringify(version1.dependencies) !== JSON.stringify(version2.dependencies),
      metadata: JSON.stringify(version1.metadata) !== JSON.stringify(version2.metadata)
    };

    return { version1, version2, differences };
  }

  async deleteVersion(agentId: string, versionId: string): Promise<void> {
    const agentVersions = this.versions.get(agentId);
    if (!agentVersions) {
      throw new Error(`No versions found for agent ${agentId}`);
    }

    const versionIndex = agentVersions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) {
      throw new Error(`Version ${versionId} not found for agent ${agentId}`);
    }

    const version = agentVersions[versionIndex];

    // Cannot delete currently deployed version
    const currentVersionId = this.currentVersions.get(agentId);
    if (currentVersionId === versionId) {
      throw new Error(`Cannot delete currently deployed version ${versionId}`);
    }

    // Remove backup if exists
    if (version.backupPath) {
      await this.deleteBackup(version.backupPath);
    }

    // Remove version
    agentVersions.splice(versionIndex, 1);
    this.versions.set(agentId, agentVersions);

    logger.info(`Deleted version ${version.version} for agent ${agentId}`);

    // Emit version deleted event
    this.emit('version:deleted', {
      agentId,
      versionId,
      version: version.version,
      timestamp: new Date()
    });
  }

  async promoteVersion(agentId: string, versionId: string, targetEnvironment: string): Promise<void> {
    const version = await this.getVersion(agentId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for agent ${agentId}`);
    }

    logger.info(`Promoting version ${version.version} for agent ${agentId} to ${targetEnvironment}`);

    // Update version metadata
    version.metadata.tags = version.metadata.tags || [];
    if (!version.metadata.tags.includes(targetEnvironment)) {
      version.metadata.tags.push(targetEnvironment);
    }

    // Mark as production ready if promoting to production
    if (targetEnvironment === 'production') {
      version.isProductionReady = true;
      version.isStable = true;
    }

    // Emit promotion event
    this.emit('version:promoted', {
      agentId,
      versionId,
      version: version.version,
      environment: targetEnvironment,
      timestamp: new Date()
    });
  }

  private generateVersionId(agentId: string): string {
    return `v_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateSemanticVersion(agentId: string): string {
    const agentVersions = this.versions.get(agentId) || [];
    const maxVersion = Math.max(...agentVersions.map(v => this.parseVersionNumber(v.version)));
    const nextVersion = maxVersion + 1;
    return `1.${nextVersion}.0`;
  }

  private parseVersionNumber(version: string): number {
    const match = version.match(/1\.(\d+)\.0/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private async performPreDeploymentChecks(version: AgentVersion, environment: string): Promise<void> {
    logger.debug(`Performing pre-deployment checks for version ${version.version}`);

    // Check version compatibility
    if (version.metadata.compatibleWith && version.metadata.compatibleWith.length > 0) {
      // In real implementation, check compatibility with current environment
    }

    // Check resource requirements
    // In real implementation, validate resource availability

    // Check dependencies
    // In real implementation, validate all dependencies are available

    logger.debug(`Pre-deployment checks passed for version ${version.version}`);
  }

  private async performPreRollbackChecks(targetVersion: AgentVersion, currentVersion: AgentVersion): Promise<void> {
    logger.debug(`Performing pre-rollback checks for rollback to ${targetVersion.version}`);

    // Check if target version is stable
    if (!targetVersion.isStable) {
      throw new Error(`Cannot rollback to unstable version ${targetVersion.version}`);
    }

    // Check backup availability
    if (!targetVersion.backupPath && this.config.backupEnabled) {
      throw new Error(`No backup available for version ${targetVersion.version}`);
    }

    // Check compatibility
    // In real implementation, check if rollback is compatible with current state

    logger.debug(`Pre-rollback checks passed for version ${targetVersion.version}`);
  }

  private async performDeployment(version: AgentVersion, environment: string): Promise<void> {
    logger.debug(`Deploying version ${version.version} to ${environment}`);

    // Simulate deployment process
    // In real implementation, this would involve:
    // - Loading version configuration
    // - Updating agent processes
    // - Validating deployment
    // - Running health checks

    await this.delay(2000); // Simulate deployment time

    logger.debug(`Deployment completed for version ${version.version}`);
  }

  private async performRollback(targetVersion: AgentVersion, currentVersion: AgentVersion): Promise<void> {
    logger.debug(`Performing rollback from ${currentVersion.version} to ${targetVersion.version}`);

    // Simulate rollback process
    // In real implementation, this would involve:
    // - Stopping current version
    // - Restoring from backup or previous configuration
    // - Starting target version
    // - Validating rollback

    await this.delay(3000); // Simulate rollback time

    logger.debug(`Rollback completed to version ${targetVersion.version}`);
  }

  private async cleanupOldVersions(agentId: string): Promise<void> {
    const agentVersions = this.versions.get(agentId);
    if (!agentVersions) {
      return;
    }

    const currentVersionId = this.currentVersions.get(agentId);
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays!);

    // Keep only maxVersionsPerAgent versions and current version
    const versionsToKeep = agentVersions
      .filter(v => v.id === currentVersionId || v.createdAt > retentionDate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, this.config.maxVersionsPerAgent!);

    // Delete old versions
    const versionsToDelete = agentVersions.filter(v => !versionsToKeep.includes(v));

    for (const version of versionsToDelete) {
      if (version.id !== currentVersionId) {
        await this.deleteVersion(agentId, version.id);
      }
    }

    if (versionsToDelete.length > 0) {
      logger.info(`Cleaned up ${versionsToDelete.length} old versions for agent ${agentId}`);
    }
  }

  private createBackup(agent: Agent): string {
    const backupPath = `/backups/agents/${agent.id}/${Date.now()}.json`;

    // Simulate creating backup
    logger.debug(`Created backup at ${backupPath}`);

    return backupPath;
  }

  private async deleteBackup(backupPath: string): Promise<void> {
    // Simulate deleting backup
    logger.debug(`Deleted backup at ${backupPath}`);
  }

  private async findPreviousStableVersion(agentId: string, currentVersionId: string): Promise<AgentVersion | null> {
    const agentVersions = this.versions.get(agentId) || [];

    return agentVersions
      .filter(v => v.id !== currentVersionId && v.isStable && v.status === DeploymentStatus.DEPLOYED)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
