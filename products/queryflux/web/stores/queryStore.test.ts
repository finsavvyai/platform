import { describe, it, expect, beforeEach } from 'vitest';
import { useQueryStore } from './queryStore';
import type { Query } from '../types/api';

const makeQuery = (overrides: Partial<Query> = {}): Query => ({
  id: 'query-1',
  name: 'Test Query',
  sql: 'SELECT * FROM users',
  connectionId: 'conn-1',
  description: 'A test query',
  tags: ['test'],
  ...overrides,
});

describe('queryStore', () => {
  beforeEach(() => {
    useQueryStore.setState({
      savedQueries: [],
      currentQuery: '',
      queryHistory: [],
      isExecuting: false,
      currentResult: null,
      currentError: null,
    });
  });

  describe('initial state', () => {
    it('should have an empty savedQueries array', () => {
      expect(useQueryStore.getState().savedQueries).toEqual([]);
    });

    it('should have an empty currentQuery string', () => {
      expect(useQueryStore.getState().currentQuery).toBe('');
    });

    it('should have an empty queryHistory array', () => {
      expect(useQueryStore.getState().queryHistory).toEqual([]);
    });

    it('should not be executing', () => {
      expect(useQueryStore.getState().isExecuting).toBe(false);
    });

    it('should have null currentResult', () => {
      expect(useQueryStore.getState().currentResult).toBeNull();
    });

    it('should have null currentError', () => {
      expect(useQueryStore.getState().currentError).toBeNull();
    });
  });

  describe('setSavedQueries', () => {
    it('should replace saved queries', () => {
      const queries = [makeQuery({ id: 'q1' }), makeQuery({ id: 'q2' })];

      useQueryStore.getState().setSavedQueries(queries);

      expect(useQueryStore.getState().savedQueries).toHaveLength(2);
      expect(useQueryStore.getState().savedQueries[0].id).toBe('q1');
    });

    it('should clear saved queries when given empty array', () => {
      useQueryStore.getState().setSavedQueries([makeQuery()]);
      useQueryStore.getState().setSavedQueries([]);

      expect(useQueryStore.getState().savedQueries).toEqual([]);
    });
  });

  describe('addSavedQuery', () => {
    it('should append a query to saved queries', () => {
      useQueryStore.getState().addSavedQuery(makeQuery({ id: 'q1' }));

      expect(useQueryStore.getState().savedQueries).toHaveLength(1);
      expect(useQueryStore.getState().savedQueries[0].id).toBe('q1');
    });

    it('should not remove existing queries', () => {
      useQueryStore.getState().addSavedQuery(makeQuery({ id: 'q1' }));
      useQueryStore.getState().addSavedQuery(makeQuery({ id: 'q2' }));

      expect(useQueryStore.getState().savedQueries).toHaveLength(2);
    });
  });

  describe('updateSavedQuery', () => {
    it('should update the matching query by id', () => {
      useQueryStore.getState().setSavedQueries([
        makeQuery({ id: 'q1', name: 'Old Name' }),
      ]);

      useQueryStore.getState().updateSavedQuery('q1', { name: 'New Name' });

      expect(useQueryStore.getState().savedQueries[0].name).toBe('New Name');
    });

    it('should not modify non-matching queries', () => {
      useQueryStore.getState().setSavedQueries([
        makeQuery({ id: 'q1', name: 'First' }),
        makeQuery({ id: 'q2', name: 'Second' }),
      ]);

      useQueryStore.getState().updateSavedQuery('q1', { name: 'Updated' });

      expect(useQueryStore.getState().savedQueries[1].name).toBe('Second');
    });

    it('should preserve other fields during partial update', () => {
      useQueryStore.getState().setSavedQueries([
        makeQuery({ id: 'q1', name: 'Name', sql: 'SELECT 1' }),
      ]);

      useQueryStore.getState().updateSavedQuery('q1', { sql: 'SELECT 2' });

      const q = useQueryStore.getState().savedQueries[0];
      expect(q.sql).toBe('SELECT 2');
      expect(q.name).toBe('Name');
    });
  });

  describe('removeSavedQuery', () => {
    it('should remove the matching query by id', () => {
      useQueryStore.getState().setSavedQueries([
        makeQuery({ id: 'q1' }),
        makeQuery({ id: 'q2' }),
      ]);

      useQueryStore.getState().removeSavedQuery('q1');

      const state = useQueryStore.getState();
      expect(state.savedQueries).toHaveLength(1);
      expect(state.savedQueries[0].id).toBe('q2');
    });

    it('should do nothing when removing a non-existent id', () => {
      useQueryStore.getState().setSavedQueries([makeQuery({ id: 'q1' })]);

      useQueryStore.getState().removeSavedQuery('non-existent');

      expect(useQueryStore.getState().savedQueries).toHaveLength(1);
    });
  });

  describe('setCurrentQuery', () => {
    it('should set the current query string', () => {
      useQueryStore.getState().setCurrentQuery('SELECT * FROM orders');

      expect(useQueryStore.getState().currentQuery).toBe('SELECT * FROM orders');
    });

    it('should allow setting to an empty string', () => {
      useQueryStore.getState().setCurrentQuery('SELECT 1');
      useQueryStore.getState().setCurrentQuery('');

      expect(useQueryStore.getState().currentQuery).toBe('');
    });
  });

});
