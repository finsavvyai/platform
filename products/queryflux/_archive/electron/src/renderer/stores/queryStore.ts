import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QuerySlice, Query, QueryHistory } from './types';

export const useQueryStore = create<QuerySlice>()(
  persist(
    (set, get) => ({
      // Initial state
      queries: [],
      currentQuery: '',
      queryHistory: [],

      // Actions
      setCurrentQuery: (query: string) => set({ currentQuery: query }),

      addQuery: (query: Query) =>
        set((state) => ({
          queries: [...state.queries, query]
        })),

      updateQuery: (id: string, updates: Partial<Query>) =>
        set((state) => ({
          queries: state.queries.map(q =>
            q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
          )
        })),

      removeQuery: (id: string) =>
        set((state) => ({
          queries: state.queries.filter(q => q.id !== id)
        })),

      addToHistory: (history: QueryHistory) =>
        set((state) => ({
          queryHistory: [history, ...state.queryHistory].slice(0, 1000) // Keep last 1000 queries
        })),

      clearHistory: (connectionId?: string) =>
        set((state) => ({
          queryHistory: connectionId
            ? state.queryHistory.filter(h => h.connectionId !== connectionId)
            : []
        })),
    }),
    {
      name: 'queryflux-query-store',
      partialize: (state) => ({
        queries: state.queries,
        queryHistory: state.queryHistory.slice(0, 100), // Only persist last 100 history items
      }),
    }
  )
);