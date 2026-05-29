import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useQueryStore } from '../stores/queryStore';
import type { Query, QueryExecutionRequest } from '../types/api';

// Query keys
export const queryKeys = {
    all: ['queries'] as const,
    detail: (id: string) => ['queries', id] as const,
};

/**
 * Hook to fetch all saved queries
 */
export function useQueries() {
    const setSavedQueries = useQueryStore((state) => state.setSavedQueries);

    return useQuery({
        queryKey: queryKeys.all,
        queryFn: async () => {
            const queries = await api.queries.getAll();
            setSavedQueries(queries);
            return queries;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to fetch a single query
 */
export function useQueryById(id: string) {
    return useQuery({
        queryKey: queryKeys.detail(id),
        queryFn: () => api.queries.getById(id),
        enabled: !!id,
    });
}

/**
 * Hook to save a new query
 */
export function useSaveQuery() {
    const queryClient = useQueryClient();
    const addSavedQuery = useQueryStore((state) => state.addSavedQuery);

    return useMutation({
        mutationFn: (query: Omit<Query, 'id'>) => api.queries.create(query),
        onSuccess: (newQuery) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.all });
            addSavedQuery(newQuery);
        },
    });
}

/**
 * Hook to update a query
 */
export function useUpdateQuery() {
    const queryClient = useQueryClient();
    const updateSavedQuery = useQueryStore((state) => state.updateSavedQuery);

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Query> }) =>
            api.queries.update(id, updates),
        onSuccess: (updatedQuery) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.all });
            if (updatedQuery.id) {
                updateSavedQuery(updatedQuery.id, updatedQuery);
            }
        },
    });
}

/**
 * Hook to delete a query
 */
export function useDeleteQuery() {
    const queryClient = useQueryClient();
    const removeSavedQuery = useQueryStore((state) => state.removeSavedQuery);

    return useMutation({
        mutationFn: (id: string) => api.queries.delete(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.all });
            removeSavedQuery(id);
        },
    });
}

/**
 * Hook to execute a query
 */
export function useExecuteQuery() {
    const setIsExecuting = useQueryStore((state) => state.setIsExecuting);
    const setCurrentResult = useQueryStore((state) => state.setCurrentResult);
    const setCurrentError = useQueryStore((state) => state.setCurrentError);
    const addToHistory = useQueryStore((state) => state.addToHistory);

    return useMutation({
        mutationFn: (request: QueryExecutionRequest) => api.queries.execute(request),
        onMutate: () => {
            setIsExecuting(true);
        },
        onSuccess: (result, variables) => {
            setCurrentResult(result);
            addToHistory({
                query: variables.sql,
                connectionId: variables.connectionId,
                result,
                timestamp: new Date().toISOString(),
            });
        },
        onError: (error: any, variables) => {
            const errorMessage = error.message || 'Query execution failed';
            setCurrentError(errorMessage);
            addToHistory({
                query: variables.sql,
                connectionId: variables.connectionId,
                error: errorMessage,
                timestamp: new Date().toISOString(),
            });
        },
        onSettled: () => {
            setIsExecuting(false);
        },
    });
}
