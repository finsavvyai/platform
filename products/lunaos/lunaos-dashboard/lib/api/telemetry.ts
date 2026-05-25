import { apiFetch } from './client';

export interface VariantStats {
    variantId: string;
    totalExecutions: number;
    avgDurationMs: number;
    errorRate: number;
    winRate?: number;
}

export interface AgentStats {
    agent: string;
    totalExecutions: number;
    avgDurationMs: number;
    errorRate: number;
    lastUsed: string;
    variants?: VariantStats[];
}

export interface ProviderStats {
    provider: string;
    model: string;
    totalCalls: number;
    avgDurationMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
}

export interface OverviewMetrics {
    totalExecutions: number;
    uniqueUsers: number;
    avgDurationMs: number;
    errorRate: number;
    topAgents: AgentStats[];
    topProviders: ProviderStats[];
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
}

export const telemetryApi = {
    overview: async (since?: string): Promise<OverviewMetrics> => {
        const q = since ? `?since=${encodeURIComponent(since)}` : '';
        const res = await apiFetch(`/telemetry/overview${q}`);
        const json = await res.json() as { data: OverviewMetrics };
        return json.data;
    },

    agents: async (since?: string): Promise<AgentStats[]> => {
        const q = since ? `?since=${encodeURIComponent(since)}` : '';
        const res = await apiFetch(`/telemetry/agents${q}`);
        const json = await res.json() as { data: AgentStats[] };
        return json.data || [];
    },

    providers: async (since?: string): Promise<ProviderStats[]> => {
        const q = since ? `?since=${encodeURIComponent(since)}` : '';
        const res = await apiFetch(`/telemetry/providers${q}`);
        const json = await res.json() as { data: ProviderStats[] };
        return json.data || [];
    },
};
