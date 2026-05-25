import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertQueue } from './AlertQueue'
import { createMockAlert } from '../test/utils'
import * as useAlertsModule from '../hooks/useAlerts'
import * as useSmartSortModule from '../hooks/useSmartSort'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('../hooks/useAlerts')
vi.mock('../hooks/useSmartSort')

vi.mock('../components/ui/ExportButton', () => ({
  ExportButton: () => <button type="button">Export</button>,
}))

vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: any) => <div>{title}</div>,
}))

vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}))

const mockAlerts = [
  createMockAlert({ id: '1', status: 'open', priority: 'critical' }),
  createMockAlert({ id: '2', status: 'investigating', priority: 'high' }),
]

const defaultHook = {
  alerts: mockAlerts,
  loading: false,
  error: null,
  refetch: vi.fn(),
  resolve: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAlertsModule.useAlerts).mockReturnValue(defaultHook)
  vi.mocked(useSmartSortModule.useSmartSort).mockReturnValue(mockAlerts as any)
  vi.mocked(useSmartSortModule.groupByTier).mockReturnValue(null as any)
})

describe('AlertQueue', () => {
  it('renders page title', () => {
    render(<AlertQueue />)
    expect(screen.getByText('Alert Queue')).toBeInTheDocument()
  })

  it('renders alert cards', async () => {
    render(<AlertQueue />)
    await waitFor(() => {
      expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0)
    })
  })

  it('renders alert filters component', () => {
    render(<AlertQueue />)
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('renders reset button in filters', () => {
    render(<AlertQueue />)
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('shows loading spinner while loading', () => {
    vi.mocked(useAlertsModule.useAlerts).mockReturnValue({ ...defaultHook, loading: true })
    render(<AlertQueue />)
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('shows error and retry button on error', () => {
    vi.mocked(useAlertsModule.useAlerts).mockReturnValue({
      ...defaultHook,
      alerts: [],
      error: new Error('Network fail'),
    })
    vi.mocked(useSmartSortModule.useSmartSort).mockReturnValue([] as any)
    render(<AlertQueue />)
    expect(screen.getByRole('alert')).toHaveTextContent('Network fail')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('retry button calls refetch', async () => {
    const refetch = vi.fn()
    vi.mocked(useAlertsModule.useAlerts).mockReturnValue({
      ...defaultHook,
      alerts: [],
      error: new Error('Fail'),
      refetch,
    })
    vi.mocked(useSmartSortModule.useSmartSort).mockReturnValue([] as any)
    render(<AlertQueue />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('shows sort mode buttons', () => {
    render(<AlertQueue />)
    expect(screen.getByRole('button', { name: /default/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /smart/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /oldest/i })).toBeInTheDocument()
  })

  it('switching to smart sort passes smart mode to useSmartSort', async () => {
    render(<AlertQueue />)
    await userEvent.click(screen.getByRole('button', { name: /smart/i }))
    expect(useSmartSortModule.useSmartSort).toHaveBeenCalledWith(mockAlerts, 'smart')
  })

  it('reset filters calls onReset which clears selections', async () => {
    render(<AlertQueue />)
    await userEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(useSmartSortModule.useSmartSort).toHaveBeenCalledWith(mockAlerts, 'default')
  })

  it('renders grouped tiers when smart sort active and groups exist', async () => {
    vi.mocked(useSmartSortModule.groupByTier).mockReturnValue({
      'needs-attention': [{ ...mockAlerts[0], urgencyScore: 10 }],
      'in-progress': [],
      'actionable': [],
    } as any)
    render(<AlertQueue />)
    await userEvent.click(screen.getByRole('button', { name: /smart/i }))
    expect(useSmartSortModule.groupByTier).toHaveBeenCalled()
  })
})
