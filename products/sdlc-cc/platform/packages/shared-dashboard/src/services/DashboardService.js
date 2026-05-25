/**
 * Dashboard Service
 * Core service for dashboard data management and API integrations
 */
export class DashboardService {
    config;
    cache;
    subscribers;
    refreshIntervals;
    constructor(config) {
        this.config = config;
        this.cache = new Map();
        this.subscribers = new Map();
        this.refreshIntervals = new Map();
    }
    /**
     * Get current user information
     */
    async getCurrentUser() {
        const cacheKey = 'current-user';
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.fetchWithAuth('/api/user/me');
            const user = await response.json();
            this.setCache(cacheKey, user, 300000); // 5 minutes cache
            return user;
        }
        catch (error) {
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }
    /**
     * Get all available products
     */
    async getProducts() {
        const cacheKey = 'products';
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.fetchWithAuth('/api/products');
            const products = await response.json();
            // Fetch health status and metrics for each product
            const productsWithStatus = await Promise.all(products.map(async (product) => ({
                ...product,
                healthStatus: await this.getProductHealth(product.id),
                metrics: await this.getProductMetrics(product.id),
            })));
            this.setCache(cacheKey, productsWithStatus, 30000); // 30 seconds cache
            return productsWithStatus;
        }
        catch (error) {
            throw new Error(`Failed to fetch products: ${error.message}`);
        }
    }
    /**
     * Get product health status
     */
    async getProductHealth(productId) {
        try {
            const response = await this.fetchWithAuth(`/api/products/${productId}/health`);
            return await response.json();
        }
        catch (error) {
            // Product health check failed, return undefined
            console.warn(`Health check failed for product ${productId}:`, error);
            return undefined;
        }
    }
    /**
     * Get product metrics
     */
    async getProductMetrics(productId) {
        try {
            const response = await this.fetchWithAuth(`/api/products/${productId}/metrics`);
            return await response.json();
        }
        catch (error) {
            // Product metrics fetch failed, return undefined
            console.warn(`Metrics fetch failed for product ${productId}:`, error);
            return undefined;
        }
    }
    /**
     * Get dashboard layout configuration
     */
    async getDashboardLayout(userId) {
        const cacheKey = `dashboard-layout-${userId || 'default'}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const url = userId ? `/api/users/${userId}/dashboard/layout` : '/api/dashboard/layout/default';
            const response = await this.fetchWithAuth(url);
            const layout = await response.json();
            this.setCache(cacheKey, layout, 600000); // 10 minutes cache
            return layout;
        }
        catch (error) {
            throw new Error(`Failed to fetch dashboard layout: ${error.message}`);
        }
    }
    /**
     * Save dashboard layout configuration
     */
    async saveDashboardLayout(layout, userId) {
        try {
            const url = userId ? `/api/users/${userId}/dashboard/layout` : '/api/dashboard/layout/default';
            const response = await this.fetchWithAuth(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(layout),
            });
            const savedLayout = await response.json();
            // Clear cache and notify subscribers
            const cacheKey = `dashboard-layout-${userId || 'default'}`;
            this.clearCache(cacheKey);
            this.notifySubscribers('layout-updated', savedLayout);
            return savedLayout;
        }
        catch (error) {
            throw new Error(`Failed to save dashboard layout: ${error.message}`);
        }
    }
    /**
     * Get notifications for user
     */
    async getNotifications(userId, options) {
        try {
            const params = new URLSearchParams();
            if (options?.limit)
                params.set('limit', options.limit.toString());
            if (options?.offset)
                params.set('offset', options.offset.toString());
            if (options?.unreadOnly)
                params.set('unreadOnly', 'true');
            if (options?.category)
                params.set('category', options.category);
            const response = await this.fetchWithAuth(`/api/users/${userId}/notifications?${params}`);
            return await response.json();
        }
        catch (error) {
            throw new Error(`Failed to fetch notifications: ${error.message}`);
        }
    }
    /**
     * Mark notification as read
     */
    async markNotificationAsRead(userId, notificationId) {
        try {
            await this.fetchWithAuth(`/api/users/${userId}/notifications/${notificationId}/read`, {
                method: 'POST',
            });
            // Clear cache and notify subscribers
            this.clearCache(`notifications-${userId}`);
            this.notifySubscribers('notifications-updated', { notificationId, userId });
        }
        catch (error) {
            throw new Error(`Failed to mark notification as read: ${error.message}`);
        }
    }
    /**
     * Mark all notifications as read
     */
    async markAllNotificationsAsRead(userId) {
        try {
            await this.fetchWithAuth(`/api/users/${userId}/notifications/read-all`, {
                method: 'POST',
            });
            // Clear cache and notify subscribers
            this.clearCache(`notifications-${userId}`);
            this.notifySubscribers('notifications-updated', { userId });
        }
        catch (error) {
            throw new Error(`Failed to mark all notifications as read: ${error.message}`);
        }
    }
    /**
     * Search across all products and data
     */
    async search(config) {
        const cacheKey = `search-${JSON.stringify(config)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.fetchWithAuth('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const results = await response.json();
            this.setCache(cacheKey, results, 30000); // 30 seconds cache
            return results;
        }
        catch (error) {
            throw new Error(`Failed to perform search: ${error.message}`);
        }
    }
    /**
     * Get quick actions for user
     */
    async getQuickActions(userId) {
        try {
            const response = await this.fetchWithAuth(`/api/users/${userId}/quick-actions`);
            return await response.json();
        }
        catch (error) {
            throw new Error(`Failed to fetch quick actions: ${error.message}`);
        }
    }
    /**
     * Execute quick action
     */
    async executeQuickAction(userId, actionId, params) {
        try {
            const response = await this.fetchWithAuth(`/api/users/${userId}/quick-actions/${actionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params || {}),
            });
            return await response.json();
        }
        catch (error) {
            throw new Error(`Failed to execute quick action: ${error.message}`);
        }
    }
    /**
     * Get user preferences
     */
    async getUserPreferences(userId) {
        const cacheKey = `preferences-${userId}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.fetchWithAuth(`/api/users/${userId}/preferences`);
            const preferences = await response.json();
            this.setCache(cacheKey, preferences, 300000); // 5 minutes cache
            return preferences;
        }
        catch (error) {
            throw new Error(`Failed to fetch user preferences: ${error.message}`);
        }
    }
    /**
     * Update user preferences
     */
    async updateUserPreferences(userId, preferences) {
        try {
            const response = await this.fetchWithAuth(`/api/users/${userId}/preferences`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences),
            });
            const updatedPreferences = await response.json();
            // Clear cache and notify subscribers
            this.clearCache(`preferences-${userId}`);
            this.notifySubscribers('preferences-updated', updatedPreferences);
            return updatedPreferences;
        }
        catch (error) {
            throw new Error(`Failed to update user preferences: ${error.message}`);
        }
    }
    /**
     * Get dashboard configuration
     */
    async getDashboardConfig(userId) {
        const cacheKey = `dashboard-config-${userId || 'default'}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const url = userId ? `/api/users/${userId}/dashboard/config` : '/api/dashboard/config';
            const response = await this.fetchWithAuth(url);
            const config = await response.json();
            this.setCache(cacheKey, config, 300000); // 5 minutes cache
            return config;
        }
        catch (error) {
            throw new Error(`Failed to fetch dashboard config: ${error.message}`);
        }
    }
    /**
     * Update product integration configuration
     */
    async updateProductIntegration(userId, integrationId, config) {
        try {
            const response = await this.fetchWithAuth(`/api/users/${userId}/integrations/${integrationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const updatedIntegration = await response.json();
            // Clear cache and notify subscribers
            this.clearCache(`integrations-${userId}`);
            this.notifySubscribers('integration-updated', updatedIntegration);
            return updatedIntegration;
        }
        catch (error) {
            throw new Error(`Failed to update product integration: ${error.message}`);
        }
    }
    /**
     * Subscribe to real-time updates
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
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
    startRealTimeRefresh() {
        // Product health checks every 30 seconds
        this.startPeriodicRefresh('product-health', this.refreshProductHealth.bind(this), 30000);
        // User notifications every 60 seconds
        this.startPeriodicRefresh('user-notifications', this.refreshUserNotifications.bind(this), 60000);
    }
    /**
     * Stop real-time data refresh
     */
    stopRealTimeRefresh() {
        this.refreshIntervals.forEach((interval) => clearInterval(interval));
        this.refreshIntervals.clear();
    }
    /**
     * Private helper methods
     */
    async fetchWithAuth(url, options = {}) {
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
    getAuthToken() {
        // Implementation depends on your auth system
        return localStorage.getItem('auth_token') || '';
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return undefined;
        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        return cached.data;
    }
    setCache(key, data, ttl) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }
    clearCache(key) {
        this.cache.delete(key);
    }
    clearAllCache() {
        this.cache.clear();
    }
    notifySubscribers(event, data) {
        const subscribers = this.subscribers.get(event);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                }
                catch (error) {
                    console.error(`Error in subscriber callback for event ${event}:`, error);
                }
            });
        }
    }
    startPeriodicRefresh(key, refreshFunction, interval) {
        // Clear existing interval if any
        const existing = this.refreshIntervals.get(key);
        if (existing) {
            clearInterval(existing);
        }
        // Set new interval
        const intervalId = setInterval(async () => {
            try {
                await refreshFunction();
            }
            catch (error) {
                console.error(`Error in periodic refresh for ${key}:`, error);
            }
        }, interval);
        this.refreshIntervals.set(key, intervalId);
    }
    async refreshProductHealth() {
        try {
            const products = await this.getProducts();
            this.notifySubscribers('product-health-updated', products);
        }
        catch (error) {
            console.error('Error refreshing product health:', error);
        }
    }
    async refreshUserNotifications() {
        // This would be called periodically to refresh notifications for active users
        // Implementation depends on your user management system
    }
}
//# sourceMappingURL=DashboardService.js.map