/**
 * NotificationsWidget Component
 * Displays recent notifications and alerts
 */

import React from 'react';
import type { User, Notification } from '../types';
import { DashboardService } from '../services/DashboardService';

interface NotificationsWidgetProps {
  user?: User;
  dashboardService: DashboardService;
  className?: string;
}

export const NotificationsWidget: React.FC<NotificationsWidgetProps> = ({
  user: _user,
  dashboardService: _dashboardService,
  className = '',
}) => {
  // Mock recent notifications
  const notifications: Notification[] = [
    {
      id: '1',
      type: 'success',
      title: 'Pipeline Completed',
      message: 'Production deployment pipeline completed successfully',
      read: false,
      category: 'pipelines',
      priority: 'low',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      actionUrl: '/sdlc/pipelines/123',
      actionText: 'View Details',
      metadata: {
        pipelineId: '123',
        environment: 'production',
        duration: '12m 34s',
      },
    },
    {
      id: '2',
      type: 'warning',
      title: 'High API Usage',
      message: 'API usage is approaching your monthly limit',
      read: false,
      category: 'billing',
      priority: 'medium',
      createdAt: '2024-01-15T09:15:00Z',
      updatedAt: '2024-01-15T09:15:00Z',
      actionUrl: '/billing/usage',
      actionText: 'View Usage',
      metadata: {
        currentUsage: 8573,
        limit: 10000,
        percentage: 85.7,
      },
    },
    {
      id: '3',
      type: 'info',
      title: 'New Feature Available',
      message: 'AI-powered code analysis is now available',
      read: true,
      category: 'features',
      priority: 'low',
      createdAt: '2024-01-14T14:22:00Z',
      updatedAt: '2024-01-14T14:22:00Z',
      actionUrl: '/ai/analysis',
      actionText: 'Try Now',
      metadata: {
        featureName: 'AI Code Analysis',
        version: '1.0.0',
      },
    },
  ];

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      pipeline: '🚀',
      billing: '💳',
      security: '🛡️',
      system: '⚙️',
      update: '🔄',
      alert: '🚨',
      features: '🎉',
    };
    return icons[type] || '📢';
  };

  const getNotificationColor = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      features: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    };
    return colors[type] || colors.info;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Notifications</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Latest alerts and updates
              {unreadCount > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  ({unreadCount} unread)
                </span>
              )}
            </p>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="card-body">
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`
                  p-3 border rounded-lg transition-all duration-200 hover:shadow-sm
                  ${getNotificationColor(notification.type)}
                  ${!notification.read ? 'border-l-4 border-l-blue-500' : ''}
                `}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 text-lg">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {notification.title}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {notification.message}
                    </p>

                    {/* Action Button */}
                    {notification.actionUrl && (
                      <a
                        href={notification.actionUrl}
                        className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <span>{notification.actionText || 'View details'}</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    )}
                  </div>

                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {notifications.length} notifications
          </div>
          <a
            href="/notifications"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            View all notifications
          </a>
        </div>
      </div>
    </div>
  );
};