/**
 * Database Recommendation Engine
 *
 * This component analyzes requirements and generates intelligent
 * database recommendations with confidence scores, reasoning,
 * and detailed configuration suggestions.
 */

import {
  AIDatabaseAnalysis,
  DatabaseRecommendation,
  DatabaseRequirement,
  PerformanceProfile,
  CostEstimate,
  DatabaseConfiguration,
  AIDatabaseInitializationConfig
} from '../types';

export class DatabaseRecommendationEngine {
  private config: AIDatabaseInitializationConfig;
  private databaseProfiles: Map<string, DatabaseProfile>;

  constructor(config: AIDatabaseInitializationConfig) {
    this.config = config;
    this.initializeDatabaseProfiles();
  }

  /**
   * Generate database recommendations based on analysis
   */
  async generate(
    analysis: AIDatabaseAnalysis,
    preferences?: {
      budgetRange?: { min: number; max: number; currency: string };
      preferredCloud?: string[];
      complianceRequirements?: string[];
      teamSize?: string;
      technicalLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    }
  ): Promise<DatabaseRecommendation[]> {
    const requirements = analysis.extractedRequirements;
    const context = this.estimateContext(requirements);

    const recommendations: DatabaseRecommendation[] = [];

    // Generate recommendations for each suitable database type
    for (const [dbType, profile] of this.databaseProfiles) {
      const score = this.calculateDatabaseScore(dbType, profile, requirements, context, preferences);

      if (score > 0.3) { // Only include databases with meaningful scores
        const recommendation = await this.createRecommendation(
          dbType,
          profile,
          score,
          requirements,
          context,
          preferences
        );
        recommendations.push(recommendation);
      }
    }

    // Sort by confidence score
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate how well a database type matches the requirements
   */
  private calculateDatabaseScore(
    dbType: string,
    profile: DatabaseProfile,
    requirements: DatabaseRequirement[],
    context: ContextEstimate,
    preferences?: any
  ): number {
    let score = 0;
    let maxScore = 0;

    // Performance requirements scoring
    const perfRequirements = requirements.filter(r => r.type === 'performance');
    maxScore += perfRequirements.length * 30;
    perfRequirements.forEach(req => {
      score += this.scorePerformanceRequirement(dbType, profile, req) * 30;
    });

    // Scale requirements scoring
    const scaleRequirements = requirements.filter(r => r.description.includes('scale') || r.description.includes('grow'));
    maxScore += scaleRequirements.length * 25;
    scaleRequirements.forEach(req => {
      score += this.scoreScaleRequirement(dbType, profile, req) * 25;
    });

    // Category match scoring
    maxScore += 20;
    score += this.scoreCategoryMatch(dbType, requirements) * 20;

    // Data model fit scoring
    maxScore += 15;
    score += this.scoreDataModelFit(dbType, profile, requirements) * 15;

    // Budget fit scoring
    if (preferences?.budgetRange) {
      maxScore += 10;
      score += this.scoreBudgetFit(dbType, profile, preferences.budgetRange) * 10;
    }

    // Technical level fit
    if (preferences?.technicalLevel) {
      maxScore += 10;
      score += this.scoreTechnicalFit(dbType, profile, preferences.technicalLevel) * 10;
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Create a detailed recommendation
   */
  private async createRecommendation(
    dbType: string,
    profile: DatabaseProfile,
    confidence: number,
    requirements: DatabaseRequirement[],
    context: ContextEstimate,
    preferences?: any
  ): Promise<DatabaseRecommendation> {
    const costEstimate = this.calculateCostEstimate(dbType, profile, context, preferences);
    const performanceProfile = this.generatePerformanceProfile(dbType, profile, requirements);
    const configuration = this.generateDatabaseConfiguration(dbType, profile, requirements, context);
    const { pros, cons } = this.generateProsCons(dbType, profile, requirements);
    const reasoning = this.generateReasoning(dbType, profile, requirements, confidence);
    const migrationComplexity = this.estimateMigrationComplexity(dbType, requirements);

    return {
      databaseType: dbType,
      confidence,
      reasoning,
      estimatedCost: costEstimate,
      performanceProfile,
      configuration,
      migrationComplexity,
      pros,
      cons
    };
  }

  /**
   * Score performance requirements
   */
  private scorePerformanceRequirement(
    dbType: string,
    profile: DatabaseProfile,
    requirement: DatabaseRequirement
  ): number {
    const desc = requirement.description.toLowerCase();

    // High throughput requirements
    if (desc.includes('high performance') || desc.includes('fast') || desc.includes('real-time')) {
      if (profile.strengths.includes('high_performance')) return 1.0;
      if (profile.strengths.includes('scalable')) return 0.8;
      return 0.4;
    }

    // Low latency requirements
    if (desc.includes('low latency') || desc.includes('quick response')) {
      if (profile.category === 'cache' || profile.category === 'rdbms') return 0.9;
      if (profile.category === 'nosql') return 0.7;
      return 0.5;
    }

    // High availability requirements
    if (desc.includes('availability') || desc.includes('uptime')) {
      if (profile.strengths.includes('high_availability')) return 1.0;
      return 0.6;
    }

    return 0.5;
  }

  /**
   * Score scale requirements
   */
  private scoreScaleRequirement(
    dbType: string,
    profile: DatabaseProfile,
    requirement: DatabaseRequirement
  ): number {
    const desc = requirement.description.toLowerCase();
    const load = requirement.estimatedLoad;

    // Enterprise scale
    if (load === 'enterprise' || desc.includes('millions') || desc.includes('enterprise')) {
      if (profile.category === 'cloud' || profile.category === 'nosql') return 0.9;
      if (profile.strengths.includes('horizontally_scalable')) return 0.8;
      return 0.3;
    }

    // High scale
    if (load === 'high' || desc.includes('hundreds of thousands')) {
      if (profile.strengths.includes('scalable')) return 0.8;
      return 0.5;
    }

    // Medium scale
    if (load === 'medium' || desc.includes('thousands')) {
      return 0.7; // Most databases can handle medium scale
    }

    return 0.6; // Default for small scale
  }

  /**
   * Score category match
   */
  private scoreCategoryMatch(dbType: string, requirements: DatabaseRequirement[]): number {
    const dbProfile = this.databaseProfiles.get(dbType);
    if (!dbProfile) return 0;

    const requiredCategories = [...new Set(requirements.map(r => r.category))];
    const dbCategory = dbProfile.category;

    // Direct category matches get high scores
    if (requiredCategories.includes(dbCategory)) return 1.0;

    // Related categories get partial scores
    const categoryRelations: Record<string, string[]> = {
      'rdbms': ['nosql', 'cloud'],
      'nosql': ['rdbms', 'cloud'],
      'cloud': ['rdbms', 'nosql'],
      'timeseries': ['rdbms', 'nosql'],
      'cache': ['nosql'],
      'graph': ['nosql']
    };

    const relatedCategories = categoryRelations[dbCategory] || [];
    const hasRelated = requiredCategories.some(cat => relatedCategories.includes(cat));

    return hasRelated ? 0.6 : 0.3;
  }

  /**
   * Score data model fit
   */
  private scoreDataModelFit(
    dbType: string,
    profile: DatabaseProfile,
    requirements: DatabaseRequirement[]
  ): number {
    const descriptions = requirements.map(r => r.description.toLowerCase()).join(' ');

    // Document data patterns
    if (descriptions.includes('document') || descriptions.includes('json') || descriptions.includes('unstructured')) {
      if (profile.dataModel === 'document') return 1.0;
      if (profile.dataModel === 'flexible') return 0.7;
      return 0.3;
    }

    // Graph data patterns
    if (descriptions.includes('graph') || descriptions.includes('network') || descriptions.includes('relationship')) {
      if (profile.dataModel === 'graph') return 1.0;
      return 0.2;
    }

    // Time series patterns
    if (descriptions.includes('time series') || descriptions.includes('temporal') || descriptions.includes('iot')) {
      if (profile.dataModel === 'time_series') return 1.0;
      if (profile.category === 'timeseries') return 0.9;
      return 0.4;
    }

    // Key-value patterns
    if (descriptions.includes('key-value') || descriptions.includes('cache') || descriptions.includes('session')) {
      if (profile.dataModel === 'key_value') return 1.0;
      if (profile.category === 'cache') return 0.9;
      return 0.5;
    }

    // Relational patterns (default)
    if (profile.dataModel === 'relational') return 0.8;
    return 0.6;
  }

  /**
   * Score budget fit
   */
  private scoreBudgetFit(
    dbType: string,
    profile: DatabaseProfile,
    budgetRange: { min: number; max: number; currency: string }
  ): number {
    const estimatedMonthlyCost = this.estimateBaseCost(dbType, profile);

    if (estimatedMonthlyCost <= budgetRange.max && estimatedMonthlyCost >= budgetRange.min) {
      return 1.0; // Perfect fit
    }

    if (estimatedMonthlyCost > budgetRange.max) {
      const overBudget = (estimatedMonthlyCost - budgetRange.max) / budgetRange.max;
      return Math.max(0, 1 - overBudget * 2); // Penalize over budget
    }

    // Under budget is good (value for money)
    return 0.8;
  }

  /**
   * Score technical fit
   */
  private scoreTechnicalFit(
    dbType: string,
    profile: DatabaseProfile,
    technicalLevel: string
  ): number {
    const complexity = profile.complexity;

    switch (technicalLevel) {
      case 'beginner':
        return complexity === 'low' ? 1.0 : complexity === 'medium' ? 0.6 : 0.2;
      case 'intermediate':
        return complexity === 'low' ? 0.8 : complexity === 'medium' ? 1.0 : complexity === 'high' ? 0.7 : 0.3;
      case 'advanced':
        return complexity === 'medium' ? 0.9 : complexity === 'high' ? 1.0 : 0.6;
      case 'expert':
        return complexity === 'high' ? 1.0 : complexity === 'medium' ? 0.8 : 0.5;
      default:
        return 0.5;
    }
  }

  /**
   * Calculate cost estimate
   */
  private calculateCostEstimate(
    dbType: string,
    profile: DatabaseProfile,
    context: ContextEstimate,
    preferences?: any
  ): CostEstimate {
    const baseMonthlyCost = this.estimateBaseCost(dbType, profile);
    const scaleMultiplier = this.getScaleMultiplier(context.scale);
    const cloudPremium = preferences?.preferredCloud?.length > 0 ? 1.2 : 1.0;

    const monthlyCost = baseMonthlyCost * scaleMultiplier * cloudPremium;
    const annualCost = monthlyCost * 12 * 0.9; // 10% annual discount

    return {
      monthly: Math.round(monthlyCost * 100) / 100,
      annual: Math.round(annualCost * 100) / 100,
      currency: 'USD',
      breakdown: [
        {
          category: 'compute',
          amount: monthlyCost * 0.5,
          unit: 'monthly',
          description: 'Compute resources'
        },
        {
          category: 'storage',
          amount: monthlyCost * 0.2,
          unit: 'monthly',
          description: 'Storage costs'
        },
        {
          category: 'network',
          amount: monthlyCost * 0.15,
          unit: 'monthly',
          description: 'Data transfer'
        },
        {
          category: 'backup',
          amount: monthlyCost * 0.1,
          unit: 'monthly',
          description: 'Backup and recovery'
        },
        {
          category: 'support',
          amount: monthlyCost * 0.05,
          unit: 'monthly',
          description: 'Support and monitoring'
        }
      ]
    };
  }

  /**
   * Generate performance profile
   */
  private generatePerformanceProfile(
    dbType: string,
    profile: DatabaseProfile,
    requirements: DatabaseRequirement[]
  ): PerformanceProfile {
    const scale = this.estimateScaleFromRequirements(requirements);

    return {
      throughput: {
        readsPerSecond: profile.performance.readThroughput[scale],
        writesPerSecond: profile.performance.writeThroughput[scale]
      },
      latency: {
        readLatency: profile.performance.readLatency[scale],
        writeLatency: profile.performance.writeLatency[scale]
      },
      availability: profile.performance.availability,
      concurrency: profile.performance.concurrency[scale],
      dataConsistency: profile.dataConsistency
    };
  }

  /**
   * Generate database configuration
   */
  private generateDatabaseConfiguration(
    dbType: string,
    profile: DatabaseProfile,
    requirements: DatabaseRequirement[],
    context: ContextEstimate
  ): DatabaseConfiguration {
    const scale = this.estimateScaleFromRequirements(requirements);

    return {
      type: dbType,
      name: `${dbType}_database`,
      host: 'localhost', // Will be configured based on cloud provider
      port: profile.defaultPort,
      database: `${context.domain}_db`,
      user: 'admin',
      ssl: true,
      connectionPool: {
        minConnections: profile.connectionPool.min[scale],
        maxConnections: profile.connectionPool.max[scale],
        connectionTimeout: 30000,
        idleTimeout: 300000,
        maxLifetime: 3600000,
        validationQuery: profile.validationQuery
      },
      backupStrategy: {
        frequency: this.determineBackupFrequency(requirements),
        retention: 30,
        compression: true,
        encryption: true,
        storageLocation: 'cloud'
      },
      monitoring: {
        enabled: true,
        metrics: ['cpu', 'memory', 'connections', 'queries', 'latency'],
        alerts: [
          {
            metric: 'cpu_usage',
            threshold: 80,
            operator: '>',
            severity: 'warning',
            channels: ['email']
          },
          {
            metric: 'connections',
            threshold: 90,
            operator: '>',
            severity: 'critical',
            channels: ['email', 'sms']
          }
        ],
        dashboards: [
          {
            name: 'Overview',
            metrics: ['cpu', 'memory', 'connections'],
            refreshInterval: 30,
            visualizations: [
              { type: 'line', metric: 'cpu', title: 'CPU Usage' },
              { type: 'gauge', metric: 'connections', title: 'Active Connections' }
            ]
          }
        ],
        loggingLevel: 'info'
      },
      scaling: {
        autoScaling: profile.scaling.supported,
        minInstances: profile.scaling.min[scale],
        maxInstances: profile.scaling.max[scale],
        targetCPU: 70,
        targetMemory: 80,
        scalingRules: [
          {
            metric: 'cpu_usage',
            threshold: 80,
            action: 'scale_up',
            cooldown: 300
          },
          {
            metric: 'cpu_usage',
            threshold: 30,
            action: 'scale_down',
            cooldown: 600
          }
        ]
      },
      security: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        authentication: 'password',
        authorization: profile.security.model,
        auditLogging: true,
        firewallRules: [
          { action: 'allow', source: '0.0.0.0/0', port: profile.defaultPort },
          { action: 'deny', source: '0.0.0.0/0', port: 22 }
        ],
        vulnerabilityScanning: true
      },
      optimizations: this.generateOptimizations(dbType, profile, requirements)
    };
  }

  /**
   * Generate pros and cons
   */
  private generateProsCons(
    dbType: string,
    profile: DatabaseProfile,
    requirements: DatabaseRequirement[]
  ): { pros: string[]; cons: string[] } {
    return {
      pros: [
        ...profile.strengths.map(s => this.capitalizeFirst(s.replace('_', ' '))),
        `${this.capitalizeFirst(profile.dataModel)} data model fits your requirements`,
        `Strong ${profile.category} ecosystem and community support`
      ],
      cons: [
        ...profile.weaknesses.map(w => this.capitalizeFirst(w)),
        profile.complexity === 'high' ? 'Requires experienced database administrators' : '',
        profile.licensing === 'commercial' ? 'Additional licensing costs may apply' : ''
      ].filter(Boolean)
    };
  }

  /**
   * Generate reasoning
   */
  private generateReasoning(
    dbType: string,
    profile: DatabaseProfile,
    requirements: DatabaseRequirement[],
    confidence: number
  ): string {
    const topRequirements = requirements.slice(0, 3).map(r => r.description).join(', ');

    return `Based on your requirements for ${topRequirements}, ${dbType} is recommended with ${Math.round(confidence * 100)}% confidence. ${
      profile.category === 'rdbms'
        ? 'Its strong consistency and ACID compliance make it ideal for structured data with complex relationships.'
        : profile.category === 'nosql'
        ? 'Its flexible schema and horizontal scalability make it perfect for rapidly evolving data requirements.'
        : profile.category === 'timeseries'
        ? 'Optimized for time-based data with efficient storage and querying of temporal data.'
        : 'Offers specialized features that align well with your specific use case.'
    }`;
  }

  /**
   * Estimate migration complexity
   */
  private estimateMigrationComplexity(dbType: string, requirements: DatabaseRequirement[]): 'low' | 'medium' | 'high' {
    // Check for existing data that needs migration
    const hasExistingData = requirements.some(r => r.description.includes('migrate') || r.description.includes('existing'));

    // Check for complex schema requirements
    const hasComplexSchema = requirements.some(r => r.description.includes('complex') || r.description.includes('relationships'));

    if (hasExistingData && hasComplexSchema) return 'high';
    if (hasExistingData || hasComplexSchema) return 'medium';
    return 'low';
  }

  // Helper methods
  private initializeDatabaseProfiles(): void {
    this.databaseProfiles = new Map([
      ['postgresql', {
        category: 'rdbms',
        dataModel: 'relational',
        complexity: 'medium',
        strengths: ['acid_compliance', 'extensible', 'json_support', 'high_performance'],
        weaknesses: ['vertical_scaling', 'complex_replication'],
        defaultPort: 5432,
        performance: {
          readThroughput: { low: 1000, medium: 5000, high: 20000, enterprise: 100000 },
          writeThroughput: { low: 500, medium: 2000, high: 10000, enterprise: 50000 },
          readLatency: { low: 5, medium: 10, high: 20, enterprise: 50 },
          writeLatency: { low: 10, medium: 20, high: 40, enterprise: 100 },
          availability: 0.999,
          concurrency: { low: 100, medium: 500, high: 2000, enterprise: 10000 }
        },
        scaling: {
          supported: true,
          min: { low: 1, medium: 2, high: 3, enterprise: 5 },
          max: { low: 2, medium: 5, high: 10, enterprise: 20 }
        },
        connectionPool: {
          min: { low: 5, medium: 10, high: 20, enterprise: 50 },
          max: { low: 20, medium: 50, high: 100, enterprise: 200 }
        },
        security: {
          model: 'rbac',
          encryption: true,
          audit: true
        },
        licensing: 'open_source',
        validationQuery: 'SELECT 1',
        dataConsistency: 'strong'
      }],

      ['mongodb', {
        category: 'nosql',
        dataModel: 'document',
        complexity: 'low',
        strengths: ['flexible_schema', 'horizontal_scaling', 'developer_friendly', 'json_native'],
        weaknesses: ['transaction_limitations', 'memory_usage'],
        defaultPort: 27017,
        performance: {
          readThroughput: { low: 2000, medium: 10000, high: 50000, enterprise: 200000 },
          writeThroughput: { low: 1000, medium: 5000, high: 25000, enterprise: 100000 },
          readLatency: { low: 2, medium: 5, high: 15, enterprise: 30 },
          writeLatency: { low: 5, medium: 10, high: 25, enterprise: 50 },
          availability: 0.9999,
          concurrency: { low: 500, medium: 2000, high: 10000, enterprise: 50000 }
        },
        scaling: {
          supported: true,
          min: { low: 1, medium: 3, high: 5, enterprise: 10 },
          max: { low: 3, medium: 10, high: 50, enterprise: 100 }
        },
        connectionPool: {
          min: { low: 10, medium: 25, high: 50, enterprise: 100 },
          max: { low: 50, medium: 150, high: 300, enterprise: 500 }
        },
        security: {
          model: 'rbac',
          encryption: true,
          audit: true
        },
        licensing: 'open_source',
        validationQuery: '{ ping: 1 }',
        dataConsistency: 'eventual'
      }],

      ['redis', {
        category: 'cache',
        dataModel: 'key_value',
        complexity: 'low',
        strengths: ['blazing_fast', 'simple', 'versatile_data_structures', 'in_memory'],
        weaknesses: ['memory_limited', 'persistence_tradeoffs'],
        defaultPort: 6379,
        performance: {
          readThroughput: { low: 10000, medium: 50000, high: 200000, enterprise: 1000000 },
          writeThroughput: { low: 5000, medium: 25000, high: 100000, enterprise: 500000 },
          readLatency: { low: 0.1, medium: 0.5, high: 1, enterprise: 2 },
          writeLatency: { low: 0.1, medium: 0.5, high: 1, enterprise: 2 },
          availability: 0.999,
          concurrency: { low: 1000, medium: 5000, high: 20000, enterprise: 100000 }
        },
        scaling: {
          supported: true,
          min: { low: 1, medium: 2, high: 3, enterprise: 6 },
          max: { low: 2, medium: 6, high: 15, enterprise: 30 }
        },
        connectionPool: {
          min: { low: 10, medium: 20, high: 50, enterprise: 100 },
          max: { low: 100, medium: 300, high: 1000, enterprise: 5000 }
        },
        security: {
          model: 'acl',
          encryption: true,
          audit: false
        },
        licensing: 'open_source',
        validationQuery: 'PING',
        dataConsistency: 'strong'
      }]
    ]);
  }

  private estimateContext(requirements: DatabaseRequirement[]): ContextEstimate {
    const scale = this.estimateScaleFromRequirements(requirements);
    const domain = this.estimateDomainFromRequirements(requirements);
    const load = this.estimateLoadFromRequirements(requirements);

    return { scale, domain, load };
  }

  private estimateScaleFromRequirements(requirements: DatabaseRequirement[]): 'low' | 'medium' | 'high' | 'enterprise' {
    const highScale = requirements.some(r => r.estimatedLoad === 'enterprise' || r.description.includes('enterprise'));
    const medScale = requirements.some(r => r.estimatedLoad === 'high' || r.description.includes('large scale'));

    if (highScale) return 'enterprise';
    if (medScale) return 'high';
    if (requirements.some(r => r.estimatedLoad === 'medium')) return 'medium';
    return 'low';
  }

  private estimateDomainFromRequirements(requirements: DatabaseRequirement[]): string {
    const descriptions = requirements.map(r => r.description.toLowerCase()).join(' ');

    if (descriptions.includes('ecommerce') || descriptions.includes('shop')) return 'ecommerce';
    if (descriptions.includes('health') || descriptions.includes('medical')) return 'healthcare';
    if (descriptions.includes('finance') || descriptions.includes('bank')) return 'finance';
    if (descriptions.includes('iot') || descriptions.includes('sensor')) return 'iot';
    if (descriptions.includes('analytics') || descriptions.includes('report')) return 'analytics';

    return 'enterprise';
  }

  private estimateLoadFromRequirements(requirements: DatabaseRequirement[]): string {
    return requirements[0]?.estimatedLoad || 'medium';
  }

  private estimateBaseCost(dbType: string, profile: DatabaseProfile): number {
    const baseCosts: Record<string, number> = {
      'postgresql': 50,
      'mongodb': 75,
      'redis': 25,
      'mysql': 45,
      'cassandra': 120,
      'neo4j': 150,
      'influxdb': 100
    };

    return baseCosts[dbType] || 50;
  }

  private getScaleMultiplier(scale: string): number {
    const multipliers = {
      low: 0.5,
      medium: 1.0,
      high: 2.5,
      enterprise: 8.0
    };

    return multipliers[scale] || 1.0;
  }

  private determineBackupFrequency(requirements: DatabaseRequirement[]): BackupStrategy['frequency'] {
    const criticality = requirements.some(r => r.priority === 'critical' || r.type === 'compliance');
    return criticality ? 'hourly' : 'daily';
  }

  private generateOptimizations(dbType: string, profile: DatabaseProfile, requirements: DatabaseRequirement[]) {
    return [
      {
        type: 'index' as const,
        description: 'Optimize query performance with strategic indexing',
        parameters: { strategy: 'automatic' },
        estimatedImprovement: 40,
        priority: 1
      },
      {
        type: 'connection' as const,
        description: 'Optimize connection pooling for better resource utilization',
        parameters: { poolSize: 'auto' },
        estimatedImprovement: 20,
        priority: 2
      }
    ];
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Supporting interfaces
interface DatabaseProfile {
  category: string;
  dataModel: string;
  complexity: 'low' | 'medium' | 'high';
  strengths: string[];
  weaknesses: string[];
  defaultPort: number;
  performance: {
    readThroughput: Record<string, number>;
    writeThroughput: Record<string, number>;
    readLatency: Record<string, number>;
    writeLatency: Record<string, number>;
    availability: number;
    concurrency: Record<string, number>;
  };
  scaling: {
    supported: boolean;
    min: Record<string, number>;
    max: Record<string, number>;
  };
  connectionPool: {
    min: Record<string, number>;
    max: Record<string, number>;
  };
  security: {
    model: string;
    encryption: boolean;
    audit: boolean;
  };
  licensing: 'open_source' | 'commercial';
  validationQuery: string;
  dataConsistency: 'strong' | 'eventual' | 'weak';
}

interface ContextEstimate {
  scale: 'low' | 'medium' | 'high' | 'enterprise';
  domain: string;
  load: string;
}
