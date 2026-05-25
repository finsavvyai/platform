import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useConnectionStore } from '../stores/connectionStore';
import type { ConnectionConfig } from '../types/api';

// Query keys
export const connectionKeys = {
    all: ['connections'] as const,
    detail: (id: string) => ['connections', id] as const,
    status: (id: string) => ['connections', id, 'status'] as const,
};

/**
 * Hook to fetch all connections
 */
export function useConnections() {
    const setConnections = useConnectionStore((state) => state.setConnections);

    return useQuery({
        queryKey: connectionKeys.all,
        queryFn: async () => {
            const connections = await api.connections.getAll();
            setConnections(connections);
            return connections;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to fetch a single connection
 */
export function useConnection(id: string) {
    return useQuery({
        queryKey: connectionKeys.detail(id),
        queryFn: () => api.connections.getById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new connection
 */
export function useCreateConnection() {
    const queryClient = useQueryClient();
    const addConnection = useConnectionStore((state) => state.addConnection);

    return useMutation({
        mutationFn: (connection: Omit<ConnectionConfig, 'id'>) =>
            api.connections.create(connection),
        onSuccess: (newConnection) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.all });
            addConnection(newConnection);
        },
    });
}

/**
 * Hook to update a connection
 */
export function useUpdateConnection() {
    const queryClient = useQueryClient();
    const updateConnection = useConnectionStore((state) => state.updateConnection);

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<ConnectionConfig> }) =>
            api.connections.update(id, updates),
        onSuccess: (updatedConnection) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.all });
            if (updatedConnection.id) {
                updateConnection(updatedConnection.id, updatedConnection);
            }
        },
    });
}

/**
 * Hook to delete a connection
 */
export function useDeleteConnection() {
    const queryClient = useQueryClient();
    const removeConnection = useConnectionStore((state) => state.removeConnection);

    return useMutation({
        mutationFn: (id: string) => api.connections.delete(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.all });
            removeConnection(id);
        },
    });
}

/**
 * Hook to test a connection
 */
export function useTestConnection() {
    return useMutation({
        mutationFn: (connection: Omit<ConnectionConfig, 'id'>) =>
            api.connections.test(connection),
    });
}
