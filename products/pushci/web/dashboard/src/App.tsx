import { Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import OverviewPage from './pages/OverviewPage';
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
import CliAuthPage from './pages/CliAuthPage';
import ChannelsPage from './pages/ChannelsPage';
import SkillMarketPage from './pages/SkillMarketPage';
import TeamPage from './pages/TeamPage';
import AuditLogPage from './pages/AuditLogPage';
import MfaEnrollmentPage from './pages/MfaEnrollmentPage';
import SsoSetupPage from './pages/SsoSetupPage';
import AchievementsPage from './pages/AchievementsPage';
import GitLabImporterPage from './pages/GitLabImporterPage';
import BitbucketImporterPage from './pages/BitbucketImporterPage';
import GitHubActionsImporterPage from './pages/GitHubActionsImporterPage';
import GerritPage from './pages/GerritPage';
import CompanyRegistriesPage from './pages/CompanyRegistriesPage';
import ProjectEnvironmentsPage from './pages/ProjectEnvironmentsPage';
import EnterpriseDashboardPage from './pages/EnterpriseDashboardPage';
import MigrationWizardPage from './pages/MigrationWizardPage';
import { ToastProvider } from './components/Toast';
import { BadgeToastProvider } from './components/BadgeToast';
import PlanProvider from './components/PlanProvider';
import OnboardingWizard from './components/OnboardingWizard';
import { useOnboarding } from './hooks/useOnboarding';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

function OnboardingOverlay({ userName }: { userName: string }) {
  const { showOnboarding, dismissOnboarding, step, setStep } = useOnboarding();
  if (!showOnboarding) return null;
  return (
    <OnboardingWizard
      userName={userName}
      step={step}
      setStep={setStep}
      onDismiss={dismissOnboarding}
    />
  );
}

function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-surface bg-mesh-animated flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div
          aria-hidden="true"
          className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin"
        />
        <span className="text-sm text-zinc-500 animate-pulse-glow">Loading PushCI…</span>
      </div>
    </div>
  );
}

export default function App() {
  const {
    user, loading, error, providers,
    loginWithGitHub, loginWithGitLab, loginWithGoogle,
    loginWithLinkedIn, loginWithFacebook, loginWithBitbucket,
    loginWithMicrosoft, logout,
  } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/cli-auth" element={<CliAuthPage />} />
        <Route
          path="*"
          element={
            <LoginPage
              onGitHubLogin={loginWithGitHub}
              onGitLabLogin={loginWithGitLab}
              onGoogleLogin={loginWithGoogle}
              onLinkedInLogin={loginWithLinkedIn}
              onFacebookLogin={loginWithFacebook}
              onBitbucketLogin={loginWithBitbucket}
              onMicrosoftLogin={loginWithMicrosoft}
              providers={providers}
              error={error}
            />
          }
        />
      </Routes>
    );
  }

  return (
    <PlanProvider>
    <ToastProvider>
    <BadgeToastProvider>
      <OfflineBanner />
      <ErrorBoundary>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/cli-auth" element={<CliAuthPage />} />
          <Route element={<Layout user={user} onLogout={logout} />}>
            <Route path="/" element={<RouteBoundary><OverviewPage /></RouteBoundary>} />
            <Route path="/runs" element={<RouteBoundary><RunsPage /></RouteBoundary>} />
            <Route path="/runs/:runId" element={<RouteBoundary><RunDetailPage /></RouteBoundary>} />
            <Route path="/projects" element={<RouteBoundary><ProjectsPage /></RouteBoundary>} />
            <Route path="/analytics" element={<RouteBoundary><AnalyticsPage /></RouteBoundary>} />
            <Route path="/runners" element={<RouteBoundary><RunnersPage /></RouteBoundary>} />
            <Route path="/chat" element={<RouteBoundary><ChatPage /></RouteBoundary>} />
            <Route path="/artifacts" element={<RouteBoundary><ArtifactsPage /></RouteBoundary>} />
            <Route path="/billing" element={<RouteBoundary><BillingPage /></RouteBoundary>} />
            <Route path="/channels" element={<RouteBoundary><ChannelsPage /></RouteBoundary>} />
            <Route path="/skills" element={<RouteBoundary><SkillMarketPage /></RouteBoundary>} />
            <Route path="/team" element={<RouteBoundary><TeamPage /></RouteBoundary>} />
            <Route path="/audit" element={<RouteBoundary><AuditLogPage /></RouteBoundary>} />
            <Route path="/security/mfa" element={<RouteBoundary><MfaEnrollmentPage /></RouteBoundary>} />
            <Route path="/security/sso" element={<RouteBoundary><SsoSetupPage /></RouteBoundary>} />
            <Route path="/achievements" element={<RouteBoundary><AchievementsPage /></RouteBoundary>} />
            <Route path="/gitlab" element={<RouteBoundary><GitLabImporterPage /></RouteBoundary>} />
            <Route path="/bitbucket" element={<RouteBoundary><BitbucketImporterPage /></RouteBoundary>} />
            <Route path="/github-actions" element={<RouteBoundary><GitHubActionsImporterPage /></RouteBoundary>} />
            <Route path="/gerrit" element={<RouteBoundary><GerritPage /></RouteBoundary>} />
            <Route path="/registries" element={<RouteBoundary><CompanyRegistriesPage /></RouteBoundary>} />
            <Route path="/projects/:projectId/environments" element={<RouteBoundary><ProjectEnvironmentsPage /></RouteBoundary>} />
            <Route path="/enterprise" element={<RouteBoundary><EnterpriseDashboardPage /></RouteBoundary>} />
            <Route path="/migrate" element={<RouteBoundary><MigrationWizardPage /></RouteBoundary>} />
            <Route path="/settings" element={<RouteBoundary><SettingsPage /></RouteBoundary>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ErrorBoundary>
      <OnboardingOverlay userName={user.name || user.login} />
    </BadgeToastProvider>
    </ToastProvider>
    </PlanProvider>
  );
}

function RouteBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
