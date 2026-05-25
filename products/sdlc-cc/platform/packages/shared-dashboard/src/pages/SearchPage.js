/**
 * Search Page Component
 * Advanced search interface for all products and data
 */
import React from 'react';
export const SearchPage = ({ user, dashboardService }) => {
    return (<div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Global Search
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Search across all products, pipelines, documentation, and data
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Enterprise Search
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Advanced search capabilities across all enterprise platforms
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          Features: Cross-product search, filters, advanced queries, saved searches
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=SearchPage.js.map