/**
 * Status Bar Component
 * Provides system status information and theme controls
 */
import React from 'react';
export const StatusBar = ({ user, theme, onThemeChange, className = '', }) => {
    // Mock system status - this would come from real monitoring
    const systemStatus = {
        api: 'operational',
        database: 'operational',
        services: 'operational',
        lastUpdate: new Date().toISOString(),
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'operational':
                return 'bg-green-500';
            case 'degraded':
                return 'bg-yellow-500';
            case 'down':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };
    const getStatusText = (status) => {
        switch (status) {
            case 'operational':
                return 'Operational';
            case 'degraded':
                return 'Degraded';
            case 'down':
                return 'Down';
            default:
                return 'Unknown';
        }
    };
    const handleThemeChange = (newTheme) => {
        onThemeChange(newTheme);
        // Apply theme to document
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        }
        else if (newTheme === 'light') {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
        }
        else {
            // Auto - use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
            }
            else {
                document.documentElement.classList.add('light');
                document.documentElement.classList.remove('dark');
            }
        }
    };
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString();
    };
    const overallStatus = systemStatus.api === 'operational' &&
        systemStatus.database === 'operational' &&
        systemStatus.services === 'operational'
        ? 'operational' :
        systemStatus.api === 'down' ||
            systemStatus.database === 'down' ||
            systemStatus.services === 'down'
            ? 'down' : 'degraded';
    return (<div className={`
      h-8 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800
      flex items-center justify-between px-4 text-xs text-gray-600 dark:text-gray-400
      ${className}
    `}>
      {/* Left Side - System Status */}
      <div className="flex items-center space-x-4">
        {/* Overall Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(overallStatus)} ${overallStatus === 'operational' ? 'animate-pulse' : ''}`}></div>
          <span className="font-medium">
            {getStatusText(overallStatus)}
          </span>
        </div>

        {/* Individual Services */}
        <div className="hidden sm:flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(systemStatus.api)}`}></div>
            <span>API</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(systemStatus.database)}`}></div>
            <span>DB</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(systemStatus.services)}`}></div>
            <span>Services</span>
          </div>
        </div>

        {/* Last Update */}
        <div className="hidden md:block text-gray-500 dark:text-gray-500">
          Updated: {formatDate(systemStatus.lastUpdate)}
        </div>
      </div>

      {/* Right Side - Controls */}
      <div className="flex items-center space-x-4">
        {/* Environment Indicator */}
        <div className="hidden sm:flex items-center space-x-1">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
          <span className="font-medium text-blue-600 dark:text-blue-400">Production</span>
        </div>

        {/* Version */}
        <div className="hidden lg:block">
          v2.0.0
        </div>

        {/* Theme Selector */}
        <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
          <button onClick={() => handleThemeChange('light')} className={`
              px-2 py-0.5 rounded text-xs font-medium transition-colors
              ${theme === 'light'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}
            `} title="Light theme">
            ☀️
          </button>
          <button onClick={() => handleThemeChange('dark')} className={`
              px-2 py-0.5 rounded text-xs font-medium transition-colors
              ${theme === 'dark'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}
            `} title="Dark theme">
            🌙
          </button>
          <button onClick={() => handleThemeChange('auto')} className={`
              px-2 py-0.5 rounded text-xs font-medium transition-colors
              ${theme === 'auto'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}
            `} title="Auto theme">
            🌗
          </button>
        </div>

        {/* User Info */}
        {user && (<div className="hidden sm:flex items-center space-x-2 text-gray-500 dark:text-gray-500">
            <span>{user.name}</span>
            <span>•</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {user.subscription?.tier || 'Free'}
            </span>
          </div>)}
      </div>
    </div>);
};
//# sourceMappingURL=StatusBar.js.map