import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Simple placeholder components for each route
const Dashboard = () => <div className="p-8"><h1 className="text-2xl font-bold">Dashboard</h1><p>Main dashboard view</p></div>
const FraudDetection = () => <div className="p-8"><h1 className="text-2xl font-bold">Fraud Detection</h1><p>Fraud detection interface</p></div>
const Analytics = () => <div className="p-8"><h1 className="text-2xl font-bold">Analytics</h1><p>Analytics and reporting</p></div>
const SystemHealth = () => <div className="p-8"><h1 className="text-2xl font-bold">System Health</h1><p>System monitoring</p></div>
const QuantumProcessing = () => <div className="p-8"><h1 className="text-2xl font-bold">Quantum Processing</h1><p>Quantum computation interface</p></div>
const Users = () => <div className="p-8"><h1 className="text-2xl font-bold">Users</h1><p>User management</p></div>
const APIKeys = () => <div className="p-8"><h1 className="text-2xl font-bold">API Keys</h1><p>API key management</p></div>
const Alerts = () => <div className="p-8"><h1 className="text-2xl font-bold">Alerts</h1><p>Alert management</p></div>
const Settings = () => <div className="p-8"><h1 className="text-2xl font-bold">Settings</h1><p>Application settings</p></div>
const Login = () => <div className="p-8"><h1 className="text-2xl font-bold">Login</h1><p>Login form</p></div>

// Simple navigation component
const Navigation = () => (
  <nav className="bg-gray-800 text-white p-4">
    <div className="container mx-auto flex space-x-6">
      <a href="/" className="hover:text-gray-300">Dashboard</a>
      <a href="/fraud-detection" className="hover:text-gray-300">Fraud Detection</a>
      <a href="/analytics" className="hover:text-gray-300">Analytics</a>
      <a href="/system-health" className="hover:text-gray-300">System Health</a>
      <a href="/quantum" className="hover:text-gray-300">Quantum</a>
      <a href="/users" className="hover:text-gray-300">Users</a>
      <a href="/api-keys" className="hover:text-gray-300">API Keys</a>
      <a href="/alerts" className="hover:text-gray-300">Alerts</a>
      <a href="/settings" className="hover:text-gray-300">Settings</a>
    </div>
  </nav>
)

// Simple layout component
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-50">
    <Navigation />
    <main>
      {children}
    </main>
  </div>
)

export function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Main routes with layout */}
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/fraud-detection" element={<Layout><FraudDetection /></Layout>} />
          <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
          <Route path="/system-health" element={<Layout><SystemHealth /></Layout>} />
          <Route path="/quantum" element={<Layout><QuantumProcessing /></Layout>} />
          <Route path="/users" element={<Layout><Users /></Layout>} />
          <Route path="/api-keys" element={<Layout><APIKeys /></Layout>} />
          <Route path="/alerts" element={<Layout><Alerts /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}