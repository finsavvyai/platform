import { apiFetch, getAuthToken, API_URL } from './client';
import type { Agent, Execution, CustomAgent } from './types';

export const agentsApi = {
    list: async (): Promise<{ agents: Agent[]; total: number; free: number; pro: number }> => {
        const res = await apiFetch('/agents/list');
        return res.json();
    },

    execute: async (
        agent: string,
        context: string,
        options?: { provider?: string; model?: string }
    ): Promise<Response> => {
        const token = getAuthToken();
        return fetch(`${API_URL}/agents/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ agent, context, ...options }),
        });
    },

    executions: async (): Promise<{ executions: Execution[]; count: number }> => {
        const res = await apiFetch('/agents/executions');
        return res.json();
    },

    listCustom: async (): Promise<{ agents: CustomAgent[] }> => {
        const res = await apiFetch('/agents/custom');
        return res.json();
    },

    getGallery: async (): Promise<{ agents: CustomAgent[] }> => {
        const res = await apiFetch('/agents/custom/gallery');
        return res.json();
    },

    forkCustom: async (id: string): Promise<{ success: boolean; id?: string; slug?: string; error?: string }> => {
        const res = await apiFetch(`/agents/custom/${id}/fork`, { method: 'POST' });
        return res.json();
    },

    createCustom: async (agent: Partial<CustomAgent>) => {
        const res = await apiFetch('/agents/custom', {
            method: 'POST',
            body: JSON.stringify({
                name: agent.name,
                slug: agent.slug,
                description: agent.description,
                promptVariants: agent.promptVariants || [],
                category: agent.category,
                model: agent.model,
                temperature: agent.temperature,
                isPublic: agent.is_public
            }),
        });
        return res.json();
    },

    deleteCustom: async (id: string) => {
        const res = await apiFetch(`/agents/custom/${id}`, { method: 'DELETE' });
        return res.json();
    },
};
