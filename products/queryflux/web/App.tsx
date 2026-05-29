import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/Toaster';
import { Layout } from './components/layout/Layout';
import { EnhancedDashboardPage } from './pages/EnhancedDashboardPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { EnhancedQueryEditorPage } from './pages/EnhancedQueryEditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { authAPI } from './services/api';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  const [authed, setAuthed] = useState(() => authAPI.isAuthenticated());

  function handleLogin() {
    setAuthed(true);
    queryClient.invalidateQueries();
  }

  function handleLogout() {
    authAPI.logout();
    setAuthed(false);
    queryClient.clear();
  }

  if (!authed) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginPage onLogin={handleLogin} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<EnhancedDashboardPage />} />
            <Route path="connections" element={<ConnectionsPage />} />
            <Route path="query" element={<EnhancedQueryEditorPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>

      <Toaster />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
