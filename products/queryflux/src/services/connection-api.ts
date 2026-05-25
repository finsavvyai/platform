import apiClient from '../lib/api-client';
import type {
    ConnectionConfig,
    ConnectionStatus,
    SchemaInfo,
    APIResponse,
} from '../types/api';

// ============================================================================
// Connection API
// ============================================================================

export const connectionAPI = {
    /**
     * Get all database connections
     */
    async getAll(): Promise<ConnectionConfig[]> {
        const response = await apiClient.get<APIResponse<ConnectionConfig[]>>('/api/v1/connections');
        return response.data.data;
    },

    /**
     * Get a single connection by ID
     */
    async getById(id: string): Promise<ConnectionConfig> {
        const response = await apiClient.get<APIResponse<ConnectionConfig>>(`/api/v1/connections/${id}`);
        return response.data.data;
    },

    /**
     * Create a new connection
     */
    async create(connection: Omit<ConnectionConfig, 'id'>): Promise<ConnectionConfig> {
        const response = await apiClient.post<APIResponse<ConnectionConfig>>('/api/v1/connections', connection);
        return response.data.data;
    },

    /**
     * Update an existing connection
     */
    async update(id: string, connection: Partial<ConnectionConfig>): Promise<ConnectionConfig> {
        const response = await apiClient.put<APIResponse<ConnectionConfig>>(`/api/v1/connections/${id}`, connection);
        return response.data.data;
    },

    /**
     * Delete a connection
     */
    async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/v1/connections/${id}`);
    },

    /**
     * Test a connection
     */
    async test(connection: Omit<ConnectionConfig, 'id'>): Promise<ConnectionStatus> {
        const response = await apiClient.post<APIResponse<ConnectionStatus>>('/api/v1/database/connect', connection);
        return response.data.data;
    },
};

// ============================================================================
// Schema API
// ============================================================================

export const schemaAPI = {
    /**
     * Get schema information for a connection
     */
    async getSchema(connectionId: string): Promise<SchemaInfo> {
        const response = await apiClient.post<APIResponse<SchemaInfo>>('/api/v1/database/schema', {
            connectionId,
        });
        return response.data.data;
    },
};
