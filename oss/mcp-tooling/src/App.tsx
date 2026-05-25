import { BrowserRouter, Routes, Route, useEffect } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { Generate } from './pages/Generate'
import { ConnectorDetail } from './pages/ConnectorDetail'
import { Settings } from './pages/Settings'
import { applySecurityHeaders, CSRFProtection } from './lib/security'

function App() {
  // Initialize security features on app startup
  useEffect(() => {
    // Apply security headers
    applySecurityHeaders()

    // Initialize CSRF token
    CSRFProtection.getToken()

    // Cleanup on unmount
    return () => {
      // Any cleanup if needed
    }
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/generate"
                element={
                  <ProtectedRoute>
                    <Generate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/connector/:id"
                element={
                  <ProtectedRoute>
                    <ConnectorDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Layout>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
