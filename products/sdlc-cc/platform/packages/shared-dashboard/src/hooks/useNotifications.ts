/**
 * useNotifications Hook
 * Provides notification management functionality
 */

import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '../types';

interface UseNotificationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  userId?: string;
}

export const useNotifications = (userId?: string, options: UseNotificationsOptions = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock notification data - this would come from DashboardService
  const mockNotifications: Notification[] = [
    {
      id: '1',
      type: 'pipeline',
      title: 'Pipeline Completed Successfully',
      message: 'Production deployment pipeline completed in 12m 34s',
      read: false,
      category: 'pipelines',
      priority: 'low',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      actionUrl: '/sdlc/pipelines/production-deploy',
      actionText: 'View Pipeline',
      metadata: {
        pipelineId: 'prod-deploy-123',
        duration: '12m 34s',
        status: 'success',
        environment: 'production',
      },
    },
    {
      id: '2',
      type: 'billing',
      title: 'Payment Processed',
      message: 'Your monthly subscription payment of $99 has been processed successfully',
      read: false,
      category: 'billing',
      priority: 'medium',
      createdAt: '2024-01-14T09:15:00Z',
      updatedAt: '2024-01-14T09:15:00Z',
      actionUrl: '/billing/invoices/inv_123',
      actionText: 'View Invoice',
      metadata: {
        amount: 99,
        currency: 'USD',
        invoiceId: 'inv_123',
        method: 'card',
      },
    },
    {
      id: '3',
      type: 'security',
      title: 'New API Key Generated',
      message: 'A new API key was created for your account',
      read: true,
      category: 'security',
      priority: 'high',
      createdAt: '2024-01-13T14:22:00Z',
      updatedAt: '2024-01-13T14:22:00Z',
      actionUrl: '/settings/api-keys',
      actionText: 'Manage API Keys',
      metadata: {
        keyId: 'key_456',
        createdAt: '2024-01-13T14:22:00Z',
        lastUsed: null,
      },
    },
    {
      id: '4',
      type: 'system',
      title: 'Scheduled Maintenance',
      message: 'System maintenance scheduled for tomorrow 2:00 AM UTC',
      read: true,
      category: 'system',
      priority: 'medium',
      createdAt: '2024-01-12T16:45:00Z',
      updatedAt: '2024-01-12T16:45:00Z',
      actionUrl: '/status',
      actionText: 'Check Status',
      metadata: {
        scheduledAt: '2024-01-16T02:00:00Z',
        duration: '2h',
        affectedServices: ['API', 'Dashboard'],
      },
    },
    {
      id: '5',
      type: 'success',
      title: 'AI Analysis Complete',
      message: 'Code analysis completed for repository frontend-monorepo',
      read: false,
      category: 'ai',
      priority: 'low',
      createdAt: '2024-01-11T11:30:00Z',
      updatedAt: '2024-01-11T11:30:00Z',
      actionUrl: '/ai/analysis/analysis_789',
      actionText: 'View Results',
      metadata: {
        analysisId: 'analysis_789',
        repository: 'frontend-monorepo',
        issuesFound: 3,
        suggestions: 12,
      },
    },
  ];

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setNotifications(mockNotifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (_userId: string, notificationId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));

      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true, updatedAt: new Date().toISOString() }
            : notification
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (_userId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));

      setNotifications(prev =>
        prev.map(notification => ({
          ...notification,
          read: true,
          updatedAt: new Date().toISOString(),
        }))
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (_userId: string, notificationId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));

      setNotifications(prev =>
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // Add new notification (for real-time updates)
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(notification => !notification.read).length;

  // Group notifications by category
  const notificationsByCategory = notifications.reduce((acc, notification) => {
    const category = notification.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  // Get recent notifications (last 24 hours)
  const recentNotifications = notifications.filter(notification => {
    const createdAt = new Date(notification.createdAt);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return createdAt > twentyFourHoursAgo;
  });

  // Get high priority notifications
  const highPriorityNotifications = notifications.filter(notification =>
    notification.priority === 'high' && !notification.read
  );

  // Initial load and auto-refresh
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(loadNotifications, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadNotifications, userId]);

  // Simulate real-time notifications
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      // Randomly add a new notification (5% chance every 30 seconds)
      if (Math.random() < 0.05) {
        const types = ['info', 'success', 'warning'];
        const type = types[Math.floor(Math.random() * types.length)];

        addNotification({
          type: type as any,
          title: 'New System Update',
          message: 'A new system update is available',
          read: false,
          category: 'system',
          priority: 'low',
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, addNotification]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    notificationsByCategory,
    recentNotifications,
    highPriorityNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    refresh: loadNotifications,
  };
};