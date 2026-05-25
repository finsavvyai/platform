import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'john@example.com', role: 'admin', tenant_id: 't1' },
    loading: false,
    isAuthenticated: true,
  }),
}))

vi.mock('../hooks/useAnalytics', () => ({
  useAnalytics: vi.fn(() => ({
    analytics: {
      totalAlerts: 42,
      clearedAlerts: 28,
      escalatedAlerts: 5,
      avgResolutionTime: 2.5,
      screeningVolume: [],
      dispositionBreakdown: [],
      riskDistribution: [],
      topEntities: [
        { name: 'Entity 1', alerts: 10, risk: 'High' },
        { name: 'Entity 2', alerts: 8, risk: 'Medium' },
      ],
    },
    loading: false,
    error: null,
  })),
}))

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )

describe('Dashboard', () => {
  it('renders page title', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders stat cards', () => {
    renderDashboard()
    expect(screen.getByText('Total Alerts')).toBeInTheDocument()
    expect(screen.getByText('Cleared Today')).toBeInTheDocument()
    expect(screen.getByText('Escalated')).toBeInTheDocument()
  })

  it('displays stat card values', () => {
    renderDashboard()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
  })
})
