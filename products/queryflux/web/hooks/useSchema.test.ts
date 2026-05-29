import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSchema } = vi.hoisted(() => ({
    mockGetSchema: vi.fn(),
}));

vi.mock('../services/api', () => ({
    api: {
        schema: { getSchema: mockGetSchema },
    },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSchema, schemaKeys } from './useSchema';

function createWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children);
}

describe('useSchema', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array when connectionId is null', async () => {
        const { result } = renderHook(() => useSchema(null), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isFetching).toBe(false));
        expect(mockGetSchema).not.toHaveBeenCalled();
    });

    it('fetches and transforms schema for a valid connection', async () => {
        mockGetSchema.mockResolvedValue({
            databases: [{
                name: 'testdb',
                schemas: [{
                    name: 'public',
                    tables: [{
                        name: 'users',
                        rowCount: 100,
                        columns: [
                            { name: 'id', type: 'int', nullable: false, isPrimaryKey: true },
                            { name: 'email', type: 'varchar', nullable: true, isPrimaryKey: false },
                        ],
                    }],
                }],
            }],
        });

        const { result } = renderHook(() => useSchema('conn-1'), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockGetSchema).toHaveBeenCalledWith('conn-1');
        expect(result.current.data).toEqual([{
            name: 'public',
            tables: [{
                name: 'users',
                rowCount: 100,
                columns: [
                    { name: 'id', type: 'int', nullable: false, isPrimaryKey: true },
                    { name: 'email', type: 'varchar', nullable: true, isPrimaryKey: false },
                ],
            }],
        }]);
    });

    it('handles multiple schemas across databases', async () => {
        mockGetSchema.mockResolvedValue({
            databases: [
                {
                    name: 'db1',
                    schemas: [
                        { name: 'public', tables: [] },
                        { name: 'analytics', tables: [] },
                    ],
                },
            ],
        });

        const { result } = renderHook(() => useSchema('conn-2'), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toHaveLength(2);
        expect(result.current.data![0].name).toBe('public');
        expect(result.current.data![1].name).toBe('analytics');
    });

    it('sets error state on API failure', async () => {
        mockGetSchema.mockRejectedValue(new Error('Connection refused'));

        const { result } = renderHook(() => useSchema('bad-conn'), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error?.message).toBe('Connection refused');
    });

    describe('schemaKeys', () => {
        it('generates correct query key', () => {
            expect(schemaKeys.byConnection('conn-1')).toEqual(['schema', 'conn-1']);
        });
    });
});
