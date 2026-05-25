import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateSQL } = vi.hoisted(() => ({
    mockGenerateSQL: vi.fn(),
}));

vi.mock('../services/api', () => ({
    api: {
        nlp: { generateSQL: mockGenerateSQL },
    },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useNlpQuery } from './useNlpQuery';

function createWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children);
}

describe('useNlpQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls api.nlp.generateSQL on mutate', async () => {
        const response = { sql: 'SELECT 1', confidence: 0.9, explanation: 'test' };
        mockGenerateSQL.mockResolvedValue(response);

        const { result } = renderHook(() => useNlpQuery(), { wrapper: createWrapper() });

        result.current.mutate({ question: 'count users' });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockGenerateSQL).toHaveBeenCalledWith({ question: 'count users' });
        expect(result.current.data).toEqual(response);
    });

    it('passes schema when provided', async () => {
        mockGenerateSQL.mockResolvedValue({ sql: 'SELECT 1', confidence: 0.8, explanation: '' });

        const { result } = renderHook(() => useNlpQuery(), { wrapper: createWrapper() });

        result.current.mutate({ question: 'list tables', schema: 'public' });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockGenerateSQL).toHaveBeenCalledWith({ question: 'list tables', schema: 'public' });
    });

    it('passes dialect when provided', async () => {
        mockGenerateSQL.mockResolvedValue({ sql: 'SELECT 1', confidence: 0.9, explanation: '' });

        const { result } = renderHook(() => useNlpQuery(), { wrapper: createWrapper() });

        result.current.mutate({ question: 'count orders', dialect: 'mysql' });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockGenerateSQL).toHaveBeenCalledWith({ question: 'count orders', dialect: 'mysql' });
    });

    it('passes all fields together', async () => {
        mockGenerateSQL.mockResolvedValue({ sql: 'SELECT 1', confidence: 0.95, explanation: '' });

        const { result } = renderHook(() => useNlpQuery(), { wrapper: createWrapper() });

        result.current.mutate({ question: 'top users', schema: 'main', databaseId: 'db-1', dialect: 'sqlite' });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockGenerateSQL).toHaveBeenCalledWith({
            question: 'top users',
            schema: 'main',
            databaseId: 'db-1',
            dialect: 'sqlite',
        });
    });

    it('sets error state on failure', async () => {
        mockGenerateSQL.mockRejectedValue(new Error('API unavailable'));

        const { result } = renderHook(() => useNlpQuery(), { wrapper: createWrapper() });

        result.current.mutate({ question: 'fail' });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error?.message).toBe('API unavailable');
    });

    it('tracks pending state during mutation', async () => {
        let resolve: (v: unknown) => void;
        mockGenerateSQL.mockReturnValue(new Promise((r) => { resolve = r; }));

        const { result } = renderHook(() => useNlpQuery(), { wrapper: createWrapper() });

        expect(result.current.isPending).toBe(false);
        result.current.mutate({ question: 'test' });

        await waitFor(() => expect(result.current.isPending).toBe(true));

        resolve!({ sql: 'SELECT 1', confidence: 1, explanation: '' });
        await waitFor(() => expect(result.current.isPending).toBe(false));
    });
});
