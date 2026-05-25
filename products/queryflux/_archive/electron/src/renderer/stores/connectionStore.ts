import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ConnectionSlice, DatabaseConnection, ActiveConnection } from './types';

export const useConnectionStore = create<ConnectionSlice>()(
  persist(
    (set, get) => ({
      // Initial state
      connections: [],
      activeConnections: [],
      selectedConnectionId: null,

      // Actions
      addConnection: (connection: DatabaseConnection) =>
        set((state) => ({
          connections: [...state.connections, connection]
        })),

      updateConnection: (id: string, updates: Partial<DatabaseConnection>) =>
        set((state) => ({
          connections: state.connections.map(conn =>
            conn.id === id ? { ...conn, ...updates, updatedAt: Date.now() } : conn
          )
        })),

      removeConnection: (id: string) =>
        set((state) => ({
          connections: state.connections.filter(conn => conn.id !== id),
          activeConnections: state.activeConnections.filter(active => active.connectionId !== id),
          selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId
        })),

      setActiveConnection: (connectionId: string, active: boolean) =>
        set((state) => {
          if (active) {
            const newActiveConnection: ActiveConnection = {
              id: `active-${connectionId}-${Date.now()}`,
              connectionId,
              status: 'connected',
              connectedAt: Date.now(),
              lastActivity: Date.now(),
            };
            return {
              activeConnections: [...state.activeConnections.filter(ac => ac.connectionId !== connectionId), newActiveConnection]
            };
          } else {
            return {
              activeConnections: state.activeConnections.filter(ac => ac.connectionId !== connectionId)
            };
          }
        }),

      setSelectedConnection: (connectionId: string | null) => set({ selectedConnectionId: connectionId }),

      connectToDatabase: async (connectionId: string) => {
        const state = get();
        const connection = state.connections.find(conn => conn.id === connectionId);

        if (!connection) {
          throw new Error(`Connection ${connectionId} not found`);
        }

        try {
          // Set connection status to connecting
          set((prevState) => ({
            activeConnections: prevState.activeConnections.map(ac =>
              ac.connectionId === connectionId
                ? { ...ac, status: 'connecting', lastActivity: Date.now() }
                : ac
            )
          }));

          // Simulate connection logic (in real app, this would use Electron API)
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Update connection status to connected
          set((prevState) => ({
            activeConnections: prevState.activeConnections.map(ac =>
              ac.connectionId === connectionId
                ? { ...ac, status: 'connected', connectedAt: Date.now(), lastActivity: Date.now() }
                : ac
            ),
            connections: prevState.connections.map(conn =>
              conn.id === connectionId
                ? { ...conn, lastUsed: Date.now(), updatedAt: Date.now() }
                : conn
            )
          }));

          // Select the connection if none is selected
          if (!state.selectedConnectionId) {
            set({ selectedConnectionId: connectionId });
          }

        } catch (error) {
          // Update connection status to error
          set((prevState) => ({
            activeConnections: prevState.activeConnections.map(ac =>
              ac.connectionId === connectionId
                ? {
                    ...ac,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Connection failed',
                    lastActivity: Date.now()
                  }
                : ac
            )
          }));
          throw error;
        }
      },

      disconnectFromDatabase: async (connectionId: string) => {
        try {
          // Simulate disconnection logic (in real app, this would use Electron API)
          await new Promise(resolve => setTimeout(resolve, 500));

          // Remove active connection
          set((prevState) => ({
            activeConnections: prevState.activeConnections.filter(ac => ac.connectionId !== connectionId),
            selectedConnectionId: prevState.selectedConnectionId === connectionId ? null : prevState.selectedConnectionId
          }));

        } catch (error) {
          console.error('Failed to disconnect:', error);
          throw error;
        }
      },
    }),
    {
      name: 'queryflux-connection-store',
      partialize: (state) => ({
        connections: state.connections,
        selectedConnectionId: state.selectedConnectionId,
      }),
    }
  )
);