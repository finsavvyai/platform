import { EventBus } from "./bus";

/**
 * Workspace Information
 */
export interface WorkspaceInfo {
  rootPath: string;
  name: string;
  folders: string[];
}

/**
 * File content interface for analysis
 */
export interface FileContent {
  path: string;
  content: string;
  lastModified: number;
  size: number;
  hash: string;
}

/**
 * File analysis result interface
 */
export interface FileAnalysisResult {
  success: boolean;
  dependencies: Array<ProjectDependency & {
    isExternal?: boolean;
    isTypeOnly?: boolean;
    isBuiltin?: boolean;
  }>;
  classes: string[];
  functions: string[];
  exports: string[];
  imports: string[];
  dynamicImports: string[];
  reExports: string[];
  typeHints: string[];
  inheritance: Array<{ className: string; parentClass: string }>;
  hasDefaultExport: boolean;
  metrics: {
    functionCount: number;
    classCount: number;
    complexity: number;
  };
  errors: any[];
}

/**
 * Enhanced Graph Types
 */
export interface ProjectFile {
  path: string;
  size?: number;
  language?: string;
  lastModified?: number;
  hash?: string;
}

export interface ProjectDependency {
  from: string;
  to: string;
  type: DependencyType;
  strength: DependencyStrength;
  metadata?: DependencyMetadata;
}

export interface DependencyMetadata {
  lineNumbers?: number[];
  importType?: string;
  exportName?: string;
  isTypeOnly?: boolean;
  isDynamic?: boolean;
  isConditional?: boolean;
  sourceType?: 'import' | 'require' | 'dynamic-import' | 'export' | 'inheritance' | string;
}

export enum DependencyType {
  IMPORT = 'import',
  EXPORT = 'export',
  CALL = 'call',
  INHERITANCE = 'inheritance',
  COMPOSITION = 'composition',
  TYPE_REFERENCE = 'type-reference',
  ANNOTATION = 'annotation',
  CONFIG = 'config',
  REFERENCE = 'reference'
}

export enum DependencyStrength {
  WEAK = 'weak',
  MEDIUM = 'medium',
  STRONG = 'strong',
  CRITICAL = 'critical'
}

export interface ProjectGraph {
  files: ProjectFile[];
  dependencies: ProjectDependency[];
  metadata: {
    version: string;
    buildTime: number;
    fileCount: number;
    dependencyCount: number;
    languages: string[];
    cacheHit?: boolean;
  };
  analytics: GraphAnalytics;
}

export interface GraphAnalytics {
  complexity: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  circularDependencies: CircularDependency[];
  modules: ModuleAnalysis[];
  hotspots: CodeHotspot[];
  metrics: GraphMetrics;
}

export interface CircularDependency {
  path: string[];
  type: DependencyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ModuleAnalysis {
  path: string;
  name: string;
  type: 'file' | 'directory' | 'module';
  size: {
    lines: number;
    bytes: number;
  };
  complexity: {
    cyclomatic: number;
    cognitive: number;
  };
  maintainability: {
    maintainabilityIndex: number;
    halsteadVolume: number;
  };
  dependencies: {
    incoming: number;
    outgoing: number;
    fanIn: number;
    fanOut: number;
    instability: number;
  };
}

export interface CodeHotspot {
  filePath: string;
  type: 'complexity' | 'coupling' | 'churn' | 'size';
  score: number;
  details: Record<string, any>;
}

export interface GraphMetrics {
  totalDependencies: number;
  dependencyDensity: number;
  averageModuleSize: number;
  maxDepth: number;
  coupling: {
    afferent: number;
    efferent: number;
    instability: number;
  };
  cohesion: number;
  abstraction: number;
}

export interface AnalysisResult {
  success: boolean;
  graph: ProjectGraph;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
  performance: {
    duration: number;
    filesAnalyzed: number;
    cacheHits: number;
  };
}

export interface AnalysisError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface AnalysisWarning {
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface IncrementalUpdate {
  changedFiles: string[];
  deletedFiles: string[];
  graphDelta: {
    addedFiles: ProjectFile[];
    removedFiles: string[];
    addedDependencies: ProjectDependency[];
    removedDependencies: ProjectDependency[];
  };
}

/**
 * ModeContext — runtime environment for all modes
 */
export interface ModeContext {
  workspace: WorkspaceInfo;

  graph: ProjectGraph | null;
  emit(event: string, payload: any): void;

  license: {
    valid: boolean;
    plan: string;
    features: string[];
  };

  /**
   * Optional callback provided by hosts (VS Code extension, Deno host, etc.)
   * Allows modes to show upgrade/paywall prompts safely.
   */
  showUpgradePrompt?: (featureName: string) => void;
}

/**
 * Enhanced Mode Interface with dependency management and advanced lifecycle
 */
export interface EnhancedMode {
  id: string;
  title: string;
  description?: string;
  version: string;
  author: string;
  tags: string[];

  /**
   * License requirements
   */
  requiredFeature?: string;

  /**
   * Mode dependencies (other modes that must be active)
   */
  dependencies?: string[];

  /**
   * Optional dependencies (preferred but not required)
   */
  optionalDependencies?: string[];

  /**
   * Priority for activation order (lower numbers activate first)
   */
  priority: number;

  /**
   * Configuration schema validation
   */
  configSchema?: any; // z.ZodSchema or similar

  /**
   * Default configuration values
   */
  defaultConfig?: Record<string, any>;

  /**
   * Lifecycle hooks
   */
  onInstall?(): Promise<void>;
  onUninstall?(): Promise<void>;
  onActivate?(ctx: ModeContext): Promise<void>;
  onDeactivate?(ctx: ModeContext): Promise<void>;
  onGraphUpdate?(ctx: ModeContext, graph: ProjectGraph): Promise<void>;
  onError?(error: Error, context?: string): void;

  /**
   * Mode activation (required)
   */
  activate(ctx: ModeContext): void | Promise<void>;

  /**
   * Mode deactivation (optional)
   */
  deactivate?(ctx: ModeContext): void | Promise<void>;

  /**
   * Get mode-specific API
   */
  getApi?(): any;

  /**
   * Get mode status and health
   */
  getStatus?(): ModeStatus;

  /**
   * Configure the mode
   */
  configure?(config: Record<string, any>): void | Promise<void>;

  /**
   * Validation function
   */
  validate?(): boolean;

  // Allow mode-specific API functions
  [key: string]: any;
}

/**
 * Backward compatible Mode interface
 */
export interface Mode {
  id: string;
  title: string;
  description?: string;

  /**
   * If set, this feature must be present in license.features
   */
  requiredFeature?: string;

  activate(ctx: ModeContext): void;

  deactivate?(ctx: ModeContext): void;

  /**
   * Called whenever the graph is (re)built.
   */
  onGraphUpdate?(ctx: ModeContext, graph?: ProjectGraph): void | Promise<void>;
  // Allow mode-specific API functions
  [key: string]: any;
}

// packages/lunaforge-core/src/types/mode.ts

export interface ModeStatus {
  id: string;
  status: 'registered' | 'activating' | 'active' | 'deactivating' | 'error' | 'inactive';
  config: Record<string, any>;
  lastActivated?: number;
  lastDeactivated?: number;
  error?: string;
  metrics: {
    activationTime: number;
    memoryUsage: number;
    apiCalls: number;
    errorCount: number;
    activationCount: number;
  };
  dependencies: {
    required: string[];
    optional: string[];
    satisfied: string[];
    missing: string[];
  };
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, DependencyEdge[]>;
}

export interface DependencyNode {
  modeId: string;
  mode: EnhancedMode | Mode;
  priority: number;
  dependencies: string[];
  dependents: string[];
  activationOrder?: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'required' | 'optional';
}

export interface ModeRegistration {
  mode: EnhancedMode | Mode;
  status: ModeStatus;
  registeredAt: number;
  activatedAt?: number;
  deactivatedAt?: number;
  activationHistory: Array<{
    timestamp: number;
    duration: number;
    success: boolean;
    error?: string;
  }>;
}

export interface ModeRegistryConfig {
  enableDependencyResolution: boolean;
  enableActivationMetrics: boolean;
  enableCircularDependencyCheck: boolean;
  maxActivationRetries: number;
  activationTimeout: number;
}

export interface ModeClientOptions {
  /** @deprecated Use workerUrl instead */
  baseUrl?: string;

  workerUrl?: string;
  apiKey?: string;
}

/**
 * Typed event contracts for LunaForge system events
 */
export interface EventContracts {
  // Core Events
  'lunaforge:ready': void;
  'lunaforge:error': { error: string; context?: string };
  'lunaforge:disposed': void;

  // Graph Events
  'graph:building': void;
  'graph:ready': { graph: ProjectGraph };
  'graph:updated': { old: ProjectGraph; new: ProjectGraph };
  'graph:error': { error: Error; context?: string };

  // Mode Events
  'mode:registered': { modeId: string; title: string; requiredFeature?: string };
  'mode:activating': { modeId: string };
  'mode:activated': { modeId: string };
  'mode:deactivating': { modeId: string };
  'mode:deactivated': { modeId: string };
  'mode:error': { modeId: string; error: string; context?: string };

  // License Events
  'license:validated': { license: { valid: boolean; plan: string; features: string[] } };
  'license:expired': void;
  'license:error': { reason: string; mode?: string; feature?: string };

  // Plan Events
  'plan:requested': { target: string; summary?: string };
  'plan:received': { plan: AgentPlan };
  'plan:error': { error: string };

  // Performance Events
  'performance:metric': { operation: string; duration: number; metadata?: any };
  'performance:warning': { message: string; threshold: string; actual: number };

  // Cache Events
  'cache:hit': { key: string; type: string };
  'cache:miss': { key: string; type: string };
  'cache:eviction': { key: string; reason: string };

  // Health Check Events
  'health:check': void;
  'health:degraded': { component: string; reason: string };
  'health:recovered': { component: string };

  // Custom Mode Events (extendable by modes)
  'galaxy:data': { nodes: any[]; edges: any[] };
  'galaxy:error': { error: string };
  'galaxy:ready': {};

  'codeflow:path': { request: any; path: any };
  'codeflow:error': { error: string };
  'codeflow:ready': {};

  // Generic mode event pattern
  [modeId: `${string}:ready`]: any;
  [modeId: `${string}:data`]: any;
  [modeId: `${string}:error`]: any;
  [modeId: `${string}:progress`]: { progress: number; message?: string };
}

/**
 * Agent Plan interface for event contracts
 */
export interface AgentPlan {
  id: string;
  createdAt: string;
  summary: string;
  target: string;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    status: "pending" | "running" | "done" | "skipped" | "failed";
  }>;
}

/**
 * Analysis context for file analysis
 */
export interface FileAnalysisContext {
  workspace: {
    rootPath: string;
    name: string;
  };
  filePath: string;
  relativePath: string;
  content: string;
  language: string;
  options: AnalysisOptions;
}

/**
 * Analysis options interface
 */
export interface AnalysisOptions {
  includeTypeDependencies?: boolean;
  includeDynamicImports?: boolean;
  maxFileSize?: number;
  ignorePatterns?: RegExp[];
}