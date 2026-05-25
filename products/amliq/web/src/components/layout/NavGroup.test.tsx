import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { NavGroup } from './NavGroup'
import { Home, Bell } from 'lucide-react'

const mockSection = {
  title: 'Main',
  items: [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Bell, label: 'Alerts', path: '/alerts' },
  ],
}

const renderNavGroup = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavGroup section={mockSection} userRole="admin" onNavigate={vi.fn()} />
    </MemoryRouter>
  )

describe('NavGroup', () => {
  it('renders section title', () => {
    renderNavGroup()
    expect(screen.getByText(/main/i)).toBeInTheDocument()
  })

  it('renders all nav items as links', () => {
    renderNavGroup()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
  })

  it('renders correct hrefs', () => {
    renderNavGroup()
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/dashboard')
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('href', '/alerts')
  })

  it('highlights active link', () => {
    renderNavGroup('/dashboard')
    const link = screen.getAllByRole('link')[0]
    expect(link).toHaveStyle({ background: 'var(--dash-sidebar-active)' })
  })

  it('does not highlight inactive links', () => {
    renderNavGroup('/dashboard')
    const link = screen.getAllByRole('link')[1]
    expect(link).toHaveStyle({ background: 'transparent' })
  })

  it('calls onNavigate when link clicked', async () => {
    const handler = vi.fn()
    render(
      <MemoryRouter>
        <NavGroup section={mockSection} userRole="admin" onNavigate={handler} />
      </MemoryRouter>
    )
    await userEvent.click(screen.getAllByRole('link')[0])
    expect(handler).toHaveBeenCalledOnce()
  })
})
