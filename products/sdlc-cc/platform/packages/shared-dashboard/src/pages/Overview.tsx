/**
 * Overview Page Component
 * Main dashboard overview with system status and quick access widgets
 */

import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
import { SystemStatusWidget } from '../widgets/SystemStatusWidget';
import { QuickActionsWidget } from '../widgets/QuickActionsWidget';
import { RecentPipelinesWidget } from '../widgets/RecentPipelinesWidget';
import { MetricsOverviewWidget } from '../widgets/MetricsOverviewWidget';
import { NotificationsWidget } from '../widgets/NotificationsWidget';
import { ActivityFeedWidget } from '../widgets/ActivityFeedWidget';

interface OverviewProps {
  user?: User;
  dashboardService: DashboardService;
}

export const Overview: React.FC<OverviewProps> = ({ user, dashboardService }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here's what's happening across your enterprise platform
          </p>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current time</div>
          <div className="text-lg font-medium text-gray-900 dark:text-white">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1 - 4 columns wide */}
        <div className="lg:col-span-4 space-y-6">
          <SystemStatusWidget dashboardService={dashboardService} />
          <QuickActionsWidget user={user} dashboardService={dashboardService} />
        </div>

        {/* Column 2 - 8 columns wide */}
        <div className="lg:col-span-8 space-y-6">
          <RecentPipelinesWidget dashboardService={dashboardService} />
          <MetricsOverviewWidget dashboardService={dashboardService} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NotificationsWidget user={user} dashboardService={dashboardService} />
        <ActivityFeedWidget dashboardService={dashboardService} />
      </div>
    </div>
  );
};