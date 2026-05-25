import { create } from 'zustand';
import { type DashboardFilters, type DateRange } from '../types';

interface UiState {
    filters: DashboardFilters;
    dateRange: DateRange;
    refreshTrigger: number;

    // Actions
    setFilters: (filters: DashboardFilters) => void;
    setDateRange: (range: DateRange) => void;
    triggerRefresh: () => void;
    resetFilters: () => void;
}

const defaultFilters: DashboardFilters = {
    status: {
        passed: true,
        failed: true,
        pending: true,
    },
    environment: 'All Environments',
};

const defaultDateRange: DateRange = {
    from: null,
    to: null,
    label: 'Last 30 Days',
};

export const useUiStore = create<UiState>((set) => ({
    filters: defaultFilters,
    dateRange: defaultDateRange,
    refreshTrigger: 0,

    setFilters: (filters) => set({ filters }),

    setDateRange: (dateRange) => set({ dateRange }),

    triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),

    resetFilters: () => set({
        filters: defaultFilters,
        dateRange: defaultDateRange
    }),
}));
