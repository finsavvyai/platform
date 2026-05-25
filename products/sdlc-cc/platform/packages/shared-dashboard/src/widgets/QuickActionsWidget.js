/**
 * QuickActionsWidget Component
 * Provides quick access to common actions across all products
 */
import React from 'react';
export const QuickActionsWidget = ({ user, dashboardService, className = '', }) => {
    const quickActions = [
        {
            id: 'new-pipeline',
            title: 'New Pipeline',
            description: 'Create a new CI/CD pipeline',
            icon: '🚀',
            color: 'bg-gradient-to-br from-blue-500 to-blue-600',
            href: '/sdlc/pipelines/new',
            shortcut: '⌘P',
        },
        {
            id: 'ai-chat',
            title: 'AI Assistant',
            description: 'Chat with AI code assistant',
            icon: '🤖',
            color: 'bg-gradient-to-br from-purple-500 to-purple-600',
            href: '/ai/chat',
            badge: 'New',
            shortcut: '⌘A',
        },
        {
            id: 'deploy',
            title: 'Quick Deploy',
            description: 'Deploy to production',
            icon: '⚡',
            color: 'bg-gradient-to-br from-green-500 to-green-600',
            href: '/sdlc/deploy',
            shortcut: '⌘D',
        },
        {
            id: 'api-keys',
            title: 'API Keys',
            description: 'Manage API access keys',
            icon: '🔑',
            color: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
            href: '/settings/api-keys',
        },
        {
            id: 'billing',
            title: 'Billing',
            description: 'View subscription and usage',
            icon: '💳',
            color: 'bg-gradient-to-br from-red-500 to-red-600',
            href: '/billing',
            badge: user?.subscription?.tier,
        },
        {
            id: 'docs',
            title: 'Documentation',
            description: 'Browse documentation',
            icon: '📚',
            color: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
            href: '/docs',
        },
    ];
    const handleActionClick = (action) => {
        console.log(`Executing action: ${action.id}`);
        // In a real implementation, this would navigate to the action URL
        // or trigger the appropriate API call
    };
    return (<div className={`card ${className}`}>
      <div className="card-header">
        <h3 className="font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Frequently used features and shortcuts
        </p>
      </div>

      <div className="card-body">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (<button key={action.id} onClick={() => handleActionClick(action)} className={`
                relative p-4 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 hover:shadow-lg
                transition-all duration-200 hover:scale-105 hover:-translate-y-1
                group cursor-pointer text-left
              `}>
              {/* Badge */}
              {action.badge && (<div className="absolute top-2 right-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                    {action.badge}
                  </span>
                </div>)}

              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg mb-3
                ${action.color}
              `}>
                {action.icon}
              </div>

              {/* Content */}
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {action.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {action.description}
                </p>
              </div>

              {/* Shortcut */}
              {action.shortcut && (<div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                    {action.shortcut}
                  </kbd>
                </div>)}
            </button>))}
        </div>
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Press ⌘K to search for actions
          </div>
          <button onClick={() => console.log('Customize actions')} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            Customize
          </button>
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=QuickActionsWidget.js.map