/**
 * Configuration Generator for Database Initialization
 *
 * This component generates detailed database configurations including
 * connection settings, security configurations, monitoring setups,
 * and optimization parameters based on the selected database
 * and requirements.
 */

import {
  DatabaseConfiguration,
  DatabaseRecommendation,
  AIDatabaseAnalysis,
  ConnectionPoolConfig,
  BackupStrategy,
  MonitoringConfig,
  ScalingConfig,
  SecurityConfig,
  OptimizationConfig,
  AIDatabaseInitializationConfig,
} from "../types";

export class ConfigurationGenerator {
  private config: AIDatabaseInitializationConfig;

  constructor(config: AIDatabaseInitializationConfig) {
    this.config = config;
  }

  /**
   * Generate complete database configuration
   */
  async generate(
    analysis: AIDatabaseAnalysis,
    recommendation: DatabaseRecommendation,
    options: {
      environment?: "development" | "staging" | "production";
      cloudProvider?: "aws" | "gcp" | "azure" | "digitalocean" | "self_hosted";
      region?: string;
      highAvailability?: boolean;
      backupRetention?: number;
      customSettings?: Record<string, any>;
    } = {},
  ): Promise<DatabaseConfiguration> {
    const environment = options.environment || "development";
    const cloudProvider = options.cloudProvider || "self_hosted";

    const baseConfig = recommendation.configuration;

    // Override with environment-specific settings
    const envConfig = this.getEnvironmentConfig(environment, baseConfig);

    // Apply cloud provider specific settings
    const cloudConfig = this.getCloudProviderConfig(cloudProvider, baseConfig);

    // Generate custom optimizations based on requirements
    const optimizations = this.generateCustomOptimizations(
      analysis.extractedRequirements,
      recommendation.databaseType,
      environment,
    );

    return {
      ...baseConfig,
      ...envConfig,
      ...cloudConfig,
      connectionPool: this.generateConnectionPoolConfig(
        baseConfig,
        environment,
        analysis,
      ),
      backupStrategy: this.generateBackupStrategy(
        baseConfig,
        options.backupRetention,
      ),
      monitoring: this.generateMonitoringConfig(
        baseConfig,
        environment,
        analysis,
      ),
      scaling: this.generateScalingConfig(baseConfig, options.highAvailability),
      security: this.generateSecurityConfig(baseConfig, environment, analysis),
      optimizations: [...baseConfig.optimizations, ...optimizations],
    };
  }

  /**
   * Generate environment-specific configuration
   */
  private getEnvironmentConfig(
    environment: string,
    baseConfig: DatabaseConfiguration,
  ): Partial<DatabaseConfiguration> {
    switch (environment) {
      case "development":
        return {
          ssl: false,
          database: `${baseConfig.database}_dev`,
          user: "dev_user",
          connectionPool: {
            ...baseConfig.connectionPool,
            minConnections: 2,
            maxConnections: 10,
            connectionTimeout: 10000,
            idleTimeout: 60000,
          },
        };

      case "staging":
        return {
          ssl: true,
          database: `${baseConfig.database}_staging`,
          user: "staging_user",
          connectionPool: {
            ...baseConfig.connectionPool,
            minConnections: 5,
            maxConnections: 25,
            connectionTimeout: 20000,
            idleTimeout: 120000,
          },
        };

      case "production":
        return {
          ssl: true,
          database: baseConfig.database,
          user: "app_user",
          connectionPool: {
            ...baseConfig.connectionPool,
            minConnections: 10,
            maxConnections: 50,
            connectionTimeout: 30000,
            idleTimeout: 300000,
          },
        };

      default:
        return {};
    }
  }

  /**
   * Generate cloud provider specific configuration
   */
  private getCloudProviderConfig(
    cloudProvider: string,
    baseConfig: DatabaseConfiguration,
  ): Partial<DatabaseConfiguration> {
    switch (cloudProvider) {
      case "aws":
        return {
          host: `${baseConfig.database}.${this.generateRandomString()}.us-east-1.rds.amazonaws.com`,
          port: baseConfig.port,
          database: baseConfig.database,
          security: {
            ...baseConfig.security,
            firewallRules: [
              { action: "allow", source: "10.0.0.0/8", port: baseConfig.port },
              {
                action: "allow",
                source: "172.16.0.0/12",
                port: baseConfig.port,
              },
              { action: "deny", source: "0.0.0.0/0", port: 22 },
            ],
          },
        };

      case "gcp":
        return {
          host: `${baseConfig.database}.${this.generateRandomString()}.us-central1.sql.google`,
          port: baseConfig.port,
          database: baseConfig.database,
          security: {
            ...baseConfig.security,
            firewallRules: [
              { action: "allow", source: "10.0.0.0/8", port: baseConfig.port },
            ],
          },
        };

      case "azure":
        return {
          host: `${baseConfig.database}.database.windows.net`,
          port: 1433,
          database: baseConfig.database,
          security: {
            ...baseConfig.security,
            firewallRules: [
              { action: "allow", source: "0.0.0.0/0", port: baseConfig.port },
            ],
          },
        };

      default:
        return {
          host: "localhost",
          port: baseConfig.port,
        };
    }
  }

  /**
   * Generate connection pool configuration
   */
  private generateConnectionPoolConfig(
    baseConfig: DatabaseConfiguration,
    environment: string,
    analysis: AIDatabaseAnalysis,
  ): ConnectionPoolConfig {
    const concurrentUsers = this.estimateConcurrentUsers(analysis);
    const poolMultiplier = environment === "production" ? 1.5 : 1.0;

    return {
      minConnections: Math.max(
        2,
        Math.floor(concurrentUsers * 0.1 * poolMultiplier),
      ),
      maxConnections: Math.max(
        10,
        Math.floor(concurrentUsers * 0.5 * poolMultiplier),
      ),
      connectionTimeout: 30000,
      idleTimeout: 300000,
      maxLifetime: 3600000,
      validationQuery: this.getValidationQuery(baseConfig.type),
    };
  }

  /**
   * Generate backup strategy
   */
  private generateBackupStrategy(
    baseConfig: DatabaseConfiguration,
    retentionDays?: number,
  ): BackupStrategy {
    const hasCompliance = baseConfig.security.auditLogging;

    return {
      frequency: hasCompliance ? "hourly" : "daily",
      retention: retentionDays || (hasCompliance ? 90 : 30),
      compression: true,
      encryption: true,
      storageLocation: "cloud",
    };
  }

  /**
   * Generate monitoring configuration
   */
  private generateMonitoringConfig(
    baseConfig: DatabaseConfiguration,
    environment: string,
    analysis: AIDatabaseAnalysis,
  ): MonitoringConfig {
    const baseMetrics = ["cpu", "memory", "connections", "queries"];
    const advancedMetrics =
      environment === "production"
        ? ["latency", "throughput", "errors", "deadlocks", "cache_hit_ratio"]
        : [];

    return {
      enabled: true,
      metrics: [...baseMetrics, ...advancedMetrics],
      alerts: this.generateAlerts(baseConfig.type, environment),
      dashboards: this.generateDashboards(baseConfig.type, environment),
      loggingLevel: environment === "development" ? "debug" : "info",
    };
  }

  /**
   * Generate scaling configuration
   */
  private generateScalingConfig(
    baseConfig: DatabaseConfiguration,
    highAvailability?: boolean,
  ): ScalingConfig {
    if (!highAvailability) {
      return {
        ...baseConfig.scaling,
        autoScaling: false,
        minInstances: 1,
        maxInstances: 1,
      };
    }

    return {
      ...baseConfig.scaling,
      autoScaling: true,
      scalingRules: [
        {
          metric: "cpu_usage",
          threshold: 80,
          action: "scale_up",
          cooldown: 300,
        },
        {
          metric: "memory_usage",
          threshold: 85,
          action: "scale_up",
          cooldown: 300,
        },
        {
          metric: "cpu_usage",
          threshold: 30,
          action: "scale_down",
          cooldown: 600,
        },
      ],
    };
  }

  /**
   * Generate security configuration
   */
  private generateSecurityConfig(
    baseConfig: DatabaseConfiguration,
    environment: string,
    analysis: AIDatabaseAnalysis,
  ): SecurityConfig {
    const hasComplianceRequirements = analysis.extractedRequirements.some(
      (req) =>
        req.type === "compliance" ||
        req.description.toLowerCase().includes("compliance"),
    );

    return {
      encryptionAtRest: true,
      encryptionInTransit: environment !== "development",
      authentication: hasComplianceRequirements ? "certificate" : "password",
      authorization: hasComplianceRequirements
        ? "rbac"
        : baseConfig.security.authorization,
      auditLogging: hasComplianceRequirements || environment === "production",
      firewallRules: [
        ...(baseConfig.security.firewallRules || []),
        ...(environment === "production"
          ? [{ action: "deny" as const, source: "0.0.0.0/0", protocol: "ssh" }]
          : []),
      ],
      vulnerabilityScanning: environment === "production",
    };
  }

  /**
   * Generate custom optimizations
   */
  private generateCustomOptimizations(
    requirements: any[],
    databaseType: string,
    environment: string,
  ): OptimizationConfig[] {
    const optimizations: OptimizationConfig[] = [];

    // Performance optimizations
    if (requirements.some((req) => req.type === "performance")) {
      optimizations.push({
        type: "query",
        description: "Enable query result caching for frequently accessed data",
        parameters: { cacheSize: "256MB", ttl: 300 },
        estimatedImprovement: 25,
        priority: 2,
      });
    }

    // Index optimizations
    optimizations.push({
      type: "index",
      description: "Create composite indexes for common query patterns",
      parameters: { strategy: "auto_analyze", samplePeriod: "7d" },
      estimatedImprovement: 40,
      priority: 1,
    });

    // Connection optimizations
    optimizations.push({
      type: "connection",
      description: "Optimize connection pooling for expected load",
      parameters: { reuseStrategy: "lifo", testOnBorrow: true },
      estimatedImprovement: 15,
      priority: 3,
    });

    // Database-specific optimizations
    optimizations.push(
      ...this.getDatabaseSpecificOptimizations(databaseType, requirements),
    );

    // Environment-specific optimizations
    if (environment === "production") {
      optimizations.push({
        type: "performance",
        description: "Enable production-grade performance tuning",
        parameters: { optimizeFor: "throughput", enableStatistics: true },
        estimatedImprovement: 20,
        priority: 2,
      });
    }

    return optimizations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate alerts configuration
   */
  private generateAlerts(databaseType: string, environment: string): any[] {
    const alerts = [
      {
        metric: "cpu_usage",
        threshold: environment === "production" ? 80 : 90,
        operator: ">",
        severity: "warning",
        channels: ["email"],
      },
      {
        metric: "memory_usage",
        threshold: 85,
        operator: ">",
        severity: "warning",
        channels: ["email"],
      },
      {
        metric: "connections",
        threshold: 90,
        operator: ">",
        severity: "critical",
        channels: ["email", "sms"],
      },
    ];

    if (environment === "production") {
      alerts.push(
        {
          metric: "query_latency",
          threshold: 1000,
          operator: ">",
          severity: "warning",
          channels: ["email"],
        },
        {
          metric: "error_rate",
          threshold: 5,
          operator: ">",
          severity: "critical",
          channels: ["email", "sms", "webhook"],
        },
      );
    }

    return alerts;
  }

  /**
   * Generate dashboards configuration
   */
  private generateDashboards(databaseType: string, environment: string): any[] {
    const dashboards = [
      {
        name: "Database Overview",
        metrics: ["cpu", "memory", "connections"],
        refreshInterval: 30,
        visualizations: [
          { type: "line", metric: "cpu", title: "CPU Usage (%)" },
          { type: "line", metric: "memory", title: "Memory Usage (%)" },
          { type: "gauge", metric: "connections", title: "Active Connections" },
        ],
      },
    ];

    if (environment === "production") {
      dashboards.push(
        {
          name: "Performance Metrics",
          metrics: ["latency", "throughput", "errors"],
          refreshInterval: 15,
          visualizations: [
            { type: "line", metric: "latency", title: "Query Latency (ms)" },
            { type: "bar", metric: "throughput", title: "Queries per Second" },
            { type: "line", metric: "errors", title: "Error Rate (%)" },
          ],
        },
        {
          name: "Resource Utilization",
          metrics: ["disk_io", "network_io", "cache_hit_ratio"],
          refreshInterval: 60,
          visualizations: [
            { type: "line", metric: "disk_io", title: "Disk I/O (ops/sec)" },
            {
              type: "line",
              metric: "network_io",
              title: "Network I/O (MB/sec)",
            },
            {
              type: "gauge",
              metric: "cache_hit_ratio",
              title: "Cache Hit Ratio (%)",
            },
          ],
        },
      );
    }

    return dashboards;
  }

  /**
   * Get database-specific optimizations
   */
  private getDatabaseSpecificOptimizations(
    databaseType: string,
    requirements: any[],
  ): OptimizationConfig[] {
    const optimizations: OptimizationConfig[] = [];

    switch (databaseType.toLowerCase()) {
      case "postgresql":
        optimizations.push(
          {
            type: "partition",
            description: "Enable table partitioning for large tables",
            parameters: { strategy: "range", column: "created_at" },
            estimatedImprovement: 60,
            priority: 2,
          },
          {
            type: "caching",
            description: "Configure PostgreSQL query cache and shared buffers",
            parameters: { sharedBuffers: "25%", effectiveCacheSize: "75%" },
            estimatedImprovement: 30,
            priority: 1,
          },
        );
        break;

      case "mongodb":
        optimizations.push(
          {
            type: "index",
            description: "Create compound indexes for common query patterns",
            parameters: { strategy: "compound", background: true },
            estimatedImprovement: 50,
            priority: 1,
          },
          {
            type: "caching",
            description: "Configure WiredTiger cache for optimal performance",
            parameters: { cacheSizeGB: "auto", journalCompressor: "snappy" },
            estimatedImprovement: 25,
            priority: 2,
          },
        );
        break;

      case "redis":
        optimizations.push(
          {
            type: "caching",
            description: "Configure Redis memory policies and eviction",
            parameters: { policy: "allkeys-lru", maxMemory: "80%" },
            estimatedImprovement: 40,
            priority: 1,
          },
          {
            type: "performance",
            description: "Enable Redis persistence and replication",
            parameters: { persistence: "rdb+aof", replication: true },
            estimatedImprovement: 20,
            priority: 2,
          },
        );
        break;

      case "mysql":
        optimizations.push(
          {
            type: "query",
            description: "Configure MySQL query cache and optimizer",
            parameters: {
              queryCacheSize: "128M",
              optimizerSwitch: "indexed_condition_pushdown=on",
            },
            estimatedImprovement: 25,
            priority: 2,
          },
          {
            type: "index",
            description: "Optimize InnoDB buffer pool and indexes",
            parameters: {
              innodbBufferPoolSize: "70%",
              innodbFlushMethod: "O_DIRECT",
            },
            estimatedImprovement: 35,
            priority: 1,
          },
        );
        break;
    }

    return optimizations;
  }

  // Helper methods
  private estimateConcurrentUsers(analysis: AIDatabaseAnalysis): number {
    const userRequirements = analysis.extractedRequirements.filter(
      (req) =>
        req.description.toLowerCase().includes("user") ||
        req.description.toLowerCase().includes("concurrent"),
    );

    if (userRequirements.length === 0) return 100;

    // Extract numbers from requirement descriptions
    const numbers = userRequirements
      .map((req) => req.description.match(/\d+/))
      .filter((match) => match)
      .map((match) => parseInt(match![0]));

    return Math.max(...numbers, 100);
  }

  private getValidationQuery(databaseType: string): string {
    const validationQueries: Record<string, string> = {
      postgresql: "SELECT 1",
      mysql: "SELECT 1",
      mongodb: "{ ping: 1 }",
      redis: "PING",
      sqlserver: "SELECT 1",
      oracle: "SELECT 1 FROM DUAL",
      sqlite: "SELECT 1",
    };

    return validationQueries[databaseType.toLowerCase()] || "SELECT 1";
  }

  private generateRandomString(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  /**
   * Export configuration as different formats
   */
  exportAsJSON(config: DatabaseConfiguration): string {
    return JSON.stringify(config, null, 2);
  }

  exportAsYAML(config: DatabaseConfiguration): string {
    // Simple YAML export (in production, use a proper YAML library)
    const yaml = this.jsonToYaml(config);
    return yaml;
  }

  exportAsTerraform(config: DatabaseConfiguration): string {
    return this.generateTerraformConfig(config);
  }

  exportAsDockerCompose(config: DatabaseConfiguration): string {
    return this.generateDockerComposeConfig(config);
  }

  // Private export methods (simplified implementations)
  private jsonToYaml(obj: any, indent = 0): string {
    const spaces = "  ".repeat(indent);
    let yaml = "";

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.jsonToYaml(value, indent + 1);
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  private generateTerraformConfig(config: DatabaseConfiguration): string {
    return `# Terraform configuration for ${config.type}
resource "${config.type}_database" "main" {
  name     = "${config.database}"
  user     = "${config.user}"
  password = var.db_password
  host     = "${config.host}"
  port     = ${config.port}

  # Connection pool settings
  min_connections = ${config.connectionPool.minConnections}
  max_connections = ${config.connectionPool.maxConnections}

  # Security settings
  ssl_enabled = ${config.ssl}
  encryption_at_rest = ${config.security.encryptionAtRest}

  tags = {
    Environment = "production"
    Project = "queryflux"
  }
}`;
  }

  private generateDockerComposeConfig(config: DatabaseConfiguration): string {
    return `version: '3.8'
services:
  ${config.database}:
    image: ${config.type}:latest
    container_name: ${config.database}
    environment:
      POSTGRES_DB: ${config.database}
      POSTGRES_USER: ${config.user}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    ports:
      - "${config.port}:${config.port}"
    volumes:
      - ${config.database}_data:/var/lib/${config.type}
      - ./backups:/backups
    restart: unless-stopped

volumes:
  ${config.database}_data:`;
  }
}
