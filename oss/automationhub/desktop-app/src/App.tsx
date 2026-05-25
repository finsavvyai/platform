import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';

import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Monitoring } from './pages/Monitoring';
import { Deployments } from './pages/Deployments';
import { Settings } from './pages/Settings';
import { QuickDeploy } from './pages/QuickDeploy';

import { useNotificationStore } from './store/notifications';
import { useAppStore } from './store/app';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  const { addNotification } = useNotificationStore();
  const { setOnline, setAppVersion } = useAppStore();

  useEffect(() => {
    // Listen for navigation events from system tray
    const unlistenNavigate = listen('navigate', (event) => {
      const path = event.payload as string;
      window.location.hash = path;
    });

    // Listen for system notifications
    const unlistenNotification = listen('system-notification', (event) => {
      const notification = event.payload as {
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
      };
      addNotification(notification);
    });

    // Check online status
    const checkOnlineStatus = () => {
      setOnline(navigator.onLine);
    };

    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);
    checkOnlineStatus();

    // Get app version
    import('@tauri-apps/api/app').then(({ getVersion }) => {
      getVersion().then(setAppVersion);
    });

    return () => {
      unlistenNavigate.then((fn) => fn());
      unlistenNotification.then((fn) => fn());
      window.removeEventListener('online', checkOnlineStatus);
      window.removeEventListener('offline', checkOnlineStatus);
    };
  }, [addNotification, setOnline, setAppVersion]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <AnimatePresence mode="wait">
            <Routes>
              {/* Quick Deploy modal window */}
              <Route path="/quick-deploy" element={<QuickDeploy />} />

              {/* Main application routes */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/new" element={<Projects showCreateForm />} />
                <Route path="monitoring" element={<Monitoring />} />
                <Route path="deployments" element={<Deployments />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </AnimatePresence>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;