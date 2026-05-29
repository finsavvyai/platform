import { describe, it, expect, beforeEach } from 'vitest';
import { useQueryStore } from './queryStore';
import type { QueryResult } from '../types/api';

const makeResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  columns: ['id', 'name'],
  rows: [{ id: 1, name: 'Alice' }],
  rowCount: 1,
  executionTime: 42,
  ...overrides,
});

const makeHistoryItem = (overrides = {}) => ({
  query: 'SELECT 1',
  connectionId: 'conn-1',
  timestamp: '2026-02-28T00:00:00Z',
  ...overrides,
});

describe('queryStore - execution & history', () => {
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

  describe('addToHistory', () => {
    it('should prepend item to the history', () => {
      const item1 = makeHistoryItem({ query: 'SELECT 1', timestamp: 'T1' });
      const item2 = makeHistoryItem({ query: 'SELECT 2', timestamp: 'T2' });
      useQueryStore.getState().addToHistory(item1);
      useQueryStore.getState().addToHistory(item2);
      const history = useQueryStore.getState().queryHistory;
      expect(history[0].query).toBe('SELECT 2');
      expect(history[1].query).toBe('SELECT 1');
    });

    it('should truncate history to 100 items', () => {
      const items = Array.from({ length: 100 }, (_, i) =>
        makeHistoryItem({ query: `SELECT ${i}`, timestamp: `T${i}` })
      );
      useQueryStore.setState({ queryHistory: items });
      useQueryStore.getState().addToHistory(
        makeHistoryItem({ query: 'SELECT latest', timestamp: 'T-latest' })
      );
      const history = useQueryStore.getState().queryHistory;
      expect(history).toHaveLength(100);
      expect(history[0].query).toBe('SELECT latest');
      expect(history[99].query).toBe('SELECT 98');
    });

    it('should not exceed 100 items when adding many', () => {
      for (let i = 0; i < 105; i++) {
        useQueryStore.getState().addToHistory(makeHistoryItem({ query: `SELECT ${i}` }));
      }
      expect(useQueryStore.getState().queryHistory.length).toBeLessThanOrEqual(100);
    });
  });

  describe('setIsExecuting', () => {
    it('should set isExecuting to true', () => {
      useQueryStore.getState().setIsExecuting(true);
      expect(useQueryStore.getState().isExecuting).toBe(true);
    });

    it('should set isExecuting to false', () => {
      useQueryStore.getState().setIsExecuting(true);
      useQueryStore.getState().setIsExecuting(false);
      expect(useQueryStore.getState().isExecuting).toBe(false);
    });
  });

  describe('setCurrentResult', () => {
    it('should set the current result', () => {
      const result = makeResult();
      useQueryStore.getState().setCurrentResult(result);
      expect(useQueryStore.getState().currentResult).toEqual(result);
    });

    it('should clear currentError when setting a result', () => {
      useQueryStore.getState().setCurrentError('Some error');
      useQueryStore.getState().setCurrentResult(makeResult());
      expect(useQueryStore.getState().currentError).toBeNull();
    });

    it('should allow setting result to null', () => {
      useQueryStore.getState().setCurrentResult(makeResult());
      useQueryStore.getState().setCurrentResult(null);
      expect(useQueryStore.getState().currentResult).toBeNull();
    });
  });

  describe('setCurrentError', () => {
    it('should set the current error', () => {
      useQueryStore.getState().setCurrentError('Query failed');
      expect(useQueryStore.getState().currentError).toBe('Query failed');
    });

    it('should clear currentResult when setting an error', () => {
      useQueryStore.getState().setCurrentResult(makeResult());
      useQueryStore.getState().setCurrentError('Timeout');
      expect(useQueryStore.getState().currentResult).toBeNull();
    });

    it('should allow setting error to null', () => {
      useQueryStore.getState().setCurrentError('error');
      useQueryStore.getState().setCurrentError(null);
      expect(useQueryStore.getState().currentError).toBeNull();
    });
  });

  describe('clearCurrentResult', () => {
    it('should clear both currentResult and currentError', () => {
      useQueryStore.getState().setCurrentResult(makeResult());
      useQueryStore.getState().clearCurrentResult();
      const state = useQueryStore.getState();
      expect(state.currentResult).toBeNull();
      expect(state.currentError).toBeNull();
    });

    it('should clear error when only error is set', () => {
      useQueryStore.getState().setCurrentError('error');
      useQueryStore.getState().clearCurrentResult();
      const state = useQueryStore.getState();
      expect(state.currentResult).toBeNull();
      expect(state.currentError).toBeNull();
    });

    it('should be safe to call when both are already null', () => {
      useQueryStore.getState().clearCurrentResult();
      const state = useQueryStore.getState();
      expect(state.currentResult).toBeNull();
      expect(state.currentError).toBeNull();
    });
  });
});
