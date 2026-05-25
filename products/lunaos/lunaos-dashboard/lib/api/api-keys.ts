import { apiFetch } from './client';

export interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
}

export const apiKeysApi = {
    create: async (name: string) => {
        const res = await apiFetch('/api-keys', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
        return res.json() as Promise<{ id: string; name: string; key: string; prefix: string; createdAt: string }>;
    },

    list: async () => {
        const res = await apiFetch('/api-keys');
        return res.json() as Promise<{ keys: ApiKey[] }>;
    },

    revoke: async (id: string) => {
        const res = await apiFetch(`/api-keys/${id}`, { method: 'DELETE' });
        return res.json();
    },
};
