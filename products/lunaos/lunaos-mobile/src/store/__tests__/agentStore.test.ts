/**
 * Tests for agent Zustand store.
 * Validates fetch, filter, search, category selection.
 */

import { act } from '@testing-library/react-native';
import { useAgentStore } from '../agentStore';
import * as agentsApi from '../../api/agents';
import { mockAgents, mockAgentListResponse } from '../../test-utils/mocks/fixtures';

jest.mock('../../api/agents');
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockAgentsApi = agentsApi as jest.Mocked<typeof agentsApi>;

beforeEach(() => {
  useAgentStore.setState({
    agents: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    selectedCategory: null,
  });
  jest.clearAllMocks();
});

describe('useAgentStore', () => {
  describe('fetchAgents', () => {
    it('populates agents list on success', async () => {
      mockAgentsApi.listAgents.mockResolvedValue(mockAgentListResponse);

      await act(async () => {
        await useAgentStore.getState().fetchAgents();
      });

      expect(useAgentStore.getState().agents).toEqual(mockAgents);
      expect(useAgentStore.getState().isLoading).toBe(false);
      expect(useAgentStore.getState().error).toBeNull();
    });

    it('sets isLoading during fetch', async () => {
      let loadingDuringCall = false;
      mockAgentsApi.listAgents.mockImplementation(() => {
        loadingDuringCall = useAgentStore.getState().isLoading;
        return Promise.resolve(mockAgentListResponse);
      });

      await act(async () => {
        await useAgentStore.getState().fetchAgents();
      });

      expect(loadingDuringCall).toBe(true);
    });

    it('sets error on failure', async () => {
      mockAgentsApi.listAgents.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useAgentStore.getState().fetchAgents();
      });

      expect(useAgentStore.getState().error).toBe('Network error');
      expect(useAgentStore.getState().agents).toEqual([]);
    });
  });

  describe('setSearchQuery', () => {
    it('updates search query', () => {
      act(() => {
        useAgentStore.getState().setSearchQuery('debug');
      });
      expect(useAgentStore.getState().searchQuery).toBe('debug');
    });
  });

  describe('setCategory', () => {
    it('sets selected category', () => {
      act(() => {
        useAgentStore.getState().setCategory('devops');
      });
      expect(useAgentStore.getState().selectedCategory).toBe('devops');
    });

    it('clears category when null', () => {
      useAgentStore.setState({ selectedCategory: 'devops' });
      act(() => {
        useAgentStore.getState().setCategory(null);
      });
      expect(useAgentStore.getState().selectedCategory).toBeNull();
    });
  });

  describe('filteredAgents', () => {
    beforeEach(() => {
      useAgentStore.setState({ agents: mockAgents });
    });

    it('returns all agents when no filter applied', () => {
      const result = useAgentStore.getState().filteredAgents();
      expect(result).toHaveLength(mockAgents.length);
    });

    it('filters by category', () => {
      useAgentStore.setState({ selectedCategory: 'code-quality' });
      const result = useAgentStore.getState().filteredAgents();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('code-reviewer');
    });

    it('filters by search query (name match)', () => {
      useAgentStore.setState({ searchQuery: 'Debug' });
      const result = useAgentStore.getState().filteredAgents();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('debug-helper');
    });

    it('filters by search query (slug match)', () => {
      useAgentStore.setState({ searchQuery: 'sprint-planner' });
      const result = useAgentStore.getState().filteredAgents();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('sprint-planner');
    });

    it('combines category and search filters', () => {
      useAgentStore.setState({
        selectedCategory: 'testing',
        searchQuery: 'writer',
      });
      const result = useAgentStore.getState().filteredAgents();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('test-writer');
    });

    it('returns empty when no match', () => {
      useAgentStore.setState({ searchQuery: 'nonexistent' });
      const result = useAgentStore.getState().filteredAgents();
      expect(result).toHaveLength(0);
    });
  });
});
