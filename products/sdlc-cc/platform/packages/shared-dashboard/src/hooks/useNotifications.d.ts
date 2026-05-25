/**
 * useNotifications Hook
 * Provides notification management functionality
 */
interface UseNotificationsOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
    userId?: string;
}
export declare const useNotifications: (userId?: string, options?: UseNotificationsOptions) => {
    notifications: any;
    loading: any;
    error: any;
    unreadCount: any;
    notificationsByCategory: any;
    recentNotifications: any;
    highPriorityNotifications: any;
    markAsRead: any;
    markAllAsRead: any;
    deleteNotification: any;
    addNotification: any;
    refresh: any;
};
export {};
//# sourceMappingURL=useNotifications.d.ts.map