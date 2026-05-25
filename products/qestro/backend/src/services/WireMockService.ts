import axios from 'axios';

export interface WireMockStub {
    id?: string;
    name?: string;
    request: {
        method: string;
        url?: string;
        urlPath?: string;
        urlPattern?: string;
        urlPathPattern?: string;
        queryParameters?: Record<string, any>;
        headers?: Record<string, any>;
        bodyPatterns?: any[];
    };
    response: {
        status: number;
        body?: string;
        jsonBody?: any;
        headers?: Record<string, string>;
        fixedDelayMilliseconds?: number;
    };
    priority?: number;
    metadata?: Record<string, any>;
}

export class WireMockService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.WIREMOCK_ADMIN_URL || 'http://localhost:8080/__admin';
    }

    /**
     * Get all stub mappings
     */
    async getAllStubs() {
        try {
            const response = await axios.get(`${this.baseUrl}/mappings`);
            return response.data;
        } catch (error) {
            console.error('Error fetching WireMock stubs:', error);
            // If WireMock is not running, return empty list or handle gracefully
            if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
                console.warn('WireMock service is not reachable. Is it running?');
                return { mappings: [], meta: { total: 0 } };
            }
            throw error;
        }
    }

    /**
     * Create a new stub mapping
     */
    async createStub(stub: WireMockStub) {
        try {
            const response = await axios.post(`${this.baseUrl}/mappings`, stub);
            return response.data;
        } catch (error) {
            console.error('Error creating WireMock stub:', error);
            throw error;
        }
    }

    /**
     * Get a stub mapping by ID
     */
    async getStub(id: string) {
        try {
            const response = await axios.get(`${this.baseUrl}/mappings/${id}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching WireMock stub ${id}:`, error);
            throw error;
        }
    }

    /**
     * Update an existing stub mapping
     */
    async updateStub(id: string, stub: WireMockStub) {
        try {
            const response = await axios.put(`${this.baseUrl}/mappings/${id}`, stub);
            return response.data;
        } catch (error) {
            console.error(`Error updating WireMock stub ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a stub mapping
     */
    async deleteStub(id: string) {
        try {
            await axios.delete(`${this.baseUrl}/mappings/${id}`);
            return { success: true };
        } catch (error) {
            console.error(`Error deleting WireMock stub ${id}:`, error);
            throw error;
        }
    }

    /**
     * Reset all mappings (clear all stubs)
     */
    async reset() {
        try {
            await axios.post(`${this.baseUrl}/reset`);
            return { success: true };
        } catch (error) {
            console.error('Error resetting WireMock stubs:', error);
            throw error;
        }
    }

    /**
     * Get requests received by WireMock (for verification)
     */
    async getRequests() {
        try {
            const response = await axios.get(`${this.baseUrl}/requests`);
            return response.data;
        } catch (error) {
            console.error('Error fetching WireMock requests:', error);
            throw error;
        }
    }
}

export const wireMockService = new WireMockService();
