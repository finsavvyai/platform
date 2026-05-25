/**
 * AI Database Initialization System Types
 *
 * This file defines the core types and interfaces for the AI-powered
 * database initialization system that can understand natural language
 * descriptions, analyze dump files, and automatically create database setups.
 */

export interface DatabaseRequirement {
  id: string;
  type: 'functional' | 'performance' | 'security' | 'compliance';
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'rdbms' | 'nosql' | 'cloud' | 'aws' | 'timeseries' | 'cache' | 'graph';
  estimatedLoad: 'low' | 'medium' | 'high' | 'enterprise';
}

export interface AIDatabaseAnalysis {
  id: string;
  inputType: 'natural_language' | 'dump_file' | 'mixed';
  rawData: string;
  extractedRequirements: DatabaseRequirement[];
  recommendedDatabases: DatabaseRecommendation[];
  confidence: number;
  processingTime: number;
}

export interface DatabaseRecommendation {
  databaseType: string;
  confidence: number;
  reasoning: string;
  estimatedCost: CostEstimate;
  performanceProfile: PerformanceProfile;
  configuration: DatabaseConfiguration;
  migrationComplexity: 'low' | 'medium' | 'high';
  pros: string[];
  cons: string[];
}

export interface DatabaseConfiguration {
  type: string;
  name: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  ssl: boolean;
  connectionPool: ConnectionPoolConfig;
  backupStrategy: BackupStrategy;
  monitoring: MonitoringConfig;
  scaling: ScalingConfig;
  security: SecurityConfig;
  optimizations: OptimizationConfig[];
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  validationQuery: string;
}

export interface BackupStrategy {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retention: number;
  compression: boolean;
  encryption: boolean;
  storageLocation: 'local' | 'cloud' | 'hybrid';
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: string[];
  alerts: AlertConfig[];
  dashboards: DashboardConfig[];
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface AlertConfig {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  severity: 'critical' | 'warning' | 'info';
  channels: ('email' | 'sms' | 'webhook' | 'slack')[];
}

export interface DashboardConfig {
  name: string;
  metrics: string[];
  refreshInterval: number;
  visualizations: VisualizationConfig[];
}

export interface VisualizationConfig {
  type: 'line' | 'bar' | 'pie' | 'gauge' | 'table';
  metric: string;
  title: string;
}

export interface ScalingConfig {
  autoScaling: boolean;
  minInstances: number;
  maxInstances: number;
  targetCPU: number;
  targetMemory: number;
  scalingRules: ScalingRule[];
}

export interface ScalingRule {
  metric: string;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  cooldown: number;
}

export interface SecurityConfig {
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  authentication: 'password' | 'certificate' | 'oauth' | 'ldap';
  authorization: 'rbac' | 'acl' | 'custom';
  auditLogging: boolean;
  firewallRules: FirewallRule[];
  vulnerabilityScanning: boolean;
}

export interface FirewallRule {
  action: 'allow' | 'deny';
  source: string;
  port?: number;
  protocol?: string;
}

export interface OptimizationConfig {
  type: 'index' | 'partition' | 'caching' | 'query' | 'connection';
  description: string;
  parameters: Record<string, any>;
  estimatedImprovement: number;
  priority: number;
}

export interface CostEstimate {
  monthly: number;
  annual: number;
  currency: string;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  category: 'compute' | 'storage' | 'network' | 'backup' | 'support' | 'licensing';
  amount: number;
  unit: 'monthly' | 'annual' | 'onetime';
  description: string;
}

export interface PerformanceProfile {
  throughput: {
    readsPerSecond: number;
    writesPerSecond: number;
  };
  latency: {
    readLatency: number;
    writeLatency: number;
  };
  availability: number;
  concurrency: number;
  dataConsistency: 'strong' | 'eventual' | 'weak';
}

export interface DumpFileAnalysis {
  fileName: string;
  fileType: 'sql' | 'json' | 'csv' | 'bson' | 'custom';
  size: number;
  tableCount: number;
  totalRows: number;
  estimatedSchema: SchemaAnalysis;
  dataPatterns: DataPattern[];
  indexes: IndexAnalysis[];
  constraints: ConstraintAnalysis[];
  triggers: TriggerAnalysis[];
  storedProcedures: StoredProcedureAnalysis[];
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

export interface SchemaAnalysis {
  tables: TableAnalysis[];
  relationships: RelationshipAnalysis[];
  dataTypes: DataTypeUsage[];
  normalizationLevel: 'unnormalized' | '1nf' | '2nf' | '3nf' | 'bcnf' | '4nf' | '5nf';
}

export interface TableAnalysis {
  name: string;
  estimatedRows: number;
  columns: ColumnAnalysis[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyAnalysis[];
  indexes: string[];
  estimatedSize: number;
  growthRate: 'low' | 'medium' | 'high';
}

export interface ColumnAnalysis {
  name: string;
  dataType: string;
  nullable: boolean;
  unique: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
  estimatedCardinality: number;
  growthPattern: 'static' | 'linear' | 'exponential';
}

export interface ForeignKeyAnalysis {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdateAction: 'cascade' | 'restrict' | 'set_null' | 'set_default';
  onDeleteAction: 'cascade' | 'restrict' | 'set_null' | 'set_default';
}

export interface RelationshipAnalysis {
  type: 'one_to_one' | 'one_to_many' | 'many_to_many';
  sourceTable: string;
  targetTable: string;
  joinColumns: string[];
  cardinality: {
    minSource: number;
    maxSource: number;
    minTarget: number;
    maxTarget: number;
  };
}

export interface DataTypeUsage {
  dataType: string;
  count: number;
  percentage: number;
  recommendedOptimization?: string;
}

export interface DataPattern {
  type: 'temporal' | 'hierarchical' | 'network' | 'geospatial' | 'document' | 'key_value';
  description: string;
  confidence: number;
  relatedTables: string[];
  optimizationSuggestions: string[];
}

export interface IndexAnalysis {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin' | 'partial';
  unique: boolean;
  estimatedSelectivity: number;
  usageFrequency: 'high' | 'medium' | 'low';
  recommendation: 'keep' | 'drop' | 'modify' | 'add_composite';
}

export interface ConstraintAnalysis {
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  table: string;
  columns: string[];
  definition: string;
  enforced: boolean;
  performanceImpact: 'low' | 'medium' | 'high';
}

export interface TriggerAnalysis {
  name: string;
  table: string;
  event: 'insert' | 'update' | 'delete';
  timing: 'before' | 'after' | 'instead_of';
  complexity: 'simple' | 'moderate' | 'complex';
  performanceImpact: 'low' | 'medium' | 'high';
}

export interface StoredProcedureAnalysis {
  name: string;
  parameters: ParameterAnalysis[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedExecutionTime: number;
  usageFrequency: 'high' | 'medium' | 'low';
}

export interface ParameterAnalysis {
  name: string;
  dataType: string;
  direction: 'in' | 'out' | 'inout';
  required: boolean;
}

export interface NaturalLanguageAnalysis {
  input: string;
  intent: 'create_database' | 'migrate_database' | 'optimize_database' | 'analyze_schema' | 'design_from_scratch';
  entities: ExtractedEntity[];
  constraints: ExtractedConstraint[];
  requirements: ExtractedRequirement[];
  context: AnalysisContext;
  confidence: number;
}

export interface ExtractedEntity {
  type: 'database_type' | 'table' | 'column' | 'relationship' | 'performance' | 'scale' | 'budget' | 'compliance';
  value: string;
  confidence: number;
  startPosition: number;
  endPosition: number;
  synonyms: string[];
}

export interface ExtractedConstraint {
  type: 'functional' | 'non_functional' | 'business' | 'technical' | 'compliance';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  measurable: boolean;
  verificationCriteria: string[];
}

export interface ExtractedRequirement {
  category: 'performance' | 'scalability' | 'security' | 'availability' | 'cost' | 'compliance' | 'usability';
  description: string;
  metric?: string;
  target?: number;
  unit?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface AnalysisContext {
  domain: 'ecommerce' | 'healthcare' | 'finance' | 'iot' | 'analytics' | 'social' | 'content' | 'gaming' | 'enterprise' | 'education';
  scale: 'personal' | 'small_business' | 'startup' | 'medium' | 'large' | 'enterprise';
  technicalStack: string[];
  teamSize: 'solo' | 'small' | 'medium' | 'large';
  budgetLevel: 'bootstrap' | 'seed' | 'growth' | 'established' | 'enterprise';
  timeToMarket: 'urgent' | 'soon' | 'normal' | 'flexible';
}

export interface DatabaseCreationPlan {
  id: string;
  analysis: AIDatabaseAnalysis;
  selectedDatabase: DatabaseRecommendation;
  steps: CreationStep[];
  estimatedDuration: number;
  estimatedCost: CostEstimate;
  prerequisites: Prerequisite[];
  rollbackPlan: RollbackStep[];
}

export interface CreationStep {
  id: string;
  name: string;
  description: string;
  type: 'infrastructure' | 'configuration' | 'migration' | 'validation' | 'documentation';
  order: number;
  estimatedDuration: number;
  dependencies: string[];
  commands: CommandStep[];
  validation: ValidationStep[];
}

export interface CommandStep {
  command: string;
  context: 'shell' | 'sql' | 'api' | 'docker' | 'kubectl';
  parameters?: Record<string, any>;
  expectedOutput?: string;
  errorMessage?: string;
}

export interface ValidationStep {
  type: 'connectivity' | 'performance' | 'data_integrity' | 'security' | 'functionality';
  test: string;
  expectedResult: string;
  tolerance?: number;
}

export interface Prerequisite {
  type: 'software' | 'hardware' | 'network' | 'permissions' | 'knowledge';
  description: string;
  required: boolean;
  verificationMethod: string;
}

export interface RollbackStep {
  description: string;
  command: string;
  context: 'shell' | 'sql' | 'api' | 'docker' | 'kubectl';
  order: number;
}

export interface AIDatabaseInitializationConfig {
  modelProvider: 'openai' | 'anthropic' | 'google' | 'local';
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  enableCache: boolean;
  enableTelemetry: boolean;
  customPrompts?: Record<string, string>;
  integrationSettings: IntegrationSettings;
}

export interface IntegrationSettings {
  cloudProviders: CloudProviderConfig[];
  monitoringTools: MonitoringToolConfig[];
  cicdPlatforms: CICDPlatformConfig[];
  securityTools: SecurityToolConfig[];
}

export interface CloudProviderConfig {
  provider: 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'linode';
  enabled: boolean;
  credentials?: Record<string, string>;
  preferredRegions: string[];
  costOptimization: boolean;
}

export interface MonitoringToolConfig {
  tool: 'prometheus' | 'datadog' | 'new_relic' | 'grafana' | 'cloudwatch' | 'stackdriver';
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  customDashboards: boolean;
}

export interface CICDPlatformConfig {
  platform: 'github_actions' | 'gitlab_ci' | 'jenkins' | 'azure_pipelines' | 'circleci';
  enabled: boolean;
  repository?: string;
  webhookUrl?: string;
  autoDeploy: boolean;
}

export interface SecurityToolConfig {
  tool: 'snyk' | 'sonarqube' | 'veracode' | 'checkmarx' | 'owasp_zap';
  enabled: boolean;
  apiKey?: string;
  scanFrequency: 'on_commit' | 'daily' | 'weekly' | 'manual';
  failThreshold: number;
}
