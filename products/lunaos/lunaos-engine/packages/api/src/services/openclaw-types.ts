/**
 * OpenClaw Types — shared type definitions for the OpenClaw integration layer
 */

// ─── Constants ──────────────────────────────────────────────────────────────

export const LUNA_AGENTS = [
    '365-security', 'analytics', 'api-generator', 'auth', 'cloudflare',
    'code-review', 'database', 'deployment', 'design-architect', 'docker',
    'documentation', 'glm-vision', 'hig', 'lemonsqueezy',
    'monitoring-observability', 'openai-app', 'post-launch-review',
    'rag-enhanced', 'rag', 'requirements-analyzer', 'run', 'seo',
    'task-executor', 'task-planner', 'testing-validation', 'ui-fix',
    'ui-test', 'user-guide',
] as const;

export const CHAIN_PRESETS = [
    'full-review', 'new-feature', 'deploy', 'security-audit', 'api-design',
] as const;

export type LunaAgentSlug = typeof LUNA_AGENTS[number];
export type ChainPresetSlug = typeof CHAIN_PRESETS[number];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OpenClawToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, OpenClawParamDef>;
}

export interface OpenClawParamDef {
    type: string;
    description: string;
    required?: boolean;
    default?: any;
    enum?: readonly string[];
}

export interface OpenClawToolResult {
    success: boolean;
    data?: any;
    error?: string;
    executionId?: string;
    durationMs?: number;
}

export interface GatewayInfo {
    id: string;
    gatewayUrl: string;
    token: string;
    label: string;
    status: string;
    healthStatus: string;
    lastConnectedAt?: string;
    capabilities?: string[];
}

export interface SessionInfo {
    id: string;
    gatewayId: string;
    sessionKey: string;
    runId: string;
    agent: string;
    agentName: string;
    status: string;
    messageCount: number;
    durationMs: number;
    createdAt: string;
    completedAt?: string;
}

export interface OpenClawWSMessage {
    type: 'req' | 'res' | 'event';
    id?: string;
    method?: string;
    params?: Record<string, any>;
    ok?: boolean;
    payload?: any;
    error?: string;
    event?: string;
}
