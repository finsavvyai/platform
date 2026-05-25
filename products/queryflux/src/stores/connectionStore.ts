import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionConfig, ConnectionStatus } from '../types/api';

interface ConnectionState {
    // State
    connections: ConnectionConfig[];
    activeConnectionId: string | null;
    connectionStatuses: Record<string, ConnectionStatus>;

    // Actions
    setConnections: (connections: ConnectionConfig[]) => void;
    addConnection: (connection: ConnectionConfig) => void;
    updateConnection: (id: string, connection: Partial<ConnectionConfig>) => void;
    removeConnection: (id: string) => void;
    setActiveConnection: (id: string | null) => void;
    setConnectionStatus: (id: string, status: ConnectionStatus) => void;
    getActiveConnection: () => ConnectionConfig | null;
}

export const useConnectionStore = create<ConnectionState>()(
    persist(
        (set, get) => ({
            // Initial state
            connections: [],
            activeConnectionId: null,
            connectionStatuses: {},

            // Actions
            setConnections: (connections) => set({ connections }),

            addConnection: (connection) =>
                set((state) => ({
                    connections: [...state.connections, connection],
                })),

            updateConnection: (id, updates) =>
                set((state) => ({
                    connections: state.connections.map((conn) =>
                        conn.id === id ? { ...conn, ...updates } : conn
                    ),
                })),

            removeConnection: (id) =>
                set((state) => ({
                    connections: state.connections.filter((conn) => conn.id !== id),
                    activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
                })),

            setActiveConnection: (id) => set({ activeConnectionId: id }),

            setConnectionStatus: (id, status) =>
                set((state) => ({
                    connectionStatuses: {
                        ...state.connectionStatuses,
                        [id]: status,
                    },
                })),

            getActiveConnection: () => {
                const state = get();
                return state.connections.find((conn) => conn.id === state.activeConnectionId) || null;
            },
        }),
        {
            name: 'queryflux-connections',
            partialize: (state) => ({
                connections: state.connections,
                activeConnectionId: state.activeConnectionId,
            }),
        }
    )
);
