import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import RunsPage from './pages/RunsPage';
import RunDetailPage from './pages/RunDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RunnersPage from './pages/RunnersPage';
import ChatPage from './pages/ChatPage';
import ArtifactsPage from './pages/ArtifactsPage';
import BillingPage from './pages/BillingPage';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<LoginPage onLogin={login} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<Layout user={user} onLogout={logout} />}>
        <Route path="/" element={<Navigate to="/runs" replace />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/runners" element={<RunnersPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
