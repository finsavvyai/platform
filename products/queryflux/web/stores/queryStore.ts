import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Query, QueryResult } from '../types/api';

interface QueryHistoryItem {
    query: string;
    connectionId: string;
    result?: QueryResult;
    error?: string;
    timestamp: string;
}

interface QueryState {
    // State
    savedQueries: Query[];
    currentQuery: string;
    queryHistory: QueryHistoryItem[];
    isExecuting: boolean;
    currentResult: QueryResult | null;
    currentError: string | null;

    // Actions
    setSavedQueries: (queries: Query[]) => void;
    addSavedQuery: (query: Query) => void;
    updateSavedQuery: (id: string, query: Partial<Query>) => void;
    removeSavedQuery: (id: string) => void;
    setCurrentQuery: (query: string) => void;
    addToHistory: (item: QueryHistoryItem) => void;
    setIsExecuting: (isExecuting: boolean) => void;
    setCurrentResult: (result: QueryResult | null) => void;
    setCurrentError: (error: string | null) => void;
    clearCurrentResult: () => void;
}

export const useQueryStore = create<QueryState>()(
    persist(
        (set) => ({
            // Initial state
            savedQueries: [],
            currentQuery: '',
            queryHistory: [],
            isExecuting: false,
            currentResult: null,
            currentError: null,

            // Actions
            setSavedQueries: (queries) => set({ savedQueries: queries }),

            addSavedQuery: (query) =>
                set((state) => ({
                    savedQueries: [...state.savedQueries, query],
                })),

            updateSavedQuery: (id, updates) =>
                set((state) => ({
                    savedQueries: state.savedQueries.map((q) =>
                        q.id === id ? { ...q, ...updates } : q
                    ),
                })),

            removeSavedQuery: (id) =>
                set((state) => ({
                    savedQueries: state.savedQueries.filter((q) => q.id !== id),
                })),

            setCurrentQuery: (query) => set({ currentQuery: query }),

            addToHistory: (item) =>
                set((state) => ({
                    queryHistory: [item, ...state.queryHistory].slice(0, 100), // Keep last 100
                })),

            setIsExecuting: (isExecuting) => set({ isExecuting }),

            setCurrentResult: (result) => set({ currentResult: result, currentError: null }),

            setCurrentError: (error) => set({ currentError: error, currentResult: null }),

            clearCurrentResult: () => set({ currentResult: null, currentError: null }),
        }),
        {
            name: 'queryflux-queries',
            partialize: (state) => ({
                savedQueries: state.savedQueries,
                queryHistory: state.queryHistory.slice(0, 20), // Persist only last 20
            }),
        }
    )
);
