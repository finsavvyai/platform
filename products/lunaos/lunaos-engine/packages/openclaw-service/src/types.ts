/**
 * OpenClaw Service Types
 */

// ─── Environment Bindings ───────────────────────────────────────────────────

export interface ServiceEnv {
    // D1 database (shared with LunaOS engine)
    DB: D1Database;
    // KV for caching & session state
    KV: KVNamespace;
    // Secrets
    JWT_SECRET?: string;
    SERVICE_SECRET?: string;
    DEEPSEEK_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    // AI bindings
    AI: any;
    VECTORIZE: any;
    // Runtime
    ENVIRONMENT: string;
    SERVICE_NAME: string;
    VERSION: string;
}

// ─── Auth Context ───────────────────────────────────────────────────────────

export interface AuthContext {
    userId: string;
    email?: string;
    tier?: string;
    source: 'jwt' | 'api-key' | 'service-binding' | 'internal';
}

// ─── Hono App Type ──────────────────────────────────────────────────────────

export type AppEnv = {
    Bindings: ServiceEnv;
    Variables: {
        authContext: AuthContext;
        userId: string;
    };
};


// ─── Tool Definitions ───────────────────────────────────────────────────────

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, ToolParam>;
    category: 'execution' | 'search' | 'indexing' | 'meta';
}

export interface ToolParam {
    type: string;
    description: string;
    required?: boolean;
    default?: any;
    enum?: readonly string[];
}

// ─── Agent & Chain ──────────────────────────────────────────────────────────

export interface AgentDefinition {
    slug: string;
    name: string;
    category: string;
    tier: 'free' | 'pro';
    description: string;
    systemPrompt: string;
    defaultProvider: string;
    defaultModel: string;
}

export interface ChainPreset {
    slug: string;
    name: string;
    description: string;
    agents: string[];
    nodeCount: number;
}

// ─── Gateway ────────────────────────────────────────────────────────────────

export interface GatewayRecord {
    id: string;
    userId: string;
    gatewayUrl: string;
    label: string;
    status: 'active' | 'inactive' | 'deleted';
    healthStatus: 'healthy' | 'degraded' | 'offline' | 'unknown';
    lastConnectedAt?: string;
    capabilities?: string[];
    metadata?: any;
}

// ─── Execution ──────────────────────────────────────────────────────────────

export interface ExecutionRequest {
    agent: string;
    context: string;
    provider?: string;
    model?: string;
    useRag?: boolean;
    source?: string;
    metadata?: Record<string, any>;
}

export interface ChainRequest {
    preset: string;
    context: string;
    provider?: string;
    source?: string;
}

export interface SearchRequest {
    query: string;
    topK?: number;
    repoName?: string;
}

export interface IndexRequest {
    files: Array<{ path: string; content: string }>;
    repoName?: string;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface SkillExecution {
    id: string;
    userId: string;
    skillName: string;
    agentSlug?: string;
    provider: string;
    inputLength: number;
    outputLength: number;
    durationMs: number;
    status: 'completed' | 'failed' | 'timeout';
    error?: string;
    source: string;
    createdAt: string;
}

export interface AnalyticsOverview {
    period: string;
    gateways: { total: number; active: number; healthy: number };
    sessions: { total: number; active: number; avgDurationMs: number };
    skills: { totalExecutions: number; avgDurationMs: number; successRate: number };
    topAgents: Array<{ slug: string; count: number }>;
    topProviders: Array<{ provider: string; count: number }>;
}

// ─── Bridge (Cross-Platform) ────────────────────────────────────────────────

export interface BridgeRequest {
    source: 'luna' | 'openhands' | 'cli' | 'external';
    action: 'execute' | 'chain' | 'search' | 'index' | 'status';
    payload: Record<string, any>;
    auth: {
        type: 'api-key' | 'service-key' | 'jwt';
        credential: string;
    };
    metadata?: {
        requestId?: string;
        correlationId?: string;
        userAgent?: string;
    };
}

export interface BridgeResponse {
    success: boolean;
    data?: any;
    error?: string;
    executionId?: string;
    source: string;
    durationMs: number;
    timestamp: string;
}
