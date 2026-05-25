/**
 * Dashboard Service
 * Core service for dashboard data management and API integrations
 */

import type {
  Product,
  User,
  DashboardLayout,
  Notification,
  SearchResult,
  SearchConfig,
  DashboardConfig,
  ProductIntegration,
  UserPreferences,
  HealthStatus,
  ProductMetrics,
  QuickAction,
} from '../types';

export interface DashboardServiceConfig {
  apiBaseUrl: string;
  timeout: number;
  retries: number;
  cacheEnabled: boolean;
  refreshInterval: number;
}

export class DashboardService {
  private config: DashboardServiceConfig;
  private cache: Map<string, { data: unknown; timestamp: number; ttl: number }>;
  private subscribers: Map<string, Set<(data: unknown) => void>>;
  private refreshIntervals: Map<string, NodeJS.Timeout>;

  constructor(config: DashboardServiceConfig) {
    this.config = config;
    this.cache = new Map();
    this.subscribers = new Map();
    this.refreshIntervals = new Map();
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    const cacheKey = 'current-user';
    const cached = this.getFromCache<User>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.fetchWithAuth('/api/user/me');
      const user = await response.json() as User;
      this.setCache(cacheKey, user, 300000); // 5 minutes cache
      return user;
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all available products
   */
  async getProducts(): Promise<Product[]> {
    const cacheKey = 'products';
    const cached = this.getFromCache<Product[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.fetchWithAuth('/api/products');
      const products = await response.json() as Product[];

      // Fetch health status and metrics for each product
      const productsWithStatus = await Promise.all(
        products.map(async (product: Product) => ({
          ...product,
          healthStatus: await this.getProductHealth(product.id),
          metrics: await this.getProductMetrics(product.id),
        }))
      );

      this.setCache(cacheKey, productsWithStatus, 30000); // 30 seconds cache
      return productsWithStatus;
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get product health status
   */
  async getProductHealth(productId: string): Promise<HealthStatus | undefined> {
    try {
      const response = await this.fetchWithAuth(`/api/products/${productId}/health`);
      return await response.json() as HealthStatus;
    } catch (error) {
      // Product health check failed, return undefined
      console.warn(`Health check failed for product ${productId}:`, error);
      return undefined;
    }
  }

  /**
   * Get product metrics
   */
  async getProductMetrics(productId: string): Promise<ProductMetrics | undefined> {
    try {
      const response = await this.fetchWithAuth(`/api/products/${productId}/metrics`);
      return await response.json() as ProductMetrics;
    } catch (error) {
      // Product metrics fetch failed, return undefined
      console.warn(`Metrics fetch failed for product ${productId}:`, error);
      return undefined;
    }
  }

  /**
   * Get dashboard layout configuration
   */
  async getDashboardLayout(userId?: string): Promise<DashboardLayout> {
    const cacheKey = `dashboard-layout-${userId || 'default'}`;
    const cached = this.getFromCache<DashboardLayout>(cacheKey);
    if (cached) return cached;

    try {
      const url = userId ? `/api/users/${userId}/dashboard/layout` : '/api/dashboard/layout/default';
      const response = await this.fetchWithAuth(url);
      const layout = await response.json() as DashboardLayout;
      this.setCache(cacheKey, layout, 600000); // 10 minutes cache
      return layout;
    } catch (error) {
      throw new Error(`Failed to fetch dashboard layout: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save dashboard layout configuration
   */
  async saveDashboardLayout(layout: Partial<DashboardLayout>, userId?: string): Promise<DashboardLayout> {
    try {
      const url = userId ? `/api/users/${userId}/dashboard/layout` : '/api/dashboard/layout/default';
      const response = await this.fetchWithAuth(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });

      const savedLayout = await response.json() as DashboardLayout;

      // Clear cache and notify subscribers
      const cacheKey = `dashboard-layout-${userId || 'default'}`;
      this.clearCache(cacheKey);
      this.notifySubscribers('layout-updated', savedLayout);

      return savedLayout;
    } catch (error) {
      throw new Error(`Failed to save dashboard layout: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get notifications for user
   */
  async getNotifications(userId: string, options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    category?: string;
  }): Promise<Notification[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());
      if (options?.unreadOnly) params.set('unreadOnly', 'true');
      if (options?.category) params.set('category', options.category);

      const response = await this.fetchWithAuth(`/api/users/${userId}/notifications?${params}`);
      return await response.json() as Notification[];
    } catch (error) {
      throw new Error(`Failed to fetch notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await this.fetchWithAuth(`/api/users/${userId}/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      // Clear cache and notify subscribers
      this.clearCache(`notifications-${userId}`);
      this.notifySubscribers('notifications-updated', { notificationId, userId });
    } catch (error) {
      throw new Error(`Failed to mark notification as read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await this.fetchWithAuth(`/api/users/${userId}/notifications/read-all`, {
        method: 'POST',
      });

      // Clear cache and notify subscribers
      this.clearCache(`notifications-${userId}`);
      this.notifySubscribers('notifications-updated', { userId });
    } catch (error) {
      throw new Error(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search across all products and data
   */
  async search(config: SearchConfig): Promise<SearchResult[]> {
    const cacheKey = `search-${JSON.stringify(config)}`;
    const cached = this.getFromCache<SearchResult[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.fetchWithAuth('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const results = await response.json() as SearchResult[];
      this.setCache(cacheKey, results, 30000); // 30 seconds cache
      return results;
    } catch (error) {
      throw new Error(`Failed to perform search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get quick actions for user
   */
  async getQuickActions(userId: string): Promise<QuickAction[]> {
    try {
      const response = await this.fetchWithAuth(`/api/users/${userId}/quick-actions`);
      return await response.json() as QuickAction[];
    } catch (error) {
      throw new Error(`Failed to fetch quick actions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute quick action
   */
  async executeQuickAction(userId: string, actionId: string, params?: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await this.fetchWithAuth(`/api/users/${userId}/quick-actions/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
      });
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to execute quick action: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const cacheKey = `preferences-${userId}`;
    const cached = this.getFromCache<UserPreferences>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.fetchWithAuth(`/api/users/${userId}/preferences`);
      const preferences = await response.json() as UserPreferences;
      this.setCache(cacheKey, preferences, 300000); // 5 minutes cache
      return preferences;
    } catch (error) {
      throw new Error(`Failed to fetch user preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const response = await this.fetchWithAuth(`/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      const updatedPreferences = await response.json() as UserPreferences;

      // Clear cache and notify subscribers
      this.clearCache(`preferences-${userId}`);
      this.notifySubscribers('preferences-updated', updatedPreferences);

      return updatedPreferences;
    } catch (error) {
      throw new Error(`Failed to update user preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get dashboard configuration
   */
  async getDashboardConfig(userId?: string): Promise<DashboardConfig> {
    const cacheKey = `dashboard-config-${userId || 'default'}`;
    const cached = this.getFromCache<DashboardConfig>(cacheKey);
    if (cached) return cached;

    try {
      const url = userId ? `/api/users/${userId}/dashboard/config` : '/api/dashboard/config';
      const response = await this.fetchWithAuth(url);
      const config = await response.json() as DashboardConfig;
      this.setCache(cacheKey, config, 300000); // 5 minutes cache
      return config;
    } catch (error) {
      throw new Error(`Failed to fetch dashboard config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update product integration configuration
   */
  async updateProductIntegration(userId: string, integrationId: string, config: Partial<ProductIntegration>): Promise<ProductIntegration> {
    try {
      const response = await this.fetchWithAuth(`/api/users/${userId}/integrations/${integrationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const updatedIntegration = await response.json() as ProductIntegration;

      // Clear cache and notify subscribers
      this.clearCache(`integrations-${userId}`);
      this.notifySubscribers('integration-updated', updatedIntegration);

      return updatedIntegration;
    } catch (error) {
      throw new Error(`Failed to update product integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(event: string, callback: (data: unknown) => void): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }

    this.subscribers.get(event)!.add(callback);

    return () => {
      const subscribers = this.subscribers.get(event);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  /**
   * Start real-time data refresh
   */
  startRealTimeRefresh(): void {
    // Product health checks every 30 seconds
    this.startPeriodicRefresh('product-health', this.refreshProductHealth.bind(this), 30000);

    // User notifications every 60 seconds
    this.startPeriodicRefresh('user-notifications', this.refreshUserNotifications.bind(this), 60000);
  }

  /**
   * Stop real-time data refresh
   */
  stopRealTimeRefresh(): void {
    this.refreshIntervals.forEach((interval) => clearInterval(interval));
    this.refreshIntervals.clear();
  }

  /**
   * Private helper methods
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getAuthToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${this.config.apiBaseUrl}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  private getAuthToken(): string {
    // Implementation depends on your auth system
    return localStorage.getItem('auth_token') || '';
  }

  private getFromCache<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.data as T;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private clearCache(key: string): void {
    this.cache.delete(key);
  }

  public clearAllCache(): void {
    this.cache.clear();
  }

  private notifySubscribers(event: string, data: unknown): void {
    const subscribers = this.subscribers.get(event);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscriber callback for event ${event}:`, error);
        }
      });
    }
  }

  private startPeriodicRefresh(key: string, refreshFunction: () => Promise<void>, interval: number): void {
    // Clear existing interval if any
    const existing = this.refreshIntervals.get(key);
    if (existing) {
      clearInterval(existing);
    }

    // Set new interval
    const intervalId = setInterval(async () => {
      try {
        await refreshFunction();
      } catch (error) {
        console.error(`Error in periodic refresh for ${key}:`, error);
      }
    }, interval);

    this.refreshIntervals.set(key, intervalId);
  }

  private async refreshProductHealth(): Promise<void> {
    try {
      const products = await this.getProducts();
      this.notifySubscribers('product-health-updated', products);
    } catch (error) {
      console.error('Error refreshing product health:', error);
    }
  }

  private async refreshUserNotifications(): Promise<void> {
    // This would be called periodically to refresh notifications for active users
    // Implementation depends on your user management system
  }
}