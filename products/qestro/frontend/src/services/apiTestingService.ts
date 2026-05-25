/**
 * API Testing Service
 * Frontend API client for the API Testing module
 */

import { LOCAL_API_ORIGIN } from '../config/devDefaults';

const API_BASE = import.meta.env.VITE_API_URL || LOCAL_API_ORIGIN;
const ALLOW_MOCK_FALLBACKS = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_FALLBACKS === 'true';

export interface APICollection {
    id: string;
    name: string;
    description?: string;
    requests: APIRequest[];
    variables?: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
}

export interface APIRequest {
    id: string;
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    bodyType?: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
    auth?: AuthConfig;
    preRequestScript?: string;
    testScript?: string;
    description?: string;
}

export interface AuthConfig {
    type: 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyLocation?: 'header' | 'query';
    apiKeyName?: string;
}

export interface Environment {
    id: string;
    name: string;
    variables: Record<string, string>;
    projectId: string;
    isActive: boolean;
}

export interface RequestHistory {
    id: string;
    requestId: string;
    collectionId: string;
    method: string;
    url: string;
    status: number;
    responseTime: number;
    responseSize: number;
    timestamp: Date;
}

export interface ExecuteResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    responseTime: number;
    responseSize: number;
}

const getAuthHeader = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
        || localStorage.getItem('auth_token')
        || localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const apiError = async (res: Response, fallback: string) => {
    let message = fallback;
    try {
        const body = await res.json();
        message = body?.error || body?.message || message;
    } catch {
        // Keep fallback when the backend does not return JSON.
    }
    return new Error(`${message} (${res.status})`);
};

export const apiTestingService = {
    // Collections
    async getCollections(projectId?: string): Promise<APICollection[]> {
        const params = projectId ? `?projectId=${projectId}` : '';
        try {
            const res = await fetch(`${API_BASE}/api/api-testing/collections${params}`, {
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error('Failed to fetch collections');
            const data = await res.json();
            return data.data || [];
        } catch (error) {
            if (!ALLOW_MOCK_FALLBACKS) {
                throw error;
            }

            console.warn('Backend unavailable, using local development mock collections');
            return [
                {
                    id: 'mock-1',
                    name: 'Qestro API',
                    projectId: '1',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    requests: [
                        { id: 'req-1', name: 'Get Projects', method: 'GET', url: '/api/projects' },
                        { id: 'req-2', name: 'Create Test', method: 'POST', url: '/api/tests' }
                    ]
                }
            ] as APICollection[];
        }
    },

    async createCollection(name: string, description?: string, projectId?: string): Promise<APICollection> {
        const res = await fetch(`${API_BASE}/api/api-testing/collections`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, projectId })
        });
        if (!res.ok) throw await apiError(res, 'Failed to create collection');
        const data = await res.json();
        return data.data;
    },

    async deleteCollection(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/api/api-testing/collections/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (!res.ok) throw await apiError(res, 'Failed to delete collection');
    },

    // Requests
    async addRequest(collectionId: string, request: Partial<APIRequest>): Promise<APIRequest> {
        const res = await fetch(`${API_BASE}/api/api-testing/collections/${collectionId}/requests`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!res.ok) throw await apiError(res, 'Failed to add request');
        const data = await res.json();
        return data.data;
    },

    // Execute
    async executeRequest(params: {
        method: string;
        url: string;
        headers?: Record<string, string>;
        body?: unknown;
        auth?: AuthConfig;
        environmentId?: string;
    }): Promise<ExecuteResponse> {
        const res = await fetch(`${API_BASE}/api/api-testing/execute`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!res.ok) throw await apiError(res, 'Failed to execute request');
        const data = await res.json();
        return data.data;
    },

    // History
    async getHistory(limit = 50): Promise<RequestHistory[]> {
        const res = await fetch(`${API_BASE}/api/api-testing/history?limit=${limit}`, {
            headers: getAuthHeader()
        });
        if (!res.ok) throw await apiError(res, 'Failed to fetch request history');
        const data = await res.json();
        return data.data || [];
    },

    // Environments
    async getEnvironments(projectId?: string): Promise<Environment[]> {
        const params = projectId ? `?projectId=${projectId}` : '';
        const res = await fetch(`${API_BASE}/api/api-testing/environments${params}`, {
            headers: getAuthHeader()
        });
        if (!res.ok) throw await apiError(res, 'Failed to fetch environments');
        const data = await res.json();
        return data.data || [];
    },

    async createEnvironment(name: string, variables: Record<string, string>, projectId?: string): Promise<Environment> {
        const res = await fetch(`${API_BASE}/api/api-testing/environments`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, variables, projectId })
        });
        if (!res.ok) throw await apiError(res, 'Failed to create environment');
        const data = await res.json();
        return data.data;
    },

    // Postman Import/Export
    async importPostmanCollection(collection: unknown, projectId?: string): Promise<APICollection> {
        const res = await fetch(`${API_BASE}/api/api-testing/import/postman`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection, projectId })
        });
        const data = await res.json();
        return data.data;
    },

    async exportPostmanCollection(collectionId: string): Promise<unknown> {
        const res = await fetch(`${API_BASE}/api/api-testing/export/postman/${collectionId}`, {
            headers: getAuthHeader()
        });
        return res.json();
    }
};

export default apiTestingService;
