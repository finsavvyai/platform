import { apiFetch } from './client';

export interface KBDocument {
    id: string;
    title: string;
    created_at: string;
}

export const kbApi = {
    list: async (): Promise<{ documents: KBDocument[] }> => {
        const res = await apiFetch('/kb');
        return res.json();
    },

    upload: async (title: string, content: string, tags?: string[]) => {
        const res = await apiFetch('/kb/upload', {
            method: 'POST',
            body: JSON.stringify({ title, content, tags }),
        });
        return res.json();
    },

    delete: async (id: string) => {
        const res = await apiFetch(`/kb/${id}`, { method: 'DELETE' });
        return res.json();
    },
};
