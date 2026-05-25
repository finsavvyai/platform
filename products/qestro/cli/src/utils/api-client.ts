/**
 * Professional API Client for Questro CLI
 * Provides robust HTTP client with authentication, retries, and comprehensive error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from './config';
import { logger } from './logger';
import { handleError, ErrorCode } from './error-handler';
import { EventEmitter } from 'events';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiRequestOptions extends AxiosRequestConfig {
  retries?: number;
  retryDelay?: number;
  authRequired?: boolean;
  silent?: boolean;
}

export interface PaginatedRequestOptions extends ApiRequestOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export class ApiClient extends EventEmitter {
  private axiosInstance: AxiosInstance;
  private defaultRetries: number = 3;
  private defaultRetryDelay: number = 1000;
  private rateLimitResetTime: number = 0;
  private isRateLimited: boolean = false;

  constructor() {
    super();

    this.axiosInstance = axios.create({
      baseURL: config.getApiUrl(),
      timeout: config.getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `qestro-cli/${process.env.npm_package_version || '1.0.0'}`,
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.metadata = { requestId, startTime: Date.now() };

        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          requestId,
          headers: this.sanitizeHeaders(config.headers),
          params: config.params,
          data: this.sanitizeData(config.data),
        });

        this.emit('request', config);
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        const requestId = response.config.metadata?.requestId;

        logger.debug(`API Response: ${response.status} ${response.statusText}`, {
          requestId,
          duration: `${duration}ms`,
          headers: this.sanitizeHeaders(response.headers),
        });

        this.emit('response', response);
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        const requestId = originalRequest?.metadata?.requestId;

        logger.debug(`API Error: ${error.response?.status} ${error.response?.statusText}`, {
          requestId,
          message: error.message,
          code: error.code,
        });

        // Handle rate limiting
        if (error.response?.status === 429) {
          return this.handleRateLimit(error, originalRequest);
        }

        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          return this.handleTokenRefresh(originalRequest);
        }

        this.emit('error', error);
        return Promise.reject(error);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    delete sanitized.Authorization;
    delete sanitized.authorization;
    return sanitized;
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    // Remove sensitive fields from logs
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    const removeSensitive = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(removeSensitive);
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = removeSensitive(value);
          }
        }
        return result;
      }

      return obj;
    };

    return removeSensitive(sanitized);
  }

  private async handleRateLimit(error: any, originalRequest: any): Promise<any> {
    const retryAfter = error.response.headers['retry-after'] || 60;
    const resetTime = Date.now() + (retryAfter * 1000);

    if (this.isRateLimited && resetTime <= this.rateLimitResetTime) {
      // Already waiting for rate limit to reset
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.axiosInstance(originalRequest));
        }, this.rateLimitResetTime - Date.now());
      });
    }

    this.isRateLimited = true;
    this.rateLimitResetTime = resetTime;

    logger.warn(`Rate limited. Waiting ${retryAfter} seconds...`);

    this.emit('rateLimited', { retryAfter, resetTime });

    return new Promise((resolve) => {
      setTimeout(() => {
        this.isRateLimited = false;
        resolve(this.axiosInstance(originalRequest));
      }, retryAfter * 1000);
    });
  }

  private async handleTokenRefresh(originalRequest: any): Promise<any> {
    originalRequest._retry = true;

    try {
      const refreshToken = config.get('auth.refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      logger.debug('Attempting token refresh...');

      const response = await axios.post(`${config.getApiUrl()}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data.data;

      config.setAuthToken(accessToken, newRefreshToken, expiresIn);

      // Update original request with new token
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      logger.debug('Token refreshed successfully');
      this.emit('tokenRefreshed', { accessToken, refreshToken: newRefreshToken });

      return this.axiosInstance(originalRequest);
    } catch (refreshError) {
      logger.error('Token refresh failed:', refreshError);

      // Clear invalid tokens
      config.clearAuth();

      this.emit('tokenRefreshFailed', refreshError);
      throw refreshError;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest<T = any>(
    config: ApiRequestOptions
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    const {
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      authRequired = true,
      silent = false,
      ...axiosConfig
    } = config;

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const requestConfig: AxiosRequestConfig = {
          ...axiosConfig,
          headers: {
            ...axiosConfig.headers,
            ...(authRequired && config.getAuthHeaders()),
          },
        };

        const response = await this.axiosInstance.request<ApiResponse<T>>(requestConfig);

        // Check for API-level errors
        if (response.data && response.data.success === false) {
          throw new Error(response.data.message || response.data.error || 'API returned error');
        }

        return response;
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (
          error.response?.status === 401 ||
          error.response?.status === 403 ||
          error.response?.status === 404 ||
          error.code === 'ECONNABORTED' ||
          attempt === retries
        ) {
          break;
        }

        if (!silent && attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          logger.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  // HTTP Methods
  async get<T = any>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const response = await this.makeRequest<T>({ ...options, method: 'GET', url });
    return response.data;
  }

  async post<T = any>(url: string, data?: any, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const response = await this.makeRequest<T>({ ...options, method: 'POST', url, data });
    return response.data;
  }

  async put<T = any>(url: string, data?: any, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const response = await this.makeRequest<T>({ ...options, method: 'PUT', url, data });
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const response = await this.makeRequest<T>({ ...options, method: 'PATCH', url, data });
    return response.data;
  }

  async delete<T = any>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const response = await this.makeRequest<T>({ ...options, method: 'DELETE', url });
    return response.data;
  }

  // Paginated requests
  async getPaginated<T = any>(
    url: string,
    options: PaginatedRequestOptions = {}
  ): Promise<ApiResponse<T[]>> {
    const { page = 1, limit = 25, sort, order, ...requestOptions } = options;

    const params = {
      page,
      limit,
      ...(sort && { sort }),
      ...(order && { order }),
      ...requestOptions.params,
    };

    const response = await this.get<T[]>(url, { ...requestOptions, params });
    return response;
  }

  // File upload
  async upload<T = any>(
    url: string,
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
    contentType: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const FormData = require('form-data');
    const form = new FormData();

    form.append('file', file, {
      filename,
      contentType,
    });

    // Add additional form data if provided
    if (options.data) {
      Object.entries(options.data).forEach(([key, value]) => {
        form.append(key, value);
      });
    }

    const response = await this.makeRequest<T>({
      ...options,
      method: 'POST',
      url,
      data: form,
      headers: {
        ...options.headers,
        ...form.getHeaders(),
      },
    });

    return response.data;
  }

  // File download
  async download(
    url: string,
    destination?: string,
    options: ApiRequestOptions = {}
  ): Promise<Buffer> {
    const response = await this.makeRequest({
      ...options,
      method: 'GET',
      url,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);

    if (destination) {
      const fs = require('fs');
      fs.writeFileSync(destination, buffer);
      logger.info(`File downloaded to: ${destination}`);
    }

    return buffer;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health', { authRequired: false, silent: true });
      return response.success !== false;
    } catch (error) {
      return false;
    }
  }

  // Authentication status
  isAuthenticated(): boolean {
    return config.isAuthenticated();
  }

  // API status
  async getStatus(): Promise<ApiResponse<{
    status: string;
    version: string;
    services: Record<string, string>;
  }>> {
    return this.get('/status', { authRequired: false });
  }

  // Utility methods
  private getEndpoint(endpoint: string): string {
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  }

  // Event listeners
  onRequest(callback: (config: AxiosRequestConfig) => void): void {
    this.on('request', callback);
  }

  onResponse(callback: (response: AxiosResponse) => void): void {
    this.on('response', callback);
  }

  onError(callback: (error: any) => void): void {
    this.on('error', callback);
  }

  onRateLimited(callback: (data: { retryAfter: number; resetTime: number }) => void): void {
    this.on('rateLimited', callback);
  }

  onTokenRefreshed(callback: (data: { accessToken: string; refreshToken: string }) => void): void {
    this.on('tokenRefreshed', callback);
  }

  onTokenRefreshFailed(callback: (error: any) => void): void {
    this.on('tokenRefreshFailed', callback);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export convenience methods
export const api = {
  get: <T = any>(url: string, options?: ApiRequestOptions) => apiClient.get<T>(url, options),
  post: <T = any>(url: string, data?: any, options?: ApiRequestOptions) => apiClient.post<T>(url, data, options),
  put: <T = any>(url: string, data?: any, options?: ApiRequestOptions) => apiClient.put<T>(url, data, options),
  patch: <T = any>(url: string, data?: any, options?: ApiRequestOptions) => apiClient.patch<T>(url, data, options),
  delete: <T = any>(url: string, options?: ApiRequestOptions) => apiClient.delete<T>(url, options),
  getPaginated: <T = any>(url: string, options?: PaginatedRequestOptions) => apiClient.getPaginated<T>(url, options),
  upload: <T = any>(url: string, file: Buffer | NodeJS.ReadableStream, filename: string, contentType: string, options?: ApiRequestOptions) => apiClient.upload<T>(url, file, filename, contentType, options),
  download: (url: string, destination?: string, options?: ApiRequestOptions) => apiClient.download(url, destination, options),
  healthCheck: () => apiClient.healthCheck(),
  getStatus: () => apiClient.getStatus(),
  isAuthenticated: () => apiClient.isAuthenticated(),
  client: apiClient,
};

export default api;