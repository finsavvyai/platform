import { Suspense, lazy, useState, type ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Sidebar, Header } from './components/layout';
import ShareModal from './components/ShareModal';
import ChatWidget from './components/ChatWidget';
import { OnboardingGuide } from './components/onboarding/OnboardingGuide';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
import ReleaseGatePage from './pages/ReleaseGatePage';
import { getBlockedRouteLabel, isBlockedReleaseRoute } from './config/release';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const TestCases = lazy(() => import('./pages/TestCases'));
const TestPlans = lazy(() => import('./pages/TestPlans'));
const Cycles = lazy(() => import('./pages/Cycles'));
const CycleDetail = lazy(() => import('./pages/CycleDetail'));
const Runs = lazy(() => import('./pages/Runs'));
const Insights = lazy(() => import('./pages/Insights'));
const Settings = lazy(() => import('./pages/Settings'));
const Stories = lazy(() => import('./pages/Stories'));
const Billing = lazy(() => import('./pages/Billing'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const SSOCallbackPage = lazy(() => import('./pages/SSOCallbackPage'));
const OAuthCallback = lazy(() => import('./pages/auth/OAuthCallback'));
const RecordingStudio = lazy(() => import('./pages/RecordingStudio'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const Automations = lazy(() => import('./pages/Automations'));
const CloudDeviceHub = lazy(() => import('./pages/CloudDeviceHub'));
const APIStudio = lazy(() => import('./pages/APIStudio'));
const AgentDepartmentHub = lazy(() => import('./pages/AgentDepartmentHub'));
const MissionControl = lazy(() => import('./pages/MissionControl'));
const ServiceVirtualization = lazy(() => import('./pages/ServiceVirtualization'));
const AIRecorder = lazy(() => import('./pages/AIRecorder'));
const AICommandCenter = lazy(() => import('./pages/AICommandCenter'));
const TestGenStudio = lazy(() => import('./pages/TestGenStudio'));
const Explorations = lazy(() => import('./pages/Explorations'));
const VibePilot = lazy(() => import('./pages/VibePilot'));
const VisualRegression = lazy(() => import('./pages/VisualRegression'));
const Recorder = lazy(() => import('./pages/Recorder'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const VsCypress = lazy(() => import('./pages/vs/VsCypress'));
const VsPlaywright = lazy(() => import('./pages/vs/VsPlaywright'));
const VsTestim = lazy(() => import('./pages/vs/VsTestim'));

const authPaths = new Set(['/login', '/register', '/signup', '/forgot-password', '/auth/sso/callback', '/auth/callback']);
const publicPaths = new Set(['/privacy', '/terms', '/vs/cypress', '/vs/playwright', '/vs/testim']);

const AuthFallback = () => (
  <div
    className="flex min-h-screen items-center justify-center px-6 text-sm"
    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
  >
    Loading authentication...
  </div>
);

const WorkspaceFallback = () => (
  <div
    className="flex h-full min-h-[320px] items-center justify-center px-6 text-sm"
    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
  >
    Loading workspace...
  </div>
);

const resolveRouteElement = (path: string, element?: ReactElement) => {
  if (!element || isBlockedReleaseRoute(path)) {
    return <ReleaseGatePage feature={getBlockedRouteLabel(path)} />;
  }

  return element;
};

const AppContent = () => {
  const location = useLocation();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Check if current page is auth or public page
  const isAuthPage = authPaths.has(location.pathname);
  const isPublicPage = publicPaths.has(location.pathname);

  // Determine title based on path
  const getTitle = (path: string) => {
    if (isBlockedReleaseRoute(path)) return getBlockedRouteLabel(path);
    if (path === '/') return 'Dashboard';
    if (path === '/insights') return 'Insights';
    if (path === '/plans') return 'Test Plans';
    if (path === '/cycles' || path.startsWith('/cycles/')) return 'Test Cycles';
    if (path === '/stories') return 'Stories';
    if (path === '/cases') return 'Test Cases';
    if (path === '/runs') return 'Test Runs';
    if (path === '/explorations') return 'Explorations';
    if (path === '/automation-runs') return 'Automation Runs';
    if (path === '/cloud-devices') return 'Cloud Device Hub';
    if (path.startsWith('/studio') || path.startsWith('/api-studio')) return 'API Studio';
    if (path === '/security') return 'Security Center';
    if (path === '/compliance') return 'Compliance Hub';
    if (path === '/agents') return 'Agent Department';
    if (path === '/mission-control') return 'Mission Control';
    if (path === '/service-virtualization') return 'Service Virtualization';
    if (path === '/ai-recorder') return 'AI Step Recorder';
    if (path === '/ai-center') return 'AI Command Center';
    if (path === '/test-gen') return 'Test Generator Studio';
    if (path === '/recording-studio') return 'Recording Studio';
    if (path === '/vibe-pilot') return 'Vibe Test Pilot';
    if (path === '/visual-regression') return 'Visual Regression';
    if (path === '/recorder') return 'Test Recorder';
    if (path === '/notifications') return 'Smart Notifications';
    if (path === '/channels') return 'Channels';
    switch (path) {
      case '/settings':
        return 'Settings';
      case '/billing':
        return 'Billing & Subscription';
      case '/integrations':
        return 'Ecosystem';
      default:
        return 'Dashboard';
    }
  };

  if (isPublicPage) {
    return (
      <Suspense fallback={<AuthFallback />}>
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/vs/cypress" element={<VsCypress />} />
          <Route path="/vs/playwright" element={<VsPlaywright />} />
          <Route path="/vs/testim" element={<VsTestim />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    );
  }

  if (isAuthPage) {
    return (
      <Suspense fallback={<AuthFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<SignupPage />} />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/sso/callback" element={<SSOCallbackPage />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <ProtectedRoute>
      <div
        className="flex min-h-screen transition-colors duration-300"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <Sidebar />
        <main
          className="flex-1 flex flex-col min-h-screen overflow-hidden md:pl-72 transition-all duration-300"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <Header
            title={getTitle(location.pathname)}
            onShare={() => setIsShareModalOpen(true)}
          />
          <div
            className="flex-1 overflow-y-auto transition-colors duration-300"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <Suspense fallback={<WorkspaceFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/insights" element={resolveRouteElement('/insights', <Insights />)} />
                <Route path="/plans" element={resolveRouteElement('/plans', <TestPlans />)} />
                <Route path="/cycles" element={resolveRouteElement('/cycles', <Cycles />)} />
                <Route path="/cycles/:id" element={resolveRouteElement('/cycles/:id', <CycleDetail />)} />
                <Route path="/cases" element={<TestCases />} />
                <Route path="/stories" element={resolveRouteElement('/stories', <Stories />)} />
                <Route path="/runs" element={<Runs />} />
                <Route path="/explorations" element={<Explorations />} />
                <Route path="/automation-runs" element={<Automations />} />
                <Route path="/cloud-devices" element={<CloudDeviceHub />} />
                <Route path="/studio" element={resolveRouteElement('/studio')} />
                <Route path="/api-studio" element={<APIStudio />} />
                <Route path="/security" element={resolveRouteElement('/security')} />
                <Route path="/compliance" element={resolveRouteElement('/compliance')} />
                <Route path="/agents" element={<AgentDepartmentHub />} />
                <Route path="/mission-control" element={<MissionControl />} />
                <Route path="/service-virtualization" element={<ServiceVirtualization />} />
                <Route path="/ai-recorder" element={<AIRecorder />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/integrations" element={resolveRouteElement('/integrations')} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/ai-center" element={<AICommandCenter />} />
                <Route path="/test-gen" element={<TestGenStudio />} />
                <Route path="/recording-studio" element={<RecordingStudio />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/vibe-pilot" element={<VibePilot />} />
                <Route path="/visual-regression" element={<VisualRegression />} />
                <Route path="/recorder" element={<Recorder />} />
                <Route path="/notifications" element={resolveRouteElement('/notifications')} />
                <Route path="/channels" element={resolveRouteElement('/channels')} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
          />
          <ChatWidget />
          <OnboardingGuide />
        </main>
      </div>
    </ProtectedRoute>
  );
};

function App() {
  return (
    <ThemeProvider>
      <OnboardingProvider>
        <ProjectProvider>
          <Router>
            <AppContent />
          </Router>
        </ProjectProvider>
      </OnboardingProvider>
    </ThemeProvider>
  );
}

export default App;
