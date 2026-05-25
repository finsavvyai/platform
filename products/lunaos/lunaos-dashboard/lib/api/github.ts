import { apiFetch } from './client';

export interface GitHubStatus {
    connected: boolean;
    username?: string;
    githubId?: string;
    scopes?: string;
    connectedAt?: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    private: boolean;
    url: string;
    defaultBranch: string;
    updatedAt: string;
    starCount: number;
    size: number;
    indexed: boolean;
}

export interface IndexedRepo {
    fullName: string;
    fileCount: number;
    indexedAt: string;
}

export const githubApi = {
    status: async (): Promise<GitHubStatus> => {
        const res = await apiFetch('/github/status');
        return res.json();
    },

    getAuthUrl: async (): Promise<{ url: string }> => {
        const res = await apiFetch('/github/auth');
        return res.json();
    },

    repos: async (page = 1): Promise<{ repos: GitHubRepo[]; page: number; perPage: number; total: number }> => {
        const res = await apiFetch(`/github/repos?page=${page}&per_page=30&sort=updated`);
        return res.json();
    },

    indexRepo: async (owner: string, repo: string): Promise<{
        success: boolean;
        repo: string;
        totalSourceFiles: number;
        indexedFiles: number;
        processed: number;
        failed: number;
        processingTime: number;
        skipped: number;
    }> => {
        const res = await apiFetch(`/github/repos/${owner}/${repo}/index`, { method: 'POST' });
        return res.json();
    },

    indexed: async (): Promise<{ repos: IndexedRepo[] }> => {
        const res = await apiFetch('/github/indexed');
        return res.json();
    },

    disconnect: async (): Promise<{ success: boolean }> => {
        const res = await apiFetch('/github/disconnect', { method: 'DELETE' });
        return res.json();
    },
};
