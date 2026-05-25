import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import AITestGenerationPage from './pages/AITestGenerationPage';
import RecordingStudio from './pages/RecordingStudio';
import APIManagementPage from './pages/APIManagementPage';
import PerformanceTestingLandingPage from './pages/PerformanceTestingLandingPage';
import DataTestingPage from './pages/DataTestingPage';
import ReportsPage from './pages/ReportsPage';
import ScheduledTestsPage from './pages/ScheduledTestsPage';
import DataSourcesPage from './pages/DataSourcesPage';
import Pricing from './pages/Pricing';
import FeaturesPage from './pages/FeaturesPage';

// Layout Components
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Error Boundary
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
          <Navbar />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route 
              path="/login" 
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
            />
            <Route 
              path="/signup" 
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignupPage />} 
            />

            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            
            <Route path="/recording-studio" element={
              <ProtectedRoute>
                <RecordingStudio />
              </ProtectedRoute>
            } />
            
            <Route path="/ai-test-generation" element={
              <ProtectedRoute>
                <AITestGenerationPage />
              </ProtectedRoute>
            } />
            
            <Route path="/api-management" element={
              <ProtectedRoute>
                <APIManagementPage />
              </ProtectedRoute>
            } />
            
            <Route path="/performance-testing" element={
              <ProtectedRoute>
                <PerformanceTestingLandingPage />
              </ProtectedRoute>
            } />
            
            <Route path="/data-testing" element={
              <ProtectedRoute>
                <DataTestingPage />
              </ProtectedRoute>
            } />
            
            <Route path="/reports" element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/scheduled-tests" element={
              <ProtectedRoute>
                <ScheduledTestsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/data-sources" element={
              <ProtectedRoute>
                <DataSourcesPage />
              </ProtectedRoute>
            } />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;