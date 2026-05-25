import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Toolbar } from './Toolbar'

vi.mock('../ui/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher" />,
}))

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock('./CommandPalette', () => ({
  CommandPalette: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    open ? <div data-testid="cmd-palette" /> : null
  ),
}))

vi.mock('../ui/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com' },
    logout: vi.fn(),
  }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

describe('Toolbar', () => {
  it('renders toggle menu button with aria-label', () => {
    render(<Toolbar onMenuClick={vi.fn()} />)
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument()
  })

  it('calls onMenuClick when menu button clicked', async () => {
    const handler = vi.fn()
    render(<Toolbar onMenuClick={handler} />)
    await userEvent.click(screen.getByLabelText('Toggle menu'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('renders notification bell', () => {
    render(<Toolbar onMenuClick={vi.fn()} />)
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    render(<Toolbar onMenuClick={vi.fn()} />)
    expect(screen.getByLabelText('Logout')).toBeInTheDocument()
  })

  it('renders user avatar', () => {
    render(<Toolbar onMenuClick={vi.fn()} />)
    expect(screen.getByTestId('avatar')).toBeInTheDocument()
  })

  it('renders language switcher', () => {
    render(<Toolbar onMenuClick={vi.fn()} />)
    expect(screen.getByTestId('lang-switcher')).toBeInTheDocument()
  })

  it('renders as header element', () => {
    render(<Toolbar onMenuClick={vi.fn()} />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
