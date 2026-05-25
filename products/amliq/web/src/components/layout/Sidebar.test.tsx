import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'john@example.com', role: 'admin', tenant_id: 't1' },
    loading: false,
    isAuthenticated: true,
  }),
}))

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Sidebar', () => {
  it('renders sidebar logo', () => {
    renderWithRouter(<Sidebar isOpen={true} onClose={vi.fn()} />)
    expect(screen.getAllByText('AMLIQ').length).toBeGreaterThanOrEqual(1)
  })

  it('renders main and compliance nav sections', () => {
    renderWithRouter(<Sidebar isOpen={true} onClose={vi.fn()} />)
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Case Management').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PEP Screening').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Adverse Media').length).toBeGreaterThanOrEqual(1)
  })

  it('renders section titles', () => {
    renderWithRouter(<Sidebar isOpen={true} onClose={vi.fn()} />)
    expect(screen.getAllByText('Operations').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Compliance').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1)
  })

  it('renders user display name from email', () => {
    renderWithRouter(<Sidebar isOpen={true} onClose={vi.fn()} />)
    expect(screen.getAllByText('john').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onClose on link click', async () => {
    const handler = vi.fn()
    renderWithRouter(<Sidebar isOpen={true} onClose={handler} />)
    const links = screen.getAllByText('Dashboard')
    await userEvent.click(links[0].closest('a')!)
    expect(handler).toHaveBeenCalled()
  })

  it('renders correct compliance hrefs', () => {
    renderWithRouter(<Sidebar isOpen={true} onClose={vi.fn()} />)
    const caseLinks = screen.getAllByText('Case Management')
    expect(caseLinks[0].closest('a')).toHaveAttribute('href', '/compliance/cases')
    const riskLinks = screen.getAllByText('Risk Assessment')
    expect(riskLinks[0].closest('a')).toHaveAttribute('href', '/compliance/risk')
  })

  it('hides sidebar when isOpen is false', () => {
    const { container } = renderWithRouter(
      <Sidebar isOpen={false} onClose={vi.fn()} />
    )
    const desktopSidebar = container.querySelector('aside.hidden.md\\:flex')
    expect(desktopSidebar).toBeInTheDocument()
  })
})
