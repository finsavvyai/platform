/**
 * ActivityFeedWidget Component
 * Displays real-time activity feed across all products
 */
import React, { useState, useEffect } from 'react';
export const ActivityFeedWidget = ({ dashboardService, className = '', }) => {
    const [activities, setActivities] = useState([
        {
            id: '1',
            type: 'deployment',
            title: 'Production Deployment',
            description: 'Successfully deployed frontend-monorepo v2.3.1 to production',
            user: 'John Doe',
            timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
            product: 'sdlc',
            metadata: {
                version: 'v2.3.1',
                environment: 'production',
                duration: '12m 34s',
                repository: 'frontend-monorepo',
            },
            severity: 'medium',
        },
        {
            id: '2',
            type: 'api_call',
            title: 'High API Usage Detected',
            description: 'API gateway handled 5,234 requests in the last hour',
            user: 'System',
            timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
            product: 'pipewarden',
            metadata: {
                requestCount: 5234,
                avgResponseTime: 145,
                errorRate: 0.3,
            },
            severity: 'low',
        },
        {
            id: '3',
            type: 'commit',
            title: 'New Commit Pushed',
            description: 'Pushed commit a1b2c3d4 to main branch with security improvements',
            user: 'Jane Smith',
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            product: 'sdlc',
            metadata: {
                commit: 'a1b2c3d4',
                branch: 'main',
                files: ['src/security/auth.ts', 'tests/auth.test.ts'],
                additions: 45,
                deletions: 12,
            },
            severity: 'low',
        },
        {
            id: '4',
            type: 'security',
            title: 'Security Scan Completed',
            description: 'Weekly security scan completed with 2 minor issues found',
            user: 'Security Bot',
            timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
            product: 'system',
            metadata: {
                scanType: 'weekly',
                issuesFound: 2,
                criticalIssues: 0,
                scanDuration: '3m 12s',
            },
            severity: 'medium',
        },
        {
            id: '5',
            type: 'billing',
            title: 'Payment Processed',
            description: 'Monthly subscription payment of $99.00 processed successfully',
            user: 'System',
            timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
            product: 'billing',
            metadata: {
                amount: 99.00,
                currency: 'USD',
                paymentMethod: 'card',
                invoiceId: 'inv_12345',
            },
            severity: 'low',
        },
        {
            id: '6',
            type: 'user_action',
            title: 'New API Key Created',
            description: 'Generated new API key for production environment access',
            user: 'Bob Johnson',
            timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
            product: 'pipewarden',
            metadata: {
                keyId: 'key_prod_abc123',
                permissions: ['read', 'write'],
                rateLimit: 1000,
            },
            severity: 'low',
        },
    ]);
    const [filter, setFilter] = useState('all');
    const [autoRefresh, setAutoRefresh] = useState(true);
    // Simulate real-time activity updates
    useEffect(() => {
        if (!autoRefresh)
            return;
        const interval = setInterval(() => {
            const eventTypes = ['deployment', 'api_call', 'commit', 'user_action'];
            const products = ['sdlc', 'mcpoverflow', 'pipewarden', 'billing'];
            // Randomly add a new activity (10% chance every 10 seconds)
            if (Math.random() < 0.1) {
                const newActivity = {
                    id: Date.now().toString(),
                    type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
                    title: 'New Activity',
                    description: 'A new activity occurred in the system',
                    user: 'System',
                    timestamp: new Date().toISOString(),
                    product: products[Math.floor(Math.random() * products.length)],
                    severity: 'low',
                };
                setActivities(prev => [newActivity, ...prev].slice(0, 10));
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh]);
    const getActivityIcon = (type) => {
        const icons = {
            deployment: '🚀',
            commit: '📝',
            api_call: '🔌',
            user_action: '👤',
            security: '🛡️',
            billing: '💳',
            system: '⚙️',
        };
        return icons[type];
    };
    const getProductBadge = (product) => {
        const badges = {
            sdlc: { label: 'SDLC', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
            mcpoverflow: { label: 'AI', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
            pipewarden: { label: 'Gateway', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
            billing: { label: 'Billing', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
            system: { label: 'System', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
        };
        return badges[product];
    };
    const getSeverityColor = (severity) => {
        if (!severity)
            return 'border-gray-200 dark:border-gray-700';
        const colors = {
            low: 'border-gray-200 dark:border-gray-700',
            medium: 'border-yellow-200 dark:border-yellow-800',
            high: 'border-red-200 dark:border-red-800',
        };
        return colors[severity];
    };
    const formatRelativeTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        if (diffInMinutes < 1)
            return 'Just now';
        if (diffInMinutes < 60)
            return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24)
            return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };
    const filteredActivities = filter === 'all'
        ? activities
        : activities.filter(activity => activity.type === filter);
    const activityTypes = ['all', ...Array.from(new Set(activities.map(a => a.type)))];
    return (<div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Activity Feed</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time activity across all products
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`
                px-2 py-1 text-xs font-medium rounded transition-colors
                ${autoRefresh
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'}
              `}>
              {autoRefresh ? '🔄' : '⏸️'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 overflow-x-auto">
          {activityTypes.map((type) => (<button key={type} onClick={() => setFilter(type)} className={`
                px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors
                ${filter === type
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
              `}>
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
              {type !== 'all' && (<span className="ml-1.5 text-xs text-gray-500">
                  ({activities.filter(a => a.type === type).length})
                </span>)}
            </button>))}
        </div>
      </div>

      <div className="card-body">
        {filteredActivities.length === 0 ? (<div className="text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-500 dark:text-gray-400">No activities found</p>
          </div>) : (<div className="space-y-3">
            {filteredActivities.map((activity, index) => {
                const productBadge = getProductBadge(activity.product);
                return (<div key={activity.id} className={`
                    flex items-start space-x-3 p-3 border-l-2 bg-gray-50 dark:bg-gray-900 rounded-r-lg
                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                    ${getSeverityColor(activity.severity)}
                    ${index === 0 ? 'border-l-blue-500' : ''}
                  `}>
                  {/* Icon */}
                  <div className="flex-shrink-0 text-lg">
                    {getActivityIcon(activity.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {activity.title}
                      </h4>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${productBadge.color}`}>
                          {productBadge.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {activity.description}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                      <span>by {activity.user}</span>
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (<>
                          <span>•</span>
                          <button onClick={() => console.log('Show details:', activity.metadata)} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                            View details
                          </button>
                        </>)}
                    </div>
                  </div>
                </div>);
            })}
          </div>)}
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredActivities.length} of {activities.length} activities
          </div>
          <button onClick={() => console.log('Load more activities')} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            Load more
          </button>
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=ActivityFeedWidget.js.map