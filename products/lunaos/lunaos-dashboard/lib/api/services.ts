import { apiFetch } from './client';

export interface ServiceInfo {
    id: string;
    name: string;
    icon: string;
    description: string;
    tier: 'core' | 'integration' | 'premium';
    status: 'active' | 'inactive' | 'partial' | 'error';
    quickInfo: string;
    enabled: boolean;
    stats: Record<string, any>;
    actions: { id: string; label: string; method: string; endpoint: string; description: string }[];
    configurable: boolean;
}

export interface ServicesCatalog {
    services: ServiceInfo[];
    total: number;
    byTier: { core: number; integration: number; premium: number };
    timestamp: string;
}

export interface ChannelConnection {
    id: string;
    channel_type: string;
    label: string;
    status: string;
    external_name: string;
    message_count: number;
    last_message_at: string | null;
    connected_at: string;
}

export interface ProviderInfo {
    id: string;
    name: string;
    model: string;
    configured: boolean;
    description: string;
    endpoint: string;
}

export interface ServiceHealth {
    status: 'healthy' | 'degraded';
    latency: string;
    checks: Record<string, { ok: boolean; detail: string }>;
    serviceCount: number;
    timestamp: string;
}

export const servicesApi = {
    catalog: async (): Promise<ServicesCatalog> => {
        const res = await apiFetch('/openclaw/services');
        return res.json();
    },

    detail: async (category: string): Promise<{ service: ServiceInfo; detail: any }> => {
        const res = await apiFetch(`/openclaw/services/${category}`);
        return res.json();
    },

    updatePreferences: async (category: string, prefs: Record<string, any>) => {
        const res = await apiFetch(`/openclaw/services/${category}`, {
            method: 'PATCH',
            body: JSON.stringify(prefs),
        });
        return res.json();
    },

    test: async (category: string): Promise<{ service: string; healthy: boolean; checks: Record<string, any>; totalLatency: string }> => {
        const res = await apiFetch(`/openclaw/services/${category}/test`, { method: 'POST' });
        return res.json();
    },

    health: async (): Promise<ServiceHealth> => {
        const res = await apiFetch('/openclaw/services/health');
        return res.json();
    },

    channels: {
        types: async () => {
            const res = await apiFetch('/openclaw/services/channels/types');
            return res.json();
        },
        connections: async (): Promise<{ connections: ChannelConnection[] }> => {
            const res = await apiFetch('/openclaw/services/channels/connections');
            return res.json();
        },
        connect: async (channelType: string, config: Record<string, any>) => {
            const res = await apiFetch('/openclaw/services/channels/connect', {
                method: 'POST',
                body: JSON.stringify({ channelType, ...config }),
            });
            return res.json();
        },
        disconnect: async (id: string) => {
            const res = await apiFetch(`/openclaw/services/channels/${id}`, { method: 'DELETE' });
            return res.json();
        },
        test: async (id: string) => {
            const res = await apiFetch(`/openclaw/services/channels/${id}/test`, { method: 'POST' });
            return res.json();
        },
        stats: async (id: string) => {
            const res = await apiFetch(`/openclaw/services/channels/${id}/stats`);
            return res.json();
        },
    },

    providers: async (): Promise<{ providers: ProviderInfo[]; defaultProvider: string }> => {
        const res = await apiFetch('/openclaw/services/providers/status');
        return res.json();
    },
};
