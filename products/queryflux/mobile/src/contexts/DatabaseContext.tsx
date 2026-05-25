/**
 * Database context for managing database connections and operations
 */

import React, {createContext, useContext, useReducer, useCallback} from 'react';
import {showMessage} from 'react-native-flash-message';

import {ApiService} from '../services/ApiService';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  host: string;
  port: number;
  database?: string;
  username?: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastConnected?: string;
  metrics?: {
    cpu: number;
    memory: number;
    connections: number;
    queries: number;
  };
}

export interface QueryResult {
  id: string;
  query: string;
  connectionId: string;
  result: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
  timestamp: string;
  error?: string;
}

interface DatabaseState {
  connections: DatabaseConnection[];
  queryHistory: QueryResult[];
  isLoading: boolean;
  error: string | null;
}

type DatabaseAction =
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_ERROR'; payload: string | null}
  | {type: 'SET_CONNECTIONS'; payload: DatabaseConnection[]}
  | {type: 'UPDATE_CONNECTION'; payload: DatabaseConnection}
  | {type: 'ADD_QUERY_RESULT'; payload: QueryResult}
  | {type: 'SET_QUERY_HISTORY'; payload: QueryResult[]};

interface DatabaseContextType extends DatabaseState {
  fetchConnections: () => Promise<void>;
  refreshConnection: (connectionId: string) => Promise<void>;
  executeQuery: (connectionId: string, query: string) => Promise<QueryResult | null>;
  getQueryHistory: () => Promise<void>;
  clearQueryHistory: () => void;
}

const initialState: DatabaseState = {
  connections: [],
  queryHistory: [],
  isLoading: false,
  error: null,
};

const databaseReducer = (state: DatabaseState, action: DatabaseAction): DatabaseState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {...state, isLoading: action.payload};
    case 'SET_ERROR':
      return {...state, error: action.payload, isLoading: false};
    case 'SET_CONNECTIONS':
      return {...state, connections: action.payload, isLoading: false, error: null};
    case 'UPDATE_CONNECTION':
      return {
        ...state,
        connections: state.connections.map(conn =>
          conn.id === action.payload.id ? action.payload : conn
        ),
      };
    case 'ADD_QUERY_RESULT':
      return {
        ...state,
        queryHistory: [action.payload, ...state.queryHistory.slice(0, 49)], // Keep last 50
      };
    case 'SET_QUERY_HISTORY':
      return {...state, queryHistory: action.payload};
    default:
      return state;
  }
};

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, dispatch] = useReducer(databaseReducer, initialState);

  const fetchConnections = useCallback(async () => {
    dispatch({type: 'SET_LOADING', payload: true});

    try {
      const response = await ApiService.get('/connections');
      dispatch({type: 'SET_CONNECTIONS', payload: response.data});
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch connections';
      dispatch({type: 'SET_ERROR', payload: errorMessage});
      
      showMessage({
        message: 'Connection Error',
        description: errorMessage,
        type: 'danger',
      });
    }
  }, []);

  const refreshConnection = useCallback(async (connectionId: string) => {
    try {
      const response = await ApiService.get(`/connections/${connectionId}/status`);
      dispatch({type: 'UPDATE_CONNECTION', payload: response.data});
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to refresh connection';
      
      showMessage({
        message: 'Refresh Error',
        description: errorMessage,
        type: 'warning',
      });
    }
  }, []);

  const executeQuery = useCallback(async (connectionId: string, query: string): Promise<QueryResult | null> => {
    try {
      const response = await ApiService.post(`/connections/${connectionId}/query`, {
        sql: query,
      });

      const queryResult: QueryResult = {
        id: Date.now().toString(),
        query,
        connectionId,
        result: response.data.data || [],
        columns: response.data.columns || [],
        rowCount: response.data.rowCount || 0,
        executionTime: response.data.executionTime || 0,
        timestamp: new Date().toISOString(),
      };

      dispatch({type: 'ADD_QUERY_RESULT', payload: queryResult});

      showMessage({
        message: 'Query Executed',
        description: `Returned ${queryResult.rowCount} rows in ${queryResult.executionTime}ms`,
        type: 'success',
      });

      return queryResult;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Query execution failed';
      
      const queryResult: QueryResult = {
        id: Date.now().toString(),
        query,
        connectionId,
        result: [],
        columns: [],
        rowCount: 0,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };

      dispatch({type: 'ADD_QUERY_RESULT', payload: queryResult});

      showMessage({
        message: 'Query Error',
        description: errorMessage,
        type: 'danger',
      });

      return null;
    }
  }, []);

  const getQueryHistory = useCallback(async () => {
    try {
      const response = await ApiService.get('/query-history');
      dispatch({type: 'SET_QUERY_HISTORY', payload: response.data});
    } catch (error: any) {
      console.warn('Failed to fetch query history:', error);
    }
  }, []);

  const clearQueryHistory = useCallback(() => {
    dispatch({type: 'SET_QUERY_HISTORY', payload: []});
  }, []);

  const contextValue: DatabaseContextType = {
    ...state,
    fetchConnections,
    refreshConnection,
    executeQuery,
    getQueryHistory,
    clearQueryHistory,
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = (): DatabaseContextType => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};