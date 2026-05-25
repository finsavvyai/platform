/**
 * UserMenu Component
 * Provides user profile management and quick actions
 */
import React, { useEffect, useRef } from 'react';
export const UserMenu = ({ open, onToggle, user, className = '', }) => {
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
    const handleSignOut = () => {
        // Implementation for sign out
        console.log('Signing out...');
        onToggle();
    };
    const menuItems = [
        {
            id: 'profile',
            label: 'Profile',
            icon: '👤',
            description: 'Manage your personal information',
            href: '/settings/profile',
        },
        {
            id: 'preferences',
            label: 'Preferences',
            icon: '🎨',
            description: 'Customize your dashboard experience',
            href: '/settings/preferences',
        },
        {
            id: 'integrations',
            label: 'Integrations',
            icon: '🔗',
            description: 'Manage third-party integrations',
            href: '/settings/integrations',
        },
        {
            id: 'api-keys',
            label: 'API Keys',
            icon: '🔑',
            description: 'Manage your API access keys',
            href: '/settings/api-keys',
        },
        {
            id: 'billing',
            label: 'Billing & Subscription',
            icon: '💳',
            description: 'View and manage your subscription',
            badge: user?.subscription?.tier || 'Free',
            href: '/billing',
        },
        {
            id: 'documentation',
            label: 'Documentation',
            icon: '📚',
            description: 'Get help and learn about features',
            href: '/docs',
        },
        {
            id: 'support',
            label: 'Support',
            icon: '💬',
            description: 'Contact our support team',
            href: '/support',
        },
        {
            id: 'divider-1',
            label: '',
            icon: '',
            separator: true,
        },
        {
            id: 'sign-out',
            label: 'Sign Out',
            icon: '🚪',
            description: 'Sign out of your account',
            danger: true,
            onClick: handleSignOut,
        },
    ];
    const getInitials = (name) => {
        if (!name)
            return 'U';
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };
    const getSubscriptionColor = (tier) => {
        const colors = {
            free: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
            starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
            enterprise: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        };
        return colors[tier?.toLowerCase()] || colors.free;
    };
    const renderMenuItem = (item) => {
        if ('separator' in item) {
            return (<div key={item.id} className="border-t border-gray-200 dark:border-gray-700 my-2"></div>);
        }
        const content = (<>
        <div className="flex items-center space-x-3">
          <span className="text-lg flex-shrink-0">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`font-medium ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {item.label}
              </span>
              {item.badge && (<span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSubscriptionColor(item.badge)}`}>
                  {item.badge}
                </span>)}
            </div>
            {item.description && (<p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {item.description}
              </p>)}
          </div>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </>);
        if (item.href) {
            return (<a key={item.id} href={item.href} className={`
            block px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700
            transition-colors duration-150
          `} onClick={onToggle}>
          {content}
        </a>);
        }
        return (<button key={item.id} onClick={item.onClick} className={`
          w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700
          transition-colors duration-150
        `}>
        {content}
      </button>);
    };
    return (<div className={`relative ${className}`}>
      {/* User Avatar Button */}
      <button onClick={onToggle} className={`
          flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors duration-150 group
          ${open ? 'bg-gray-100 dark:bg-gray-700' : ''}
        `}>
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
          {user?.avatar ? (<img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover"/>) : (getInitials(user?.name))}
        </div>

        {/* User Info - Hidden on mobile */}
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200">
            {user?.name || 'Guest User'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {user?.email || 'guest@example.com'}
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {open && (<div ref={dropdownRef} className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
          {/* User Info Header */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-medium shadow-md">
                {user?.avatar ? (<img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover"/>) : (getInitials(user?.name))}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name || 'Guest User'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {user?.email || 'guest@example.com'}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSubscriptionColor(user?.subscription?.tier)}`}>
                    {user?.subscription?.tier || 'Free'} Plan
                  </span>
                  {user?.subscription?.status === 'active' && (<span className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span>Active</span>
                    </span>)}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {user && (<div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {/* This would come from user stats */}
                    12
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Pipelines</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {/* This would come from user stats */}
                    47
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">API Calls</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {/* This would come from user stats */}
                    99.9%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Uptime</div>
                </div>
              </div>
            </div>)}

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map(renderMenuItem)}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Version 2.0.0</span>
              <div className="flex items-center space-x-1">
                <a href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300">Privacy</a>
                <span>•</span>
                <a href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300">Terms</a>
              </div>
            </div>
          </div>
        </div>)}
    </div>);
};
//# sourceMappingURL=UserMenu.js.map