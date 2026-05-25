import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ComplianceMetrics } from './ComplianceMetrics'

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({
      openCases: 5,
      activeMonitors: 3,
      highRiskEntities: 2,
      pendingEDD: 1,
      unreviewedMedia: 4,
      txnAlerts: 7,
    })),
  },
}))

describe('ComplianceMetrics', () => {
  it('renders section title', async () => {
    render(<ComplianceMetrics />)
    const title = await screen.findByText('Compliance Overview')
    expect(title).toBeInTheDocument()
  })

  it('renders stat cards', async () => {
    render(<ComplianceMetrics />)
    const card = await screen.findByText('Open Cases')
    expect(card).toBeInTheDocument()
    expect(screen.getByText('Active Monitors')).toBeInTheDocument()
    expect(screen.getByText('Txn Alerts')).toBeInTheDocument()
  })
})
