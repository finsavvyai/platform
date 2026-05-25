/**
 * Sidebar Component
 * Provides navigation and quick access to all products and features
 */
import React, { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { SearchBox } from './SearchBox';
export const Sidebar = ({ collapsed, onToggle, layout, className = '', }) => {
    const [activeItem, setActiveItem] = useState('overview');
    const [expandedSections, setExpandedSections] = useState(['products']);
    const { unreadCount } = useNotifications();
    // Mock product data - this would come from DashboardService
    const products = [
        {
            id: 'sdlc',
            name: 'SDLC Pipeline',
            description: 'CI/CD Pipeline Management',
            version: '2.0.0',
            status: 'active',
            healthStatus: {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                responseTime: 124,
                uptime: 99.9,
            },
            icon: '🚀',
            url: '/sdlc',
            features: ['Pipelines', 'Deployments', 'Monitoring'],
        },
        {
            id: 'mcpoverflow',
            name: 'MCPOVERFLOW AI',
            description: 'AI Code Assistant',
            version: '1.0.0',
            status: 'active',
            healthStatus: {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                responseTime: 89,
                uptime: 99.7,
            },
            icon: '🤖',
            url: '/ai',
            features: ['Code Generation', 'Analysis', 'Documentation'],
        },
        {
            id: 'pipewarden',
            name: 'PIPEWARDEN',
            description: 'API Gateway & Security',
            version: '1.0.0',
            status: 'active',
            healthStatus: {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                responseTime: 156,
                uptime: 99.8,
            },
            icon: '🛡️',
            url: '/gateway',
            features: ['API Gateway', 'Security', 'Analytics'],
        },
        {
            id: 'billing',
            name: 'Billing System',
            description: 'Subscription Management',
            version: '1.0.0',
            status: 'active',
            healthStatus: {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                responseTime: 203,
                uptime: 99.9,
            },
            icon: '💳',
            url: '/billing',
            features: ['Subscriptions', 'Payments', 'Analytics'],
        },
    ];
    const navigationItems = [
        {
            id: 'overview',
            label: 'Overview',
            icon: '📊',
            path: '/',
        },
        {
            id: 'products',
            label: 'Products',
            icon: '📦',
            children: products.map(product => ({
                id: product.id,
                label: product.name,
                icon: product.icon,
                path: product.url,
                badge: product.healthStatus?.status === 'healthy' ? '✓' : '⚠️',
            })),
        },
        {
            id: 'search',
            label: 'Search',
            icon: '🔍',
            path: '/search',
        },
        {
            id: 'notifications',
            label: 'Notifications',
            icon: '🔔',
            path: '/notifications',
            badge: unreadCount > 0 ? unreadCount : undefined,
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: '⚙️',
            children: [
                {
                    id: 'profile',
                    label: 'Profile',
                    icon: '👤',
                    path: '/settings/profile',
                },
                {
                    id: 'preferences',
                    label: 'Preferences',
                    icon: '🎨',
                    path: '/settings/preferences',
                },
                {
                    id: 'integrations',
                    label: 'Integrations',
                    icon: '🔗',
                    path: '/settings/integrations',
                },
            ],
        },
    ];
    const toggleSection = (sectionId) => {
        setExpandedSections(prev => prev.includes(sectionId)
            ? prev.filter(id => id !== sectionId)
            : [...prev, sectionId]);
    };
    const handleItemClick = (item) => {
        if (!item.children) {
            setActiveItem(item.id);
        }
        else {
            toggleSection(item.id);
        }
    };
    const renderNavItem = (item, level = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedSections.includes(item.id);
        const isActive = item.id === activeItem;
        const paddingLeft = level * 16 + 16;
        return (<div key={item.id} className="w-full">
        <button onClick={() => handleItemClick(item)} className={`
            w-full flex items-center justify-between px-3 py-2 rounded-lg text-left
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150
            ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
            ${collapsed && level === 0 ? 'justify-center' : ''}
          `} style={{ paddingLeft: collapsed && level === 0 ? '12px' : `${paddingLeft}px` }}>
          <div className="flex items-center space-x-3 min-w-0">
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!collapsed && (<span className="font-medium truncate">{item.label}</span>)}
          </div>

          {!collapsed && (<div className="flex items-center space-x-2 flex-shrink-0">
              {item.badge && (<span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  {item.badge}
                </span>)}
              {hasChildren && (<svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                </svg>)}
            </div>)}
        </button>

        {hasChildren && !collapsed && isExpanded && (<div className="mt-1 space-y-1">
            {item.children.map(child => renderNavItem(child, level + 1))}
          </div>)}
      </div>);
    };
    const renderQuickActions = () => {
        if (collapsed)
            return null;
        const quickActions = [
            { id: 'new-pipeline', label: 'New Pipeline', icon: '➕', color: 'bg-green-500' },
            { id: 'ai-chat', label: 'AI Chat', icon: '💬', color: 'bg-blue-500' },
            { id: 'api-keys', label: 'API Keys', icon: '🔑', color: 'bg-purple-500' },
            { id: 'billing', label: 'Billing', icon: '💳', color: 'bg-yellow-500' },
        ];
        return (<div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(action => (<button key={action.id} className={`
                flex flex-col items-center justify-center p-3 rounded-lg
                bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                hover:shadow-md transition-all duration-200 hover:scale-105
              `}>
              <div className={`w-8 h-8 rounded-full ${action.color} flex items-center justify-center text-white mb-1`}>
                {action.icon}
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">{action.label}</span>
            </button>))}
        </div>
      </div>);
    };
    return (<div className={`
      bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
      flex flex-col transition-all duration-300 ease-in-out
      ${collapsed ? 'w-16' : 'w-64'}
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && (<div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Enterprise</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dashboard</p>
          </div>)}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      {!collapsed && (<div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <SearchBox compact placeholder="Search everything..."/>
        </div>)}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigationItems.map(item => renderNavItem(item))}
      </nav>

      {/* Quick Actions */}
      {renderQuickActions()}

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          {!collapsed && (<span className="text-xs text-gray-500 dark:text-gray-400">All systems operational</span>)}
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=Sidebar.js.map