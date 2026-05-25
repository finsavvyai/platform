/**
 * Activity Feed Component
 * Displays recent activity across all products
 */

import React from 'react';
import { Clock, GitCommit, AlertCircle, User, Code } from 'lucide-react';
import { useActivity } from '../hooks/useActivity';

export const ActivityFeed: React.FC = () => {
  const { activities, loading, error } = useActivity();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deployment':
        return <GitCommit className="w-5 h-5" />;
      case 'alert':
        return <AlertCircle className="w-5 h-5" />;
      case 'user_action':
        return <User className="w-5 h-5" />;
      case 'system_event':
        return <Code className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'deployment':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300';
      case 'alert':
        return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300';
      case 'user_action':
        return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300';
      case 'system_event':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-red-200 dark:border-red-700 p-6">
        <p className="text-red-600 dark:text-red-400">Error loading activity feed: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${getActivityColor(activity.activity_type)}`}>
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.description}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium capitalize">{activity.product_id}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
