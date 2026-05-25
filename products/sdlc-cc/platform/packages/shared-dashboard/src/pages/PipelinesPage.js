/**
 * Pipelines Page Component
 * Manages CI/CD pipelines and deployments
 */
import React from 'react';
export const PipelinesPage = ({ user, dashboardService }) => {
    return (<div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          CI/CD Pipelines
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your continuous integration and deployment pipelines
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🚀</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Pipeline Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Comprehensive pipeline management interface will be implemented here
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          Features: Pipeline execution, status monitoring, log viewing, configuration management
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=PipelinesPage.js.map