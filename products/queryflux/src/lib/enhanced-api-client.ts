/**
 * Enhanced API Client with retry logic, token refresh, and WebSocket support
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { WebSocketManager } from './websocket-manager';
import { setupInterceptors } from './apiInterceptors';
import { OfflineRequestQueue } from './apiOfflineQueue';
import { isTokenExpiringSoon, refreshAuthToken } from './apiTokenUtils';
import type { RetryConfig } from './apiClientTypes';
export type { APIError, RetryConfig, QueuedRequest } from './apiClientTypes';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API_TIMEOUT = 30000;
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

export class EnhancedAPIClient {
  private client: AxiosInstance;
  private wsManager: WebSocketManager | null = null;
  private refreshPromise: Promise<string> | null = null;
  private queue: OfflineRequestQueue;
  private retryConfig: RetryConfig = {
    retries: 3,
    retryDelay: 1000,
    retryCondition: (err: AxiosError) => !err.response || (err.response.status >= 500 && err.response.status < 600),
  };

  constructor() {
    this.client = axios.create({ baseURL: API_BASE_URL, timeout: API_TIMEOUT, headers: { 'Content-Type': 'application/json' } });
    this.queue = new OfflineRequestQueue();
    setupInterceptors(this.client, {
      retryConfig: this.retryConfig,
      generateRequestId: () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isTokenExpiringSoon: (token) => isTokenExpiringSoon(token),
      refreshAuthToken: () => refreshAuthToken(API_BASE_URL, () => this.refreshPromise, (p) => { this.refreshPromise = p; }),
      shouldRetry: (err) => !!this.retryConfig.retryCondition?.(err),
      delay: (ms) => new Promise(r => setTimeout(r, ms)),
      getIsOnline: () => this.queue.isOnline,
      queueOfflineRequest: (config) => this.queue.enqueue(config),
    });
    this.queue.setupListeners(() => this.client);
  }

  public async request<T>(method: string, url: string, data?: unknown): Promise<T> {
    const response = await this.client.request<T>({ method, url, data });
    return response.data;
  }

  public async get<T>(url: string, config?: Partial<InternalAxiosRequestConfig>): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  public async post<T>(url: string, data?: unknown, config?: Partial<InternalAxiosRequestConfig>): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  public async put<T>(url: string, data?: unknown, config?: Partial<InternalAxiosRequestConfig>): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  public async patch<T>(url: string, data?: unknown, config?: Partial<InternalAxiosRequestConfig>): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  public async delete<T>(url: string, config?: Partial<InternalAxiosRequestConfig>): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  public connectWebSocket(): void {
    if (!this.wsManager) {
      const token = localStorage.getItem('auth_token');
      this.wsManager = new WebSocketManager(`${WS_BASE_URL}/ws`, token);
      this.wsManager.connect();
    }
  }

  public disconnectWebSocket(): void {
    if (this.wsManager) { this.wsManager.disconnect(); this.wsManager = null; }
  }

  public getWebSocket(): WebSocketManager | null { return this.wsManager; }

  public createCancelToken(): { token: unknown; cancel: (reason?: string) => void } {
    const source = axios.CancelToken.source();
    return { token: source.token, cancel: source.cancel };
  }

  public setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  public getAxiosInstance(): AxiosInstance { return this.client; }
}

export const apiClient = new EnhancedAPIClient();

if (localStorage.getItem('auth_token')) {
  apiClient.connectWebSocket();
}

export default apiClient;
