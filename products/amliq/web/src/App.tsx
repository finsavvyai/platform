import React, { Suspense, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useDirection } from './hooks/useDirection'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LogoGradientDefs } from './components/brand/Logo'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import PublicLayout from './components/layout/PublicLayout'
import { PageLoader } from './components/ui/PageLoader'
import { NetworkStatusBanner } from './components/ui/NetworkStatusBanner'
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal'
import { appRoutes } from './routes/appRoutes'
import { complianceRoutes } from './routes/compliance'
import { platformRoutes } from './routes/platform'

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  </ProtectedRoute>
)

const PageFallback = () => <PageLoader />

function App() {
  useDirection()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useKeyboardShortcuts([
    {
      key: '?',
      handler: () => setShortcutsOpen(prev => !prev),
      description: 'Toggle keyboard shortcuts help',
    },
  ])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LogoGradientDefs />
        <AuthProvider>
          <ToastProvider>
            <NetworkStatusBanner />
            <KeyboardShortcutsModal
              open={shortcutsOpen}
              onClose={() => setShortcutsOpen(false)}
            />
            <Router>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {appRoutes(P, PublicLayout)}
                {complianceRoutes(P)}
                {platformRoutes(P)}
              </Routes>
            </Suspense>
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
