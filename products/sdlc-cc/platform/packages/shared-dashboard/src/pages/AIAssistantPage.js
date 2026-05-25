/**
 * AI Assistant Page Component
 * Interface for MCPOVERFLOW AI code assistant
 */
import React from 'react';
export const AIAssistantPage = ({ user, dashboardService }) => {
    return (<div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          AI Code Assistant
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Get AI-powered code generation, analysis, and debugging assistance
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🤖</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          MCPOVERFLOW AI Assistant
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          AI-powered development tools and code analysis interface
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          Features: Code generation, bug detection, documentation, optimization suggestions
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=AIAssistantPage.js.map