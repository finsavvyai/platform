import apiClient from '../lib/api-client';
import type {
    Query,
    QueryResult,
    QueryExecutionRequest,
    APIResponse,
} from '../types/api';

// ============================================================================
// Query API
// ============================================================================

export const queryAPI = {
    /**
     * Get all saved queries
     */
    async getAll(): Promise<Query[]> {
        const response = await apiClient.get<APIResponse<Query[]>>('/api/v1/queries');
        return response.data.data;
    },

    /**
     * Get a single query by ID
     */
    async getById(id: string): Promise<Query> {
        const response = await apiClient.get<APIResponse<Query>>(`/api/v1/queries/${id}`);
        return response.data.data;
    },

    /**
     * Save a new query
     */
    async create(query: Omit<Query, 'id'>): Promise<Query> {
        const response = await apiClient.post<APIResponse<Query>>('/api/v1/queries', query);
        return response.data.data;
    },

    /**
     * Update an existing query
     */
    async update(id: string, query: Partial<Query>): Promise<Query> {
        const response = await apiClient.put<APIResponse<Query>>(`/api/v1/queries/${id}`, query);
        return response.data.data;
    },

    /**
     * Delete a query
     */
    async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/v1/queries/${id}`);
    },

    /**
     * Execute a query
     */
    async execute(request: QueryExecutionRequest): Promise<QueryResult> {
        const response = await apiClient.post<APIResponse<QueryResult>>('/api/v1/database/query', request);
        return response.data.data;
    },
};
