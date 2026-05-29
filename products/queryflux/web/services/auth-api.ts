import apiClient from '../lib/api-client';
import type { APIResponse } from '../types/api';

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
}

export interface ServerMetrics {
    totalQueries: number;
    totalErrors: number;
    uptimeSeconds: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    maxMs: number;
    sampleCount: number;
}

// ============================================================================
// Auth API
// ============================================================================

export const authAPI = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await apiClient.post<APIResponse<LoginResponse>>('/auth/login', { email, password });
        const tokens = response.data.data;
        localStorage.setItem('auth_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        return tokens;
    },
    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
    },
    isAuthenticated(): boolean {
        return !!localStorage.getItem('auth_token');
    },
};

// ============================================================================
// Server Metrics API
// ============================================================================

export const serverMetricsAPI = {
    async getGlobal(): Promise<ServerMetrics> {
        const response = await apiClient.get<APIResponse<ServerMetrics>>('/api/v1/metrics');
        return response.data.data;
    },
};

// ============================================================================
// Health API
// ============================================================================

export const healthAPI = {
    /**
     * Check server health
     */
    async check(): Promise<{ status: string; timestamp: string }> {
        const response = await apiClient.get('/health');
        return response.data;
    },
};
