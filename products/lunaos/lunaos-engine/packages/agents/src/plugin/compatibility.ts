import { EventEmitter } from 'events';
import * as semver from 'semver';
import {
  IPlugin,
  IPluginManifest,
  IPluginRegistry,
  PluginStatus,
  PluginCompatibilityResult,
  ILogger,
  IEventBus
} from './interfaces';

/**
 * Compatibility Check Result
 */
export interface CompatibilityCheckResult {
  isCompatible: boolean;
  compatibilityScore: number; // 0-100
  issues: CompatibilityIssue[];
  recommendations: CompatibilityRecommendation[];
  overallResult: 'compatible' | 'partially-compatible' | 'incompatible';
}

/**
 * Compatibility Issue
 */
export interface CompatibilityIssue {
  type: 'version' | 'dependency' | 'permission' | 'api' | 'engine' | 'security';
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  details?: any;
  resolution?: string;
}

/**
 * Compatibility Recommendation
 */
export interface CompatibilityRecommendation {
  type: 'upgrade' | 'downgrade' | 'configuration' | 'permission' | 'dependency';
  priority: 'high' | 'medium' | 'low';
  message: string;
  action: string;
}

/**
 * Platform Compatibility Matrix
 */
export interface PlatformCompatibility {
  nodeVersion: {
    required: string;
    recommended: string;
    supported: string[];
  };
  operatingSystems: {
    required: string[];
    recommended: string[];
    supported: string[];
  };
  architectures: {
    required: string[];
    recommended: string[];
    supported: string[];
  };
}

/**
 * Plugin Compatibility Checker
 * Handles comprehensive compatibility checking for plugins
 */
export class PluginCompatibilityChecker extends EventEmitter {
  private readonly registry: IPluginRegistry;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly platformCompatibility: PlatformCompatibility;
  private readonly compatibilityCache: Map<string, CompatibilityCheckResult> = new Map();

  constructor(
    registry: IPluginRegistry,
    logger: ILogger,
    eventBus: IEventBus,
    platformCompatibility?: Partial<PlatformCompatibility>
  ) {
    super();

    this.registry = registry;
    this.logger = logger.child({ component: 'PluginCompatibilityChecker' });
    this.eventBus = eventBus;

    // Set platform compatibility with defaults
    this.platformCompatibility = {
      nodeVersion: {
        required: '>=14.0.0',
        recommended: '>=16.0.0',
        supported: ['14.x', '16.x', '18.x', '20.x']
      },
      operatingSystems: {
        required: ['linux', 'darwin', 'win32'],
        recommended: ['linux', 'darwin'],
        supported: ['linux', 'darwin', 'win32', 'freebsd', 'openbsd']
      },
      architectures: {
        required: ['x64', 'arm64'],
        recommended: ['x64', 'arm64'],
        supported: ['x64', 'arm64', 'x86', 'arm']
      },
      ...platformCompatibility
    };
  }

  async checkPluginCompatibility(plugin: IPlugin, targetPlatform?: any): Promise<CompatibilityCheckResult> {
    this.logger.info(`Checking compatibility for plugin: ${plugin.name}@${plugin.version}`);

    // Check cache first
    const cacheKey = `${plugin.name}@${plugin.version}`;
    if (this.compatibilityCache.has(cacheKey)) {
      this.logger.debug(`Using cached compatibility result for: ${cacheKey}`);
      return this.compatibilityCache.get(cacheKey)!;
    }

    const issues: CompatibilityIssue[] = [];
    const recommendations: CompatibilityRecommendation[] = [];

    try {
      // Check platform compatibility
      await this.checkPlatformCompatibility(plugin, issues, recommendations);

      // Check dependency compatibility
      await this.checkDependencyCompatibility(plugin, issues, recommendations);

      // Check API compatibility
      await this.checkAPICompatibility(plugin, issues, recommendations);

      // Check permission compatibility
      await this.checkPermissionCompatibility(plugin, issues, recommendations);

      // Check version compatibility
      await this.checkVersionCompatibility(plugin, issues, recommendations);

      // Check security compatibility
      await this.checkSecurityCompatibility(plugin, issues, recommendations);

      // Calculate compatibility score
      const compatibilityScore = this.calculateCompatibilityScore(issues);

      // Determine overall result
      const overallResult = this.determineOverallResult(issues, compatibilityScore);

      const result: CompatibilityCheckResult = {
        isCompatible: overallResult === 'compatible' || overallResult === 'partially-compatible',
        compatibilityScore,
        issues,
        recommendations,
        overallResult
      };

      // Cache result
      this.compatibilityCache.set(cacheKey, result);

      // Emit event
      this.emit('compatibility-check', {
        plugin: plugin.name,
        version: plugin.version,
        result
      });
      await this.eventBus.emit('plugin-compatibility-check', {
        pluginName: plugin.name,
        version: plugin.version,
        result
      });

      this.logger.info(`Compatibility check complete for ${plugin.name}: ${overallResult} (${compatibilityScore}%)`);

      return result;

    } catch (error) {
      this.logger.error(`Failed to check compatibility for plugin ${plugin.name}: ${error}`);

      const result: CompatibilityCheckResult = {
        isCompatible: false,
        compatibilityScore: 0,
        issues: [{
          type: 'api',
          severity: 'critical',
          code: 'CHECK_FAILED',
          message: `Compatibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          resolution: 'Please check plugin and try again'
        }],
        recommendations: [],
        overallResult: 'incompatible'
      };

      return result;
    }
  }

  async checkSystemCompatibility(plugin: IPlugin): Promise<CompatibilityCheckResult> {
    this.logger.info(`Checking system compatibility for plugin: ${plugin.name}`);

    const issues: CompatibilityIssue[] = [];
    const recommendations: CompatibilityRecommendation[] = [];

    // Get current system information
    const systemInfo = this.getSystemInformation();

    // Check Node.js version
    const nodeVersion = plugin.manifest.engines?.node;
    if (nodeVersion) {
      await this.checkNodeVersionCompatibility(nodeVersion, systemInfo, issues, recommendations);
    }

    // Check OS compatibility
    const osRequirements = plugin.manifest.os;
    if (osRequirements) {
      await this.checkOSCompatibility(osRequirements, systemInfo, issues, recommendations);
    }

    // Check architecture compatibility
    const archRequirements = plugin.manifest.cpu;
    if (archRequirements) {
      await this.checkArchitectureCompatibility(archRequirements, systemInfo, issues, recommendations);
    }

    // Calculate compatibility score
    const compatibilityScore = this.calculateCompatibilityScore(issues);

    // Determine overall result
    const overallResult = this.determineOverallResult(issues, compatibilityScore);

    const result: CompatibilityCheckResult = {
      isCompatible: overallResult === 'compatible' || overallResult === 'partially-compatible',
      compatibilityScore,
      issues,
      recommendations,
      overallResult
    };

    return result;
  }

  async checkPluginAgainstRegistry(pluginName: string, version?: string): Promise<CompatibilityCheckResult> {
    this.logger.info(`Checking plugin against registry: ${pluginName}`);

    try {
      const plugin = await this.registry.getPlugin(pluginName);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      return await this.checkPluginCompatibility(plugin);

    } catch (error) {
      this.logger.error(`Failed to check plugin against registry: ${error}`);

      return {
        isCompatible: false,
        compatibilityScore: 0,
        issues: [{
          type: 'dependency',
          severity: 'critical',
          code: 'PLUGIN_NOT_FOUND',
          message: `Plugin not found in registry: ${pluginName}`,
          resolution: 'Please install the plugin first'
        }],
        recommendations: [],
        overallResult: 'incompatible'
      };
    }
  }

  async checkCompatibilityBetweenPlugins(
    plugin1: string,
    plugin2: string
  ): Promise<CompatibilityCheckResult> {
    this.logger.info(`Checking compatibility between plugins: ${plugin1} and ${plugin2}`);

    const issues: CompatibilityIssue[] = [];
    const recommendations: CompatibilityRecommendation[] = [];

    try {
      const p1 = await this.registry.getPlugin(plugin1);
      const p2 = await this.registry.getPlugin(plugin2);

      if (!p1 || !p2) {
        throw new Error('One or both plugins not found');
      }

      // Check for conflicting dependencies
      await this.checkDependencyConflicts(p1, p2, issues, recommendations);

      // Check for permission conflicts
      await this.checkPermissionConflicts(p1, p2, issues, recommendations);

      // Check for API conflicts
      await this.checkAPIConflicts(p1, p2, issues, recommendations);

      // Calculate compatibility score
      const compatibilityScore = this.calculateCompatibilityScore(issues);

      // Determine overall result
      const overallResult = this.determineOverallResult(issues, compatibilityScore);

      const result: CompatibilityCheckResult = {
        isCompatible: overallResult === 'compatible' || overallResult === 'partially-compatible',
        compatibilityScore,
        issues,
        recommendations,
        overallResult
      };

      return result;

    } catch (error) {
      this.logger.error(`Failed to check compatibility between plugins: ${error}`);

      return {
        isCompatible: false,
        compatibilityScore: 0,
        issues: [{
          type: 'api',
          severity: 'critical',
          code: 'COMPATIBILITY_CHECK_FAILED',
          message: `Failed to check compatibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
          resolution: 'Please check both plugins and try again'
        }],
        recommendations: [],
        overallResult: 'incompatible'
      };
    }
  }

  getCompatibilityIssues(pluginName: string, version?: string): CompatibilityIssue[] {
    const cacheKey = version ? `${pluginName}@${version}` : `${pluginName}@latest`;
    const cached = this.compatibilityCache.get(cacheKey);

    return cached ? cached.issues : [];
  }

  getCompatibilityRecommendations(pluginName: string, version?: string): CompatibilityRecommendation[] {
    const cacheKey = version ? `${pluginName}@${version}` : `${pluginName}@latest`;
    const cached = this.compatibilityCache.get(cacheKey);

    return cached ? cached.recommendations : [];
  }

  clearCache(): void {
    this.compatibilityCache.clear();
    this.logger.info('Compatibility cache cleared');
  }

  getCompatibilityStats(): any {
    const totalChecks = this.compatibilityCache.size;
    const compatibleChecks = Array.from(this.compatibilityCache.values())
      .filter(r => r.overallResult === 'compatible').length;
    const partiallyCompatibleChecks = Array.from(this.compatibilityCache.values())
      .filter(r => r.overallResult === 'partially-compatible').length;

    const issuesByType = new Map<string, number>();
    for (const result of this.compatibilityCache.values()) {
      for (const issue of result.issues) {
        const count = issuesByType.get(issue.type) || 0;
        issuesByType.set(issue.type, count + 1);
      }
    }

    return {
      totalChecks,
      compatibleChecks,
      partiallyCompatibleChecks,
      incompatibleChecks: totalChecks - compatibleChecks - partiallyCompatibleChecks,
      successRate: totalChecks > 0 ? (compatibleChecks / totalChecks) * 100 : 0,
      issuesByType: Object.fromEntries(issuesByType),
      averageScore: totalChecks > 0
        ? Array.from(this.compatibilityCache.values())
            .reduce((sum, r) => sum + r.compatibilityScore, 0) / totalChecks
        : 0
    };
  }

  private async checkPlatformCompatibility(
    plugin: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const systemInfo = this.getSystemInformation();

    // Check Node.js version
    const nodeVersion = plugin.manifest.engines?.node;
    if (nodeVersion) {
      await this.checkNodeVersionCompatibility(nodeVersion, systemInfo, issues, recommendations);
    } else {
      // Default to platform requirements
      const platform = this.platformCompatibility;
      const currentNodeVersion = process.version;

      if (!semver.satisfies(currentNodeVersion, platform.nodeVersion.required)) {
        issues.push({
          type: 'engine',
          severity: 'critical',
          code: 'NODE_VERSION_INCOMPATIBLE',
          message: `Plugin requires Node.js ${platform.nodeVersion.required}, but current version is ${currentNodeVersion}`,
          resolution: `Upgrade Node.js to a compatible version (${platform.nodeVersion.recommended})`
        });

        recommendations.push({
          type: 'upgrade',
          priority: 'high',
          message: 'Node.js version is incompatible',
          action: `Upgrade Node.js to version ${platform.nodeVersion.recommended}`
        });
      }
    }

    // Check operating system
    const osRequirements = plugin.manifest.os;
    if (osRequirements) {
      await this.checkOSCompatibility(osRequirements, systemInfo, issues, recommendations);
    }

    // Check architecture
    const archRequirements = plugin.manifest.cpu;
    if (archRequirements) {
      await this.checkArchitectureCompatibility(archRequirements, systemInfo, issues, recommendations);
    }
  }

  private async checkDependencyCompatibility(
    plugin: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const dependencies = plugin.manifest.dependencies || [];

    for (const dependency of dependencies) {
      const [depName, depVersion] = dependency.split('@');

      try {
        const depPlugin = await this.registry.getPlugin(depName);
        if (!depPlugin) {
          issues.push({
            type: 'dependency',
            severity: 'critical',
            code: 'DEPENDENCY_MISSING',
            message: `Required dependency "${depName}" is not installed`,
            details: { dependency: depName, requiredVersion: depVersion },
            resolution: `Install dependency: ${dependency}`
          });

          recommendations.push({
            type: 'dependency',
            priority: 'high',
            message: `Missing dependency: ${depName}`,
            action: `Install plugin ${depName}`
          });
          continue;
        }

        // Check version compatibility
        if (depVersion && depPlugin.version) {
          const isCompatible = semver.satisfies(depPlugin.version, depVersion);

          if (!isCompatible) {
            issues.push({
              type: 'dependency',
              severity: depPlugin.status === PluginStatus.RUNNING ? 'warning' : 'critical',
              code: 'DEPENDENCY_VERSION_MISMATCH',
              message: `Dependency "${depName}" version ${depPlugin.version} is not compatible with required version ${depVersion}`,
              details: {
                dependency: depName,
                requiredVersion: depVersion,
                actualVersion: depPlugin.version
              },
              resolution: `Upgrade or downgrade dependency ${depName} to version ${depVersion}`
            });

            recommendations.push({
              type: depPlugin.status === PluginStatus.RUNNING ? 'upgrade' : 'downgrade',
              priority: depPlugin.status === PluginStatus.RUNNING ? 'medium' : 'high',
              message: `Dependency version mismatch: ${depName}`,
              action: `Update dependency ${depName} to version ${depVersion}`
            });
          }
        }

        // Check if dependency is running
        if (depPlugin.status !== PluginStatus.RUNNING) {
          issues.push({
            type: 'dependency',
            severity: 'critical',
            code: 'DEPENDENCY_NOT_RUNNING',
            message: `Required dependency "${depName}" is not running`,
            details: {
              dependency: depName,
              status: depPlugin.status
            },
            resolution: `Start dependency: ${depName}`
          });

          recommendations.push({
            type: 'configuration',
            priority: 'high',
            message: `Dependency not running: ${depName}`,
            action: `Start plugin ${depName}`
          });
        }

      } catch (error) {
        issues.push({
          type: 'dependency',
          severity: 'critical',
          code: 'DEPENDENCY_CHECK_FAILED',
          message: `Failed to check dependency "${depName}": ${error}`,
          resolution: 'Please check the dependency and try again'
        });
      }
    }
  }

  private async checkAPICompatibility(
    plugin: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    // Check API version compatibility
    const apiVersion = plugin.manifest.apiVersion;
    if (apiVersion) {
      const currentApiVersion = '1.0.0'; // This should be configurable

      if (!semver.satisfies(currentApiVersion, apiVersion)) {
        issues.push({
          type: 'api',
          severity: 'warning',
          code: 'API_VERSION_MISMATCH',
          message: `Plugin requires API version ${apiVersion}, but current platform supports ${currentApiVersion}`,
          resolution: `Update plugin or platform API version`
        });

        recommendations.push({
          type: 'upgrade',
          priority: 'medium',
          message: 'API version mismatch',
          action: `Update plugin to use API version ${currentApiVersion}`
        });
      }
    }

    // Check API endpoints compatibility
    const apiEndpoints = plugin.manifest.apiEndpoints || [];
    for (const endpoint of apiEndpoints) {
      // This would check against available API endpoints
      // For now, just add a warning if it's not a standard endpoint
      if (!endpoint.startsWith('/api/')) {
        issues.push({
          type: 'api',
          severity: 'info',
          code: 'NONSTANDARD_API_ENDPOINT',
          message: `Plugin uses non-standard API endpoint: ${endpoint}`,
          resolution: 'Consider using standard API endpoints for better compatibility'
        });
      }
    }
  }

  private async checkPermissionCompatibility(
    plugin: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const permissions = plugin.manifest.permissions || [];

    // Check for dangerous permissions
    const dangerousPermissions = ['*', 'system', 'admin', 'root'];
    for (const permission of permissions) {
      if (dangerousPermissions.includes(permission)) {
        issues.push({
          type: 'permission',
          severity: 'warning',
          code: 'DANGEROUS_PERMISSION',
          message: `Plugin requests dangerous permission: ${permission}`,
          details: { permission },
          resolution: 'Review permission requirements carefully'
        });

        recommendations.push({
          type: 'permission',
          priority: 'high',
          message: `Plugin requests dangerous permission: ${permission}`,
          action: 'Verify that this permission is necessary for plugin functionality'
        });
      }
    }

    // Check for potentially conflicting permissions
    const conflictingPermissions = this.findConflictingPermissions(permissions);
    for (const conflict of conflictingPermissions) {
      issues.push({
        type: 'permission',
        severity: 'warning',
        code: 'POTENTIAL_PERMISSION_CONFLICT',
        message: `Plugin has potentially conflicting permissions: ${conflict.join(', ')}`,
        resolution: 'Review permission usage to avoid conflicts'
      });
    }
  }

  private async checkVersionCompatibility(
    plugin: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const version = plugin.version;

    // Check if version follows semantic versioning
    if (!semver.valid(version)) {
      issues.push({
        type: 'version',
        severity: 'warning',
        code: 'INVALID_VERSION_FORMAT',
        message: `Plugin version "${version}" does not follow semantic versioning`,
        resolution: 'Update plugin to use semantic versioning (e.g., 1.0.0)'
      });

      recommendations.push({
        type: 'upgrade',
        priority: 'low',
        message: 'Invalid version format',
        action: 'Update plugin version to follow semantic versioning'
      });
    }

    // Check for pre-release versions
    if (semver.prerelease(version)) {
      issues.push({
        type: 'version',
        severity: 'info',
        code: 'PRERELEASE_VERSION',
        message: `Plugin uses pre-release version: ${version}`,
        resolution: 'Consider using stable releases for production'
      });
    }
  }

  private async checkSecurityCompatibility(
    plugin: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    // Check for security-related metadata
    const hasSecurityPolicy = !!plugin.manifest.securityPolicy;
    const hasVulnerabilityReport = !!plugin.manifest.vulnerabilityReport;

    if (!hasSecurityPolicy) {
      issues.push({
        type: 'security',
        severity: 'info',
        code: 'MISSING_SECURITY_POLICY',
        message: 'Plugin does not provide a security policy',
        resolution: 'Consider adding a security policy to the plugin manifest'
      });
    }

    if (!hasVulnerabilityReport) {
      issues.push({
        type: 'security',
        severity: 'info',
        code: 'MISSING_VULNERABILITY_REPORT',
        message: 'Plugin does not provide a vulnerability report',
        resolution: 'Consider adding a vulnerability report to the plugin manifest'
      });
    }

    // Check for known security issues (this would integrate with security scanners)
    if (plugin.manifest.knownIssues && plugin.manifest.knownIssues.length > 0) {
      const securityIssues = plugin.manifest.knownIssues.filter(issue =>
        issue.type === 'security' || issue.severity === 'critical'
      );

      if (securityIssues.length > 0) {
        issues.push({
          type: 'security',
          severity: 'warning',
          code: 'KNOWN_SECURITY_ISSUES',
          message: `Plugin has known security issues: ${securityIssues.length} issues found`,
          details: { issues: securityIssues },
          resolution: 'Review known security issues and update plugin if available'
        });

        recommendations.push({
          type: 'upgrade',
          priority: 'high',
          message: 'Plugin has known security issues',
          action: 'Update plugin to latest version or consider alternative'
        });
      }
    }
  }

  private async checkNodeVersionCompatibility(
    requiredVersion: string,
    systemInfo: any,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const currentNodeVersion = systemInfo.nodeVersion;

    if (!semver.satisfies(currentNodeVersion, requiredVersion)) {
      issues.push({
        type: 'engine',
        severity: 'critical',
        code: 'NODE_VERSION_INCOMPATIBLE',
        message: `Plugin requires Node.js ${requiredVersion}, but current version is ${currentNodeVersion}`,
        details: {
          requiredVersion,
          currentVersion: currentNodeVersion
        },
        resolution: `Upgrade Node.js to a compatible version`
      });

      recommendations.push({
        type: 'upgrade',
        priority: 'high',
        message: 'Node.js version is incompatible',
        action: `Upgrade Node.js to version ${requiredVersion}`
      });
    }
  }

  private async checkOSCompatibility(
    requirements: string[],
    systemInfo: any,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const currentOS = systemInfo.platform;

    if (!requirements.includes(currentOS)) {
      issues.push({
        type: 'engine',
        severity: 'critical',
        code: 'OS_INCOMPATIBLE',
        message: `Plugin requires OS ${requirements.join(' or ')}, but current OS is ${currentOS}`,
        details: {
          requiredOS: requirements,
          currentOS
        },
        resolution: `Run plugin on a supported operating system`
      });

      recommendations.push({
        type: 'configuration',
        priority: 'high',
        message: 'Operating system is incompatible',
        action: `Run plugin on ${requirements.join(' or ')}`
      });
    }
  }

  private async checkArchitectureCompatibility(
    requirements: string[],
    systemInfo: any,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const currentArch = systemInfo.arch;

    if (!requirements.includes(currentArch)) {
      issues.push({
        type: 'engine',
        severity: 'critical',
        code: 'ARCH_INCOMPATIBLE',
        message: `Plugin requires architecture ${requirements.join(' or ')}, but current architecture is ${currentArch}`,
        details: {
          requiredArch: requirements,
          currentArch
        },
        resolution: `Run plugin on a supported architecture`
      });

      recommendations.push({
        type: 'configuration',
        priority: 'high',
        message: 'Architecture is incompatible',
        action: `Run plugin on ${requirements.join(' or ')}`
      });
    }
  }

  private async checkDependencyConflicts(
    plugin1: IPlugin,
    plugin2: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const deps1 = plugin1.manifest.dependencies || [];
    const deps2 = plugin2.manifest.dependencies || [];

    // Check for conflicting dependency versions
    for (const dep1 of deps1) {
      const [depName1, depVersion1] = dep1.split('@');

      for (const dep2 of deps2) {
        const [depName2, depVersion2] = dep2.split('@');

        if (depName1 === depName2 && depVersion1 !== depVersion2) {
          issues.push({
            type: 'dependency',
            severity: 'warning',
            code: 'DEPENDENCY_VERSION_CONFLICT',
            message: `Plugins have conflicting dependency versions for ${depName1}: ${depVersion1} vs ${depVersion2}`,
            details: {
              plugin1: plugin1.name,
              plugin2: plugin2.name,
              dependency: depName1,
              version1: depVersion1,
              version2: depVersion2
            },
            resolution: `Resolve dependency version conflict between ${plugin1.name} and ${plugin2.name}`
          });

          recommendations.push({
            type: 'dependency',
            priority: 'medium',
            message: `Dependency version conflict: ${depName1}`,
            action: `Update plugins to use compatible dependency versions`
          });
        }
      }
    }
  }

  private async checkPermissionConflicts(
    plugin1: IPlugin,
    plugin2: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const perms1 = plugin1.manifest.permissions || [];
    const perms2 = plugin2.manifest.permissions || [];

    // Check for mutually exclusive permissions
    const mutuallyExclusivePairs = [
      ['read', 'write'],
      ['execute', 'deny'],
      ['network', 'sandbox']
    ];

    for (const [perm1, perm2] of mutuallyExclusivePairs) {
      if (perms1.includes(perm1) && perms2.includes(perm2)) {
        issues.push({
          type: 'permission',
          severity: 'warning',
          code: 'MUTUALLY_EXCLUSIVE_PERMISSIONS',
          message: `Plugins have mutually exclusive permissions: ${plugin1.name} (${perm1}) and ${plugin2.name} (${perm2})`,
          details: {
            plugin1: plugin1.name,
            plugin2: plugin2.name,
            permission1: perm1,
            permission2: perm2
          },
          resolution: `Review permission usage between ${plugin1.name} and ${plugin2.name}`
        });
      }
    }
  }

  private async checkAPIConflicts(
    plugin1: IPlugin,
    plugin2: IPlugin,
    issues: CompatibilityIssue[],
    recommendations: CompatibilityRecommendation[]
  ): Promise<void> {
    const endpoints1 = plugin1.manifest.apiEndpoints || [];
    const endpoints2 = plugin2.manifest.apiEndpoints || [];

    // Check for duplicate API endpoints
    const duplicateEndpoints = endpoints1.filter(endpoint => endpoints2.includes(endpoint));

    if (duplicateEndpoints.length > 0) {
      issues.push({
        type: 'api',
        severity: 'warning',
        code: 'DUPLICATE_API_ENDPOINTS',
        message: `Plugins have duplicate API endpoints: ${duplicateEndpoints.join(', ')}`,
        details: {
          plugin1: plugin1.name,
          plugin2: plugin2.name,
          endpoints: duplicateEndpoints
        },
        resolution: `Rename API endpoints to avoid conflicts between ${plugin1.name} and ${plugin2.name}`
      });

      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        message: `Duplicate API endpoints detected`,
        action: `Rename conflicting API endpoints`
      });
    }
  }

  private calculateCompatibilityScore(issues: CompatibilityIssue[]): number {
    if (issues.length === 0) {
      return 100;
    }

    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 2;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineOverallResult(
    issues: CompatibilityIssue[],
    score: number
  ): 'compatible' | 'partially-compatible' | 'incompatible' {
    const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');

    if (hasCriticalIssues || score < 50) {
      return 'incompatible';
    }

    if (score < 80) {
      return 'partially-compatible';
    }

    return 'compatible';
  }

  private getSystemInformation(): any {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: require('os').hostname(),
      cpus: require('os').cpus(),
      memory: require('os').totalmem()
    };
  }

  private findConflictingPermissions(permissions: string[]): string[][] {
    // This would check for known conflicting permission combinations
    // For now, return empty array
    return [];
  }
}
