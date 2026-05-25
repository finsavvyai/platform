import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface for type safety
export interface ElectronAPI {
  // Secure storage
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };

  // Application
  app: {
    version: () => Promise<string>;
    quit: () => Promise<void>;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
    showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  };

  // Settings
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<any>;
  };

  // Authentication
  auth: {
    login: (credentials: { email: string; password: string }) => Promise<any>;
    logout: () => Promise<void>;
    register: (userData: { email: string; password: string; name: string }) => Promise<any>;
    refreshToken: () => Promise<any>;
    getCurrentUser: () => Promise<any>;
    isAuthenticated: () => Promise<boolean>;
  };

  // Connection management
  connections: {
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any>;
    create: (connectionData: any) => Promise<any>;
    update: (id: string, connectionData: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    test: (connectionData: any) => Promise<{ success: boolean; message: string; latency?: number }>;
    getSchema: (id: string) => Promise<any>;
  };

  // Query operations
  query: {
    execute: (connectionId: string, query: string, options?: any) => Promise<any>;
    getHistory: (connectionId: string, options?: any) => Promise<any[]>;
    save: (queryData: any) => Promise<any>;
    getSaved: (connectionId?: string) => Promise<any[]>;
    delete: (queryId: string) => Promise<void>;
  };

  // Table operations
  table: {
    getData: (connectionId: string, table: string, options?: any) => Promise<any>;
    getStructure: (connectionId: string, table: string) => Promise<any>;
    insert: (connectionId: string, table: string, data: any) => Promise<any>;
    update: (connectionId: string, table: string, data: any, where: string) => Promise<any>;
    delete: (connectionId: string, table: string, where: string) => Promise<any>;
  };

  // WebSocket for real-time updates
  websocket: {
    connect: (connectionId?: string) => Promise<void>;
    disconnect: (connectionId?: string) => Promise<void>;
    subscribe: (event: string, data?: any) => Promise<string>;
    unsubscribe: (event: string) => Promise<void>;
  };

  // API health check
  api: {
    healthCheck: () => Promise<any>;
  };

  // Database operations (legacy compatibility)
  database: {
    connect: (config: DatabaseConfig) => Promise<DatabaseConnectionResult>;
    disconnect: (connectionId: string) => Promise<{ success: boolean }>;
    executeQuery: (params: { connectionId: string; query: string; params?: any[] }) => Promise<QueryResult>;
    getSchema: (connectionId: string) => Promise<DatabaseSchema>;
    getTables: (connectionId: string) => Promise<TableInfo[]>;
    getColumns: (connectionId: string, table: string) => Promise<ColumnInfo[]>;
  };

  // AI services
  ai: {
    convertNLToSQL: (params: { naturalLanguage: string; schema?: DatabaseSchema }) => Promise<string>;
    optimizeQuery: (params: { query: string; schema?: DatabaseSchema }) => Promise<string>;
    explainQuery: (params: { query: string; schema?: DatabaseSchema }) => Promise<string>;
    generateSQL: (params: { requirement: string; schema?: DatabaseSchema }) => Promise<string>;
  };

  // Events
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Database types
export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'sqlserver' | 'oracle' | 'cassandra';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  options?: Record<string, any>;
}

export interface DatabaseConnectionResult {
  success: boolean;
  connectionId: string;
  message?: string;
}

export interface QueryResult {
  success: boolean;
  data?: {
    columns: string[];
    rows: any[][];
    rowCount: number;
  };
  error?: string;
  executionTime?: number;
}

export interface DatabaseSchema {
  name: string;
  tables: TableInfo[];
  views: ViewInfo[];
  functions: FunctionInfo[];
}

export interface TableInfo {
  name: string;
  schema: string;
  type: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface ViewInfo {
  name: string;
  schema: string;
  definition: string;
}

export interface FunctionInfo {
  name: string;
  schema: string;
  language: string;
  returnType: string;
  parameters: ParameterInfo[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  mode: 'IN' | 'OUT' | 'INOUT';
}

// Expose the API to the renderer process
const electronAPI: ElectronAPI = {
  // Secure storage
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },

  // Application
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.invoke('app:quit'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    maximize: () => ipcRenderer.invoke('app:maximize'),
    showMessageBox: (options) => ipcRenderer.invoke('app:showMessageBox', options),
    showSaveDialog: (options) => ipcRenderer.invoke('app:showSaveDialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('app:showOpenDialog', options)
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Authentication
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
    register: (userData) => ipcRenderer.invoke('auth:register', userData),
    refreshToken: () => ipcRenderer.invoke('auth:refreshToken'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated')
  },

  // Connection management
  connections: {
    getAll: () => ipcRenderer.invoke('connections:getAll'),
    getById: (id: string) => ipcRenderer.invoke('connections:getById', id),
    create: (connectionData) => ipcRenderer.invoke('connections:create', connectionData),
    update: (id: string, connectionData) => ipcRenderer.invoke('connections:update', id, connectionData),
    delete: (id: string) => ipcRenderer.invoke('connections:delete', id),
    test: (connectionData) => ipcRenderer.invoke('connections:test', connectionData),
    getSchema: (id: string) => ipcRenderer.invoke('connections:getSchema', id)
  },

  // Query operations
  query: {
    execute: (connectionId: string, query: string, options?: any) =>
      ipcRenderer.invoke('query:execute', connectionId, query, options),
    getHistory: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('query:getHistory', connectionId, options),
    save: (queryData) => ipcRenderer.invoke('query:save', queryData),
    getSaved: (connectionId?: string) => ipcRenderer.invoke('query:getSaved', connectionId),
    delete: (queryId: string) => ipcRenderer.invoke('query:delete', queryId)
  },

  // Table operations
  table: {
    getData: (connectionId: string, table: string, options?: any) =>
      ipcRenderer.invoke('table:getData', connectionId, table, options),
    getStructure: (connectionId: string, table: string) =>
      ipcRenderer.invoke('table:getStructure', connectionId, table),
    insert: (connectionId: string, table: string, data: any) =>
      ipcRenderer.invoke('table:insert', connectionId, table, data),
    update: (connectionId: string, table: string, data: any, where: string) =>
      ipcRenderer.invoke('table:update', connectionId, table, data, where),
    delete: (connectionId: string, table: string, where: string) =>
      ipcRenderer.invoke('table:delete', connectionId, table, where)
  },

  // WebSocket for real-time updates
  websocket: {
    connect: (connectionId?: string) => ipcRenderer.invoke('websocket:connect', connectionId),
    disconnect: (connectionId?: string) => ipcRenderer.invoke('websocket:disconnect', connectionId),
    subscribe: (event: string, data?: any) => ipcRenderer.invoke('websocket:subscribe', event, data),
    unsubscribe: (event: string) => ipcRenderer.invoke('websocket:unsubscribe', event)
  },

  // API health check
  api: {
    healthCheck: () => ipcRenderer.invoke('api:healthCheck')
  },

  // Database operations (legacy compatibility)
  database: {
    connect: (config: DatabaseConfig) => ipcRenderer.invoke('db:connect', config),
    disconnect: (connectionId: string) => ipcRenderer.invoke('db:disconnect', connectionId),
    executeQuery: (params: { connectionId: string; query: string; params?: any[] }) =>
      ipcRenderer.invoke('db:executeQuery', params),
    getSchema: (connectionId: string) => ipcRenderer.invoke('db:getSchema', connectionId),
    getTables: (connectionId: string) => ipcRenderer.invoke('db:getTables', connectionId),
    getColumns: (connectionId: string, table: string) =>
      ipcRenderer.invoke('db:getColumns', { connectionId, table })
  },

  // AI services
  ai: {
    convertNLToSQL: (params: { naturalLanguage: string; schema?: DatabaseSchema }) =>
      ipcRenderer.invoke('ai:convertNLToSQL', params),
    optimizeQuery: (params: { query: string; schema?: DatabaseSchema }) =>
      ipcRenderer.invoke('ai:optimizeQuery', params),
    explainQuery: (params: { query: string; schema?: DatabaseSchema }) =>
      ipcRenderer.invoke('ai:explainQuery', params),
    generateSQL: (params: { requirement: string; schema?: DatabaseSchema }) =>
      ipcRenderer.invoke('ai:generateSQL', params)
  },

  // Events
  on: (channel: string, callback: (...args: any[]) => void) => {
    // Validate channel to prevent security issues
    const validChannels = [
      'menu:new-connection',
      'menu:open-sql-file',
      'menu:save-query',
      'menu:export-results',
      'menu:execute-query',
      'menu:explain-query',
      'menu:refresh-schema',
      'menu:preferences',
      'menu:shortcuts',
      'database:connected',
      'database:disconnected',
      'query:progress',
      'query:completed',
      'query:error',
      'websocket:connected',
      'websocket:disconnected',
      'auth:login-success',
      'auth:logout-success',
      'connection:created',
      'connection:updated',
      'connection:deleted',
      'metrics:update',
      'notification:received',
      'collaboration:event',
      'deep-link'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.off(channel, callback);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the global window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}