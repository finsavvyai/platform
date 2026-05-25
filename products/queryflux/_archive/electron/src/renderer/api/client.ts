/**
 * API Client for Electron Renderer Process
 * Provides a convenient interface to interact with the backend APIs
 */

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterOptions {
  [key: string]: any;
}

/**
 * Base API Client
 */
export class APIClient {
  protected electronAPI: any;

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI;
    } else {
      throw new Error('Electron API not available');
    }
  }

  /**
   * Handle API responses consistently
   */
  protected async handleAPICall<T>(promise: Promise<any>): Promise<APIResponse<T>> {
    try {
      const result = await promise;
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unknown error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if backend API is healthy
   */
  async healthCheck(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.api.healthCheck());
  }
}

/**
 * Authentication API Client
 */
export class AuthAPI extends APIClient {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.auth.login({ email, password })
    );
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.auth.register({ email, password, name })
    );
  }

  /**
   * Logout current user
   */
  async logout(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.auth.logout());
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.auth.refreshToken());
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.auth.getCurrentUser());
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<APIResponse<boolean>> {
    return this.handleAPICall(this.electronAPI.auth.isAuthenticated());
  }
}

/**
 * Database Connections API Client
 */
export class ConnectionsAPI extends APIClient {
  /**
   * Get all connections
   */
  async getAll(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.connections.getAll());
  }

  /**
   * Get connection by ID
   */
  async getById(id: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.connections.getById(id));
  }

  /**
   * Create a new connection
   */
  async create(connectionData: any): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.connections.create(connectionData));
  }

  /**
   * Update an existing connection
   */
  async update(id: string, connectionData: any): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.connections.update(id, connectionData));
  }

  /**
   * Delete a connection
   */
  async delete(id: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.connections.delete(id));
  }

  /**
   * Test a connection
   */
  async test(connectionData: any): Promise<APIResponse<{ success: boolean; message: string; latency?: number }>> {
    return this.handleAPICall(this.electronAPI.connections.test(connectionData));
  }

  /**
   * Get database schema for a connection
   */
  async getSchema(id: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.connections.getSchema(id));
  }
}

/**
 * Query API Client
 */
export class QueryAPI extends APIClient {
  /**
   * Execute a query
   */
  async execute(connectionId: string, query: string, options?: any): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.query.execute(connectionId, query, options)
    );
  }

  /**
   * Get query history
   */
  async getHistory(connectionId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.query.getHistory(connectionId, options)
    );
  }

  /**
   * Save a query
   */
  async save(queryData: {
    connectionId: string;
    name: string;
    description?: string;
    query: string;
    parameters?: any[];
    tags?: string[];
  }): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.query.save(queryData));
  }

  /**
   * Get saved queries
   */
  async getSaved(connectionId?: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.query.getSaved(connectionId));
  }

  /**
   * Delete a saved query
   */
  async delete(queryId: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.query.delete(queryId));
  }
}

/**
 * Table Operations API Client
 */
export class TableAPI extends APIClient {
  /**
   * Get table data
   */
  async getData(connectionId: string, table: string, options?: {
    limit?: number;
    offset?: number;
    where?: string;
    orderBy?: string;
    columns?: string[];
  }): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.table.getData(connectionId, table, options)
    );
  }

  /**
   * Get table structure
   */
  async getStructure(connectionId: string, table: string): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.table.getStructure(connectionId, table)
    );
  }

  /**
   * Insert data into table
   */
  async insert(connectionId: string, table: string, data: any): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.table.insert(connectionId, table, data)
    );
  }

  /**
   * Update table data
   */
  async update(connectionId: string, table: string, data: any, where: string): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.table.update(connectionId, table, data, where)
    );
  }

  /**
   * Delete table data
   */
  async delete(connectionId: string, table: string, where: string): Promise<APIResponse> {
    return this.handleAPICall(
      this.electronAPI.table.delete(connectionId, table, where)
    );
  }
}

/**
 * Settings API Client
 */
export class SettingsAPI extends APIClient {
  /**
   * Get a setting value
   */
  async get(key: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.settings.get(key));
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: any): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.settings.set(key, value));
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.settings.getAll());
  }
}

/**
 * WebSocket API Client
 */
export class WebSocketAPI extends APIClient {
  /**
   * Connect to WebSocket
   */
  async connect(connectionId?: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.websocket.connect(connectionId));
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(connectionId?: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.websocket.disconnect(connectionId));
  }

  /**
   * Subscribe to an event
   */
  async subscribe(event: string, data?: any): Promise<APIResponse<string>> {
    return this.handleAPICall(this.electronAPI.websocket.subscribe(event, data));
  }

  /**
   * Unsubscribe from an event
   */
  async unsubscribe(event: string): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.websocket.unsubscribe(event));
  }
}

/**
 * Application API Client
 */
export class AppAPI extends APIClient {
  /**
   * Get application version
   */
  async getVersion(): Promise<APIResponse<string>> {
    return this.handleAPICall(this.electronAPI.app.version());
  }

  /**
   * Quit application
   */
  async quit(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.app.quit());
  }

  /**
   * Minimize window
   */
  async minimize(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.app.minimize());
  }

  /**
   * Maximize window
   */
  async maximize(): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.app.maximize());
  }

  /**
   * Show message box
   */
  async showMessageBox(options: any): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.app.showMessageBox(options));
  }

  /**
   * Show save dialog
   */
  async showSaveDialog(options: any): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.app.showSaveDialog(options));
  }

  /**
   * Show open dialog
   */
  async showOpenDialog(options: any): Promise<APIResponse> {
    return this.handleAPICall(this.electronAPI.app.showOpenDialog(options));
  }
}

/**
 * Unified API Client
 * Combines all API clients into a single interface
 */
export class QueryFluxAPI {
  public auth: AuthAPI;
  public connections: ConnectionsAPI;
  public query: QueryAPI;
  public table: TableAPI;
  public settings: SettingsAPI;
  public websocket: WebSocketAPI;
  public app: AppAPI;

  constructor() {
    this.auth = new AuthAPI();
    this.connections = new ConnectionsAPI();
    this.query = new QueryAPI();
    this.table = new TableAPI();
    this.settings = new SettingsAPI();
    this.websocket = new WebSocketAPI();
    this.app = new AppAPI();
  }

  /**
   * Initialize the API client (check health, etc.)
   */
  async initialize(): Promise<APIResponse> {
    // Check API health
    const healthResponse = await this.healthCheck();
    if (!healthResponse.success) {
      return healthResponse;
    }

    // Check authentication status
    const authResponse = await this.auth.isAuthenticated();
    if (authResponse.success && authResponse.data) {
      // User is authenticated, fetch user data
      await this.auth.getCurrentUser();
    }

    return {
      success: true,
      data: { initialized: true },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<APIResponse> {
    const client = new APIClient();
    return client.healthCheck();
  }

  /**
   * Event listener for real-time updates
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (...args: any[]) => void): void {
    if (window.electronAPI && window.electronAPI.off) {
      window.electronAPI.off(event, callback);
    }
  }

  /**
   * Remove all event listeners for an event
   */
  removeAllListeners(event: string): void {
    if (window.electronAPI && window.electronAPI.removeAllListeners) {
      window.electronAPI.removeAllListeners(event);
    }
  }
}

// Create singleton instance
export const apiClient = new QueryFluxAPI();

// Export the API client instance as default
export default apiClient;