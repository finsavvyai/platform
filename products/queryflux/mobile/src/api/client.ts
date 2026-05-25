/**
 * Mobile App API Client for QueryFlux Backend
 * Provides connectivity to the Go backend for real-time monitoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface MobileDeviceInfo {
  platform: 'ios' | 'android';
  version: string;
  deviceId: string;
  pushToken?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  queryComplete: boolean;
  connectionError: boolean;
  performanceAlerts: boolean;
  systemUpdates: boolean;
}

export interface AlertThreshold {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  enabled: boolean;
}

class BaseAPIClient {
  protected baseURL: string;
  protected deviceInfo: MobileDeviceInfo;

  constructor() {
    this.baseURL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8080/api/v1'
      : 'https://api.queryflux.com/api/v1';

    this.deviceInfo = {
      platform: Platform.OS as 'ios' | 'android',
      version: Platform.Version.toString(),
      deviceId: this.generateDeviceId(),
    };
  }

  private generateDeviceId(): string {
    // Generate a unique device ID or retrieve from storage
    // For production, use proper device identification
    return `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `QueryFlux-Mobile/${this.deviceInfo.platform}/${this.deviceInfo.version}`,
      'X-Device-ID': this.deviceInfo.deviceId,
      'X-Platform': this.deviceInfo.platform,
    };

    try {
      // Add authentication token if available
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
          code: data.code || 'HTTP_ERROR',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      };
    }
  }

  protected async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  protected async post<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async put<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }
}

export class AuthAPI extends BaseAPIClient {
  async login(email: string, password: string): Promise<APIResponse> {
    const response = await this.post('/auth/login', {
      email,
      password,
      deviceInfo: this.deviceInfo,
    });

    if (response.success && response.data?.accessToken) {
      // Store authentication tokens
      await AsyncStorage.setItem('auth_token', response.data.accessToken);
      await AsyncStorage.setItem('refresh_token', response.data.refreshToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
    }

    return response;
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
  }): Promise<APIResponse> {
    return this.post('/auth/register', {
      ...userData,
      deviceInfo: this.deviceInfo,
    });
  }

  async logout(): Promise<APIResponse> {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    const response = await this.post('/auth/logout', { refreshToken });

    // Clear stored authentication data
    await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);

    return response;
  }

  async refreshToken(): Promise<APIResponse> {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
        code: 'NO_REFRESH_TOKEN',
        timestamp: new Date().toISOString(),
      };
    }

    const response = await this.post('/auth/refresh', { refreshToken });

    if (response.success && response.data?.accessToken) {
      await AsyncStorage.setItem('auth_token', response.data.accessToken);
      await AsyncStorage.setItem('refresh_token', response.data.refreshToken);
    }

    return response;
  }

  async getCurrentUser(): Promise<APIResponse> {
    return this.get('/auth/me');
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return false;

      const response = await this.getCurrentUser();
      return response.success;
    } catch {
      return false;
    }
  }
}

export class MonitoringAPI extends BaseAPIClient {
  async getRealTimeMetrics(connectionId?: string): Promise<APIResponse> {
    const params = connectionId ? `?connectionId=${connectionId}` : '';
    return this.get(`/monitoring/realtime${params}`);
  }

  async getHistoricalMetrics(
    connectionId: string,
    timeRange: '1h' | '6h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<APIResponse> {
    return this.get(`/monitoring/historical/${connectionId}?range=${timeRange}`);
  }

  async getConnectionStatus(connectionId: string): Promise<APIResponse> {
    return this.get(`/monitoring/status/${connectionId}`);
  }

  async getPerformanceMetrics(connectionId: string): Promise<APIResponse> {
    return this.get(`/monitoring/performance/${connectionId}`);
  }

  async getActiveConnections(): Promise<APIResponse> {
    return this.get('/monitoring/connections');
  }

  async getSlowQueries(
    connectionId?: string,
    limit: number = 10
  ): Promise<APIResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    if (connectionId) {
      params.append('connectionId', connectionId);
    }
    return this.get(`/monitoring/slow-queries?${params.toString()}`);
  }

  async getResourceUsage(connectionId: string): Promise<APIResponse> {
    return this.get(`/monitoring/resources/${connectionId}`);
  }
}

export class AlertsAPI extends BaseAPIClient {
  async getAlerts(): Promise<APIResponse> {
    return this.get('/alerts');
  }

  async createAlert(alert: {
    name: string;
    type: 'performance' | 'connection' | 'query' | 'resource';
    condition: string;
    threshold: AlertThreshold;
    enabled: boolean;
  }): Promise<APIResponse> {
    return this.post('/alerts', alert);
  }

  async updateAlert(alertId: string, updates: Partial<any>): Promise<APIResponse> {
    return this.put(`/alerts/${alertId}`, updates);
  }

  async deleteAlert(alertId: string): Promise<APIResponse> {
    return this.delete(`/alerts/${alertId}`);
  }

  async acknowledgeAlert(alertId: string): Promise<APIResponse> {
    return this.post(`/alerts/${alertId}/acknowledge`);
  }

  async getAlertHistory(limit: number = 50): Promise<APIResponse> {
    return this.get(`/alerts/history?limit=${limit}`);
  }

  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<APIResponse> {
    return this.post('/alerts/notification-preferences', preferences);
  }

  async getNotificationPreferences(): Promise<APIResponse<NotificationPreferences>> {
    return this.get('/alerts/notification-preferences');
  }
}

export class QueryAPI extends BaseAPIClient {
  async getRecentQueries(limit: number = 20): Promise<APIResponse> {
    return this.get(`/queries/recent?limit=${limit}`);
  }

  async getRunningQueries(): Promise<APIResponse> {
    return this.get('/queries/running');
  }

  async killQuery(queryId: string): Promise<APIResponse> {
    return this.post(`/queries/${queryId}/kill`);
  }

  async getQueryStats(connectionId: string, timeRange: string = '24h'): Promise<APIResponse> {
    return this.get(`/queries/stats/${connectionId}?range=${timeRange}`);
  }

  async getQueryExplanation(queryId: string): Promise<APIResponse> {
    return this.get(`/queries/${queryId}/explain`);
  }
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private subscriptions: Set<string> = new Set();
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor(private baseURL: string) {}

  async connect(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token available');
      }

      const wsURL = this.baseURL.replace('http', 'ws').replace('/api/v1', '/ws');
      this.ws = new WebSocket(`${wsURL}?token=${token}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.resumeSubscriptions();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }

  private handleMessage(message: { type: string; data: any }): void {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message.data);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private async resumeSubscriptions(): Promise<void> {
    // Resume all subscriptions after reconnection
    for (const subscription of this.subscriptions) {
      this.subscribe(subscription);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  subscribe(event: string, handler?: (data: any) => void): void {
    if (handler) {
      const handlers = this.messageHandlers.get(event) || [];
      handlers.push(handler);
      this.messageHandlers.set(event, handlers);
    }

    this.subscriptions.add(event);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        event,
      }));
    }
  }

  unsubscribe(event: string, handler?: (data: any) => void): void {
    if (handler) {
      const handlers = this.messageHandlers.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.messageHandlers.delete(event);
        }
      }
    }

    this.subscriptions.delete(event);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        event,
      }));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Main API Client
export class QueryFluxMobileAPI {
  public auth: AuthAPI;
  public monitoring: MonitoringAPI;
  public alerts: AlertsAPI;
  public query: QueryAPI;
  public websocket: WebSocketManager;

  constructor() {
    this.auth = new AuthAPI();
    this.monitoring = new MonitoringAPI();
    this.alerts = new AlertsAPI();
    this.query = new QueryAPI();
    this.websocket = new WebSocketManager(
      process.env.NODE_ENV === 'development'
        ? 'ws://localhost:8080'
        : 'wss://api.queryflux.com'
    );
  }

  async initialize(): Promise<void> {
    // Check if user is authenticated
    const isAuthenticated = await this.auth.isAuthenticated();

    if (isAuthenticated) {
      // Connect WebSocket for real-time updates
      await this.websocket.connect();
    }
  }

  async healthCheck(): Promise<APIResponse> {
    return this.auth.get('/health');
  }

  async cleanup(): Promise<void> {
    this.websocket.disconnect();
  }
}

// Create singleton instance
export const apiClient = new QueryFluxMobileAPI();

export default apiClient;