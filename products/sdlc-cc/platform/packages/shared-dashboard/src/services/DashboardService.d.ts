/**
 * Dashboard Service
 * Core service for dashboard data management and API integrations
 */
import type { Product, User, DashboardLayout, Notification, SearchResult, DashboardConfig, ProductIntegration, UserPreferences, HealthStatus, ProductMetrics, QuickAction } from '../types';
export interface DashboardServiceConfig {
    apiBaseUrl: string;
    timeout: number;
    retries: number;
    cacheEnabled: boolean;
    refreshInterval: number;
}
export declare class DashboardService {
    private config;
    private cache;
    private subscribers;
    private refreshIntervals;
    constructor(config: DashboardServiceConfig);
    /**
     * Get current user information
     */
    getCurrentUser(): Promise<User>;
    /**
     * Get all available products
     */
    getProducts(): Promise<Product[]>;
    /**
     * Get product health status
     */
    getProductHealth(productId: string): Promise<HealthStatus | undefined>;
    /**
     * Get product metrics
     */
    getProductMetrics(productId: string): Promise<ProductMetrics | undefined>;
    /**
     * Get dashboard layout configuration
     */
    getDashboardLayout(userId?: string): Promise<DashboardLayout>;
    /**
     * Save dashboard layout configuration
     */
    saveDashboardLayout(layout: Partial<DashboardLayout>, userId?: string): Promise<DashboardLayout>;
    /**
     * Get notifications for user
     */
    getNotifications(userId: string, options?: {
        limit?: number;
        offset?: number;
        unreadOnly?: boolean;
        category?: string;
    }): Promise<Notification[]>;
    /**
     * Mark notification as read
     */
    markNotificationAsRead(userId: string, notificationId: string): Promise<void>;
    /**
     * Mark all notifications as read
     */
    markAllNotificationsAsRead(userId: string): Promise<void>;
    /**
     * Search across all products and data
     */
    search(config: SearchConfig): Promise<SearchResult[]>;
    /**
     * Get quick actions for user
     */
    getQuickActions(userId: string): Promise<QuickAction[]>;
    /**
     * Execute quick action
     */
    executeQuickAction(userId: string, actionId: string, params?: Record<string, any>): Promise<any>;
    /**
     * Get user preferences
     */
    getUserPreferences(userId: string): Promise<UserPreferences>;
    /**
     * Update user preferences
     */
    updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
    /**
     * Get dashboard configuration
     */
    getDashboardConfig(userId?: string): Promise<DashboardConfig>;
    /**
     * Update product integration configuration
     */
    updateProductIntegration(userId: string, integrationId: string, config: Partial<ProductIntegration>): Promise<ProductIntegration>;
    /**
     * Subscribe to real-time updates
     */
    subscribe(event: string, callback: (data: any) => void): () => void;
    /**
     * Start real-time data refresh
     */
    startRealTimeRefresh(): void;
    /**
     * Stop real-time data refresh
     */
    stopRealTimeRefresh(): void;
    /**
     * Private helper methods
     */
    private fetchWithAuth;
    private getAuthToken;
    private getFromCache;
    private setCache;
    private clearCache;
    private clearAllCache;
    private notifySubscribers;
    private startPeriodicRefresh;
    private refreshProductHealth;
    private refreshUserNotifications;
}
//# sourceMappingURL=DashboardService.d.ts.map