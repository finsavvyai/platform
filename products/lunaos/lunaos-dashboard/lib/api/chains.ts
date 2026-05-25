import { apiFetch, getAuthToken, API_URL } from './client';

export interface ChainNode {
    id: string;
    agent: string;
    label?: string;
    promptTemplate?: string;
    requiresApproval?: boolean;
    config?: {
        provider?: string;
        model?: string;
        maxTokens?: number;
        temperature?: number;
    };
}

export interface PresetChain {
    slug: string;
    name: string;
    description: string;
    nodeCount: number;
    agents: string[];
}

export interface ChainExecution {
    id: string;
    chain_name: string;
    status: string;
    duration_ms: number | null;
    created_at: string;
    completed_at: string | null;
}

export const chainsApi = {
    listPresets: async (): Promise<{ presets: PresetChain[]; total: number }> => {
        const res = await apiFetch('/chains');
        return res.json();
    },

    execute: async (
        preset: string,
        context: string,
        options?: { provider?: string; model?: string; chain?: any; }
    ): Promise<Response> => {
        const token = getAuthToken();
        const body: Record<string, any> = { context, ...options };
        if (preset) {
            body.preset = preset;
        }
        return fetch(`${API_URL}/chains/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
        });
    },

    resume: async (
        id: string,
        context: string,
        options?: { provider?: string; model?: string }
    ): Promise<Response> => {
        const token = getAuthToken();
        return fetch(`${API_URL}/chains/${id}/resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ context, ...options }),
        });
    },

    history: async (limit = 20, offset = 0): Promise<{ executions: ChainExecution[]; count: number }> => {
        const res = await apiFetch(`/chains/history?limit=${limit}&offset=${offset}`);
        return res.json();
    },

    status: async (id: string) => {
        const res = await apiFetch(`/chains/${id}/status`);
        return res.json();
    },
};
