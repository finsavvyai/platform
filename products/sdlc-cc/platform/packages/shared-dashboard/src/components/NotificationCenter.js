/**
 * NotificationCenter Component
 * Provides notification management and display functionality
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
export const NotificationCenter = ({ open, onToggle, user, className = '', }) => {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, } = useNotifications(user?.id);
    const [filter, setFilter] = useState('all');
    const dropdownRef = useRef(null);
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onToggle();
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open, onToggle]);
    const handleMarkAsRead = async (notificationId) => {
        if (user?.id) {
            await markAsRead(user.id, notificationId);
        }
    };
    const handleMarkAllAsRead = async () => {
        if (user?.id) {
            await markAllAsRead(user.id);
        }
    };
    const handleDelete = async (notificationId) => {
        if (user?.id) {
            await deleteNotification(user.id, notificationId);
        }
    };
    const getNotificationIcon = (type) => {
        const icons = {
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
        };
        return icons[type] || '📢';
    };
    const getNotificationColor = (type) => {
        const colors = {
            info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
            success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
            warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
            error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
            pipeline: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
            billing: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
            security: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
            system: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
        };
        return colors[type] || colors.info;
    };
    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        if (diffInMinutes < 1)
            return 'Just now';
        if (diffInMinutes < 60)
            return `${diffInMinutes}m ago`;
        if (diffInHours < 24)
            return `${diffInHours}h ago`;
        if (diffInDays < 7)
            return `${diffInDays}d ago`;
        return date.toLocaleDateString();
    };
    const filteredNotifications = notifications.filter(notification => {
        if (filter === 'unread')
            return !notification.read;
        if (filter === 'read')
            return notification.read;
        return true;
    });
    return (<div className={`relative ${className}`}>
      {/* Notification Button */}
      <button onClick={onToggle} className={`
          relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors duration-150 group
          ${open ? 'bg-gray-100 dark:bg-gray-700' : ''}
        `} aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}>
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>)}
      </button>

      {/* Dropdown */}
      {open && (<div ref={dropdownRef} className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (<button onClick={handleMarkAllAsRead} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    Mark all read
                  </button>)}
                <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-1">
              {['all', 'unread', 'read'].map((filterType) => (<button key={filterType} onClick={() => setFilter(filterType)} className={`
                    flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                    ${filter === filterType
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
                  `}>
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  {filterType === 'unread' && unreadCount > 0 && (<span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>)}
                </button>))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (<div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading notifications...</p>
              </div>) : filteredNotifications.length === 0 ? (<div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  No {filter === 'all' ? '' : filter} notifications
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications to show'}
                </p>
              </div>) : (<div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredNotifications.map((notification) => (<div key={notification.id} className={`
                      p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                      ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}
                    `}>
                    <div className="flex items-start space-x-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 text-lg mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                              {notification.category && (<>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                                    {notification.category}
                                  </span>
                                </>)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.read && (<button onClick={() => handleMarkAsRead(notification.id)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Mark as read">
                                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                </svg>
                              </button>)}
                            <button onClick={() => handleDelete(notification.id)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Delete notification">
                              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Action Button */}
                        {notification.actionUrl && (<a href={notification.actionUrl} onClick={() => handleMarkAsRead(notification.id)} className="inline-flex items-center space-x-1 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                            <span>{notification.actionText || 'View details'}</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                          </a>)}
                      </div>
                    </div>
                  </div>))}
              </div>)}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <a href="/notifications" className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              View all notifications
            </a>
          </div>
        </div>)}
    </div>);
};
//# sourceMappingURL=NotificationCenter.js.map