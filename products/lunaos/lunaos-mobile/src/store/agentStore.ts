/**
 * Agent catalog state — fetches and caches the 28 agent list.
 */

import { create } from 'zustand';
import { listAgents } from '../api/agents';
import { logger } from '../utils/logger';
import type { AgentListItem } from '../types/api';

interface AgentState {
  agents: AgentListItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string | null;
  fetchAgents: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setCategory: (cat: string | null) => void;
  filteredAgents: () => AgentListItem[];
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategory: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await listAgents();
      set({ agents: res.agents, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load agents';
      logger.error('AgentStore', msg);
      set({ error: msg, isLoading: false });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setCategory: (cat) => set({ selectedCategory: cat }),

  filteredAgents: () => {
    const { agents, searchQuery, selectedCategory } = get();
    let filtered = agents;

    if (selectedCategory) {
      filtered = filtered.filter((a) => a.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q),
      );
    }

    return filtered;
  },
}));
