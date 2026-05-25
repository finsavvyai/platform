import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

export interface APIConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: string;
  services: {
    database: string;
    redis: string;
    websocket: string;
  };
}

export class APIManager extends EventEmitter {
  private client: AxiosInstance;
  private config: APIConfig;
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private isRefreshing = false;

  constructor(config?: Partial<APIConfig>) {
    super();

    this.config = {
      baseURL: process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080/api/v1'
        : 'https://api.queryflux.com/api/v1',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `QueryFlux-Desktop/${process.env.npm_package_version || '1.0.0'}`,
      },
    });

    this.setupInterceptors();
    this.loadStoredTokens();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.tokens) {
          config.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle auth errors and retries
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 unauthorized - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshToken();
            return this.client(originalRequest);
          } catch (refreshError) {
            this.emit('auth:expired');
            return Promise.reject(refreshError);
          }
        }

        // Handle network errors with retry logic
        if (!error.response && this.config.retryAttempts > 0) {
          return this.retryRequest(originalRequest);
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private async retryRequest(request: AxiosRequestConfig, attempt = 1): Promise<AxiosResponse> {
    if (attempt > this.config.retryAttempts) {
      throw new Error('Maximum retry attempts exceeded');
    }

    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));

    try {
      return await this.client(request);
    } catch (error) {
      return this.retryRequest(request, attempt + 1);
    }
  }

  private normalizeError(error: any): APIError {
    if (error.response) {
      // Server responded with error status
      return {
        code: error.response.data?.code || 'SERVER_ERROR',
        message: error.response.data?.message || error.message,
        details: error.response.data?.details,
        timestamp: new Date().toISOString(),
      };
    } else if (error.request) {
      // Network error
      return {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your internet connection.',
        details: error.message,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Request configuration error
      return {
        code: 'REQUEST_ERROR',
        message: error.message || 'An unknown error occurred',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadStoredTokens() {
    try {
      const stored = localStorage.getItem('queryflux_auth_tokens');
      if (stored) {
        this.tokens = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
    }
  }

  private storeTokens(tokens: AuthTokens) {
    try {
      localStorage.setItem('queryflux_auth_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }

  private async refreshToken(): Promise<AuthTokens> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const tokens = await this.refreshPromise;
      this.tokens = tokens;
      this.storeTokens(tokens);
      this.emit('auth:refreshed', tokens);
      return tokens;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(`${this.config.baseURL}/auth/refresh`, {
      refresh_token: this.tokens.refreshToken,
    });

    return response.data;
  }

  // Public API methods

  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async login(credentials: { email: string; password: string }): Promise<AuthTokens> {
    try {
      const response = await this.client.post('/auth/login', credentials);
      const tokens = response.data;
      this.tokens = tokens;
      this.storeTokens(tokens);
      this.emit('auth:login', tokens);
      return tokens;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.tokens) {
        await this.client.post('/auth/logout', {
          refresh_token: this.tokens.refreshToken,
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.tokens = null;
      localStorage.removeItem('queryflux_auth_tokens');
      this.emit('auth:logout');
    }
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthTokens> {
    try {
      const response = await this.client.post('/auth/register', userData);
      const tokens = response.data;
      this.tokens = tokens;
      this.storeTokens(tokens);
      this.emit('auth:register', tokens);
      return tokens;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      const response = await this.client.get('/auth/me');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  isAuthenticated(): boolean {
    return !!this.tokens && !this.isTokenExpired();
  }

  private isTokenExpired(): boolean {
    if (!this.tokens) return true;

    const expirationTime = Date.now() + (this.tokens.expiresIn * 1000);
    return Date.now() >= expirationTime;
  }

  // Generic API request method
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  // RESTful API methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request({ ...config, method: 'PUT', url, data });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request({ ...config, method: 'PATCH', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request({ ...config, method: 'DELETE', url });
  }

  // Update configuration
  updateConfig(newConfig: Partial<APIConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.client.defaults.baseURL = this.config.baseURL;
    this.client.defaults.timeout = this.config.timeout;
  }

  // Get current tokens
  getTokens(): AuthTokens | null {
    return this.tokens;
  }

  // Set tokens manually (useful for testing)
  setTokens(tokens: AuthTokens) {
    this.tokens = tokens;
    this.storeTokens(tokens);
    this.emit('auth:tokens-updated', tokens);
  }
}

// Create singleton instance
export const apiManager = new APIManager();