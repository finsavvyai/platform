/**
 * Settings Page Component
 * User preferences and account settings
 */

import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';

interface SettingsPageProps {
  user?: User;
  dashboardService: DashboardService;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user: _user, dashboardService: _dashboardService }) => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account, preferences, and integrations
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">⚙️</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Account Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Comprehensive settings and preference management
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          Features: Profile management, preferences, integrations, API keys, security
        </div>
      </div>
    </div>
  );
};