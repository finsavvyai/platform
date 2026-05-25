export interface Dependency {
    id: string;
    name: string;
    version: string;
    ecosystem: Ecosystem;
    scope: DependencyScope;
    isDirect: boolean;
    isOptional: boolean;
    vulnerabilities?: Vulnerability[];
    licenses?: License[];
    size?: number;
    downloadUrl?: string;
    homepage?: string;
    repository?: string;
    description?: string;
    tags?: string[];
    updatedAt: string;
    children?: Dependency[];
}

export interface Vulnerability {
    id: string;
    severity: VulnerabilitySeverity;
    score?: number;
    title: string;
    description: string;
    affectedVersions: string[];
    patchedVersions: string[];
    references?: string[];
    publishedAt: string;
    updatedAt: string;
    cveId?: string;
    cweIds?: string[];
    vector?: string;
}

export interface License {
    id: string;
    name: string;
    spdxId?: string;
    url?: string;
    isApproved: boolean;
    riskLevel: LicenseRiskLevel;
}

export interface Project {
    id: string;
    name: string;
    path: string;
    type: ProjectType;
    ecosystems: Ecosystem[];
    lastAnalyzed: string;
    dependencyCount: number;
    vulnerabilityCount: number;
    policyViolations: number;
    status: ProjectStatus;
}

export interface AnalysisResult {
    projectId: string;
    dependencies: Dependency[];
    vulnerabilities: Vulnerability[];
    policyViolations: PolicyViolation[];
    summary: AnalysisSummary;
    metrics: AnalysisMetrics;
    recommendations?: Recommendation[];
    analyzedAt: string;
}

export interface PolicyViolation {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: PolicySeverity;
    description: string;
    affectedDependencies: string[];
    recommendation?: string;
    autoFixable: boolean;
}

export interface Recommendation {
    type: RecommendationType;
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    dependencies?: string[];
    action?: {
        type: string;
        target: string;
        value?: any;
    };
}

export interface AnalysisSummary {
    totalDependencies: number;
    directDependencies: number;
    transitiveDependencies: number;
    vulnerabilitiesBySeverity: Record<VulnerabilitySeverity, number>;
    licenseRiskCount: number;
    policyViolationCount: number;
    outdatedCount: number;
    securityScore: number;
    complianceScore: number;
}

export interface AnalysisMetrics {
    analysisTime: number;
    cacheHitRate: number;
    totalRequests: number;
    bandwidthUsed: number;
    memoryUsage: number;
}

export interface SBOM {
    format: 'cyclonedx' | 'spdx';
    version: string;
    metadata: {
        timestamp: string;
        tools: Tool[];
        authors?: Author[];
    };
    components: SBOMComponent[];
    dependencies?: SBOMDependency[];
    vulnerabilities?: Vulnerability[];
}

export interface SBOMComponent {
    type: 'library' | 'framework' | 'application' | 'container' | 'operating-system';
    group?: string;
    name: string;
    version: string;
    purl?: string;
    licenses?: License[];
    hash?: { alg: string; content: string }[];
    supplier?: string;
    author?: string;
    description?: string;
    scope?: 'required' | 'optional' | 'excluded';
}

export interface SBOMDependency {
    ref: string;
    dependsOn: string[];
}

export interface Tool {
    name: string;
    version: string;
    vendor?: string;
}

export interface Author {
    name: string;
    email?: string;
}

export interface UPMConfiguration {
    serverUrl: string;
    apiKey?: string;
    autoAnalysis: boolean;
    realTimeUpdates: boolean;
    highlighting: boolean;
    notificationLevel: NotificationLevel;
    excludeScopes: string[];
    maxDependencies: number;
    timeout: number;
}

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
    projectId?: string;
}

export interface DecoratorType {
    vulnerable: vscode.DecorationRenderOptions;
    outdated: vscode.DecorationRenderOptions;
    unapproved: vscode.DecorationRenderOptions;
    policyViolation: vscode.DecorationRenderOptions;
}

export enum Ecosystem {
    MAVEN = 'maven',
    GRADLE = 'gradle',
    SBT = 'sbt',
    NPM = 'npm',
    YARN = 'yarn',
    PNPM = 'pnpm',
    PYPI = 'pypi',
    PIPENV = 'pipenv',
    POETRY = 'poetry',
    CARGO = 'cargo',
    COMPOSER = 'composer',
    NUGET = 'nuget',
    GO = 'go',
    RUBY_GEMS = 'rubygems',
    HEX = 'hex',
    CLOJARS = 'clojars',
    CRATES = 'crates'
}

export enum DependencyScope {
    COMPILE = 'compile',
    PROVIDED = 'provided',
    RUNTIME = 'runtime',
    TEST = 'test',
    SYSTEM = 'system',
    IMPORT = 'import',
    OPTIONAL = 'optional',
    DEVELOPMENT = 'development',
    PRODUCTION = 'production',
    PEER = 'peer',
    BUNDLED = 'bundled'
}

export enum VulnerabilitySeverity {
    NONE = 'none',
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum LicenseRiskLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    FORBIDDEN = 'forbidden'
}

export enum ProjectType {
    MAVEN = 'maven',
    GRADLE = 'gradle',
    SBT = 'sbt',
    NPM = 'npm',
    PYTHON = 'python',
    CARGO = 'rust',
    COMPOSER = 'php',
    NUGET = 'dotnet',
    GO = 'go',
    MIX = 'elixir',
    LEININGEN = 'clojure',
    GRADLE_KOTLIN = 'gradle-kotlin'
}

export enum ProjectStatus {
    ACTIVE = 'active',
    ARCHIVED = 'archived',
    ANALYZING = 'analyzing',
    ERROR = 'error',
    PENDING = 'pending'
}

export enum PolicySeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

export enum NotificationLevel {
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info'
}

export enum RecommendationType {
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    MAINTENANCE = 'maintenance',
    COMPLIANCE = 'compliance',
    UPDATE = 'update',
    REMOVAL = 'removal',
    REPLACEMENT = 'replacement'
}

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface PaginatedRequest {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    filter?: Record<string, any>;
}

export interface SearchParams extends PaginatedRequest {
    query?: string;
    ecosystems?: Ecosystem[];
    severities?: VulnerabilitySeverity[];
    scopes?: DependencyScope[];
    hasVulnerabilities?: boolean;
    updatedAfter?: string;
}
