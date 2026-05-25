/**
 * Main App Component
 * Root component for the unified dashboard application
 */

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardService } from './services/DashboardService';
import { Overview } from './pages/Overview';
import { PipelinesPage } from './pages/PipelinesPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { APIGatewayPage } from './pages/APIGatewayPage';
import { BillingPage } from './pages/BillingPage';
import { SearchPage } from './pages/SearchPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { User, DashboardLayout as DashboardLayoutType } from './types';

interface AppState {
  user?: User;
  layout: DashboardLayoutType;
  currentPage: string;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    user: {
      id: 'user_123',
      name: 'John Doe',
      email: 'john.doe@company.com',
      avatar: undefined,
      role: 'admin',
      subscription: {
        tier: 'Pro',
        status: 'active',
        renewsAt: '2024-02-15T00:00:00Z',
        cancelled: false,
      },
      preferences: {
        theme: 'auto',
        language: 'en',
        timezone: 'UTC',
        emailNotifications: true,
        pushNotifications: true,
        dashboardLayout: 'default',
      },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      lastLoginAt: '2024-01-15T09:00:00Z',
    },
    layout: {
      id: 'default',
      name: 'Default Layout',
      columns: [
        {
          id: 'col-1',
          width: 1,
          widgets: [
            { id: 'system-status', type: 'system-status', title: 'System Status', column: 'col-1', order: 0 },
            { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', column: 'col-1', order: 1 },
          ],
        },
        {
          id: 'col-2',
          width: 2,
          widgets: [
            { id: 'recent-pipelines', type: 'recent-pipelines', title: 'Recent Pipelines', column: 'col-2', order: 0 },
            { id: 'metrics-overview', type: 'metrics-overview', title: 'Metrics Overview', column: 'col-2', order: 1 },
          ],
        },
        {
          id: 'col-3',
          width: 1,
          widgets: [
            { id: 'notifications', type: 'notifications', title: 'Recent Notifications', column: 'col-3', order: 0 },
            { id: 'activity-feed', type: 'activity-feed', title: 'Activity Feed', column: 'col-3', order: 1 },
          ],
        },
      ],
      theme: 'auto',
      sidebar: {
        collapsed: false,
        pinnedItems: ['overview', 'pipelines'],
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
    },
    currentPage: 'overview',
  });

  const [dashboardService] = useState(() => new DashboardService({
    apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:8787',
    timeout: 30000,
    retries: 3,
    cacheEnabled: true,
    refreshInterval: 30000,
  }));

  // Initialize dashboard service
  useEffect(() => {
    const initializeDashboard = async (): Promise<(() => void) | undefined> => {
      try {
        // Start real-time data refresh
        dashboardService.startRealTimeRefresh();

        // Subscribe to real-time updates
        const unsubscribeLayout = dashboardService.subscribe('layout-updated', (layout) => {
          setState(prev => ({ ...prev, layout: layout as AppState['layout'] }));
        });

        const unsubscribeNotifications = dashboardService.subscribe('notifications-updated', () => {
          // Trigger notification refresh if needed
          console.log('Notifications updated');
        });

        // Cleanup on unmount
        return () => {
          unsubscribeLayout();
          unsubscribeNotifications();
          dashboardService.stopRealTimeRefresh();
        };
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        return undefined;
      }
    };

    const cleanup = initializeDashboard();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [dashboardService]);

  // Handle layout changes
  const handleLayoutChange = (layoutUpdates: Partial<DashboardLayoutType>) => {
    setState(prev => ({
      ...prev,
      layout: { ...prev.layout, ...layoutUpdates }
    }));
  };

  // Get current page component
  const getCurrentPageComponent = () => {
    switch (state.currentPage) {
      case 'overview':
        return <Overview user={state.user} dashboardService={dashboardService} />;
      case 'pipelines':
        return <PipelinesPage user={state.user} dashboardService={dashboardService} />;
      case 'ai-assistant':
        return <AIAssistantPage user={state.user} dashboardService={dashboardService} />;
      case 'api-gateway':
        return <APIGatewayPage user={state.user} dashboardService={dashboardService} />;
      case 'billing':
        return <BillingPage user={state.user} dashboardService={dashboardService} />;
      case 'search':
        return <SearchPage user={state.user} dashboardService={dashboardService} />;
      case 'notifications':
        return <NotificationsPage user={state.user} dashboardService={dashboardService} />;
      case 'settings':
        return <SettingsPage user={state.user} dashboardService={dashboardService} />;
      default:
        return <Overview user={state.user} dashboardService={dashboardService} />;
    }
  };

  return (
    <div className="App">
      <DashboardLayout
        user={state.user}
        layout={state.layout}
        onLayoutChange={handleLayoutChange}
      >
        {getCurrentPageComponent()}
      </DashboardLayout>
    </div>
  );
};

export default App;