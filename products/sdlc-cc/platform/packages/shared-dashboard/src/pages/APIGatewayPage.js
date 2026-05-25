/**
 * API Gateway Page Component
 * Manages PIPEWARDEN API gateway configuration and monitoring
 */
import React from 'react';
export const APIGatewayPage = ({ user, dashboardService }) => {
    return (<div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          API Gateway
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage PIPEWARDEN API gateway, security, and traffic routing
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🛡️</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          PIPEWARDEN API Gateway
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Enterprise-grade API gateway management interface
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          Features: Route management, security policies, rate limiting, analytics
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=APIGatewayPage.js.map