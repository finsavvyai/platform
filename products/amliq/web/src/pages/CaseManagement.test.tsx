import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CaseManagement } from './CaseManagement'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}))

vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}))

vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: any) => <div>{title}</div>,
}))

vi.mock('../components/compliance/CaseListCard', () => ({
  CaseCard: ({ caseItem }: any) => <div>Case: {caseItem.entity_name}</div>,
}))

const mockCase = {
  id: 'c1', entity_name: 'Jane Doe', matched_name: 'Jane Doe',
  status: 'open', priority: 'high', assigned_to: 'analyst@co.com',
  created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => { vi.clearAllMocks() })

describe('CaseManagement', () => {
  it('renders title', async () => {
    vi.mocked(api.get).mockResolvedValue({ cases: [] })
    render(<CaseManagement />)
    expect(screen.getByText('Case Management')).toBeInTheDocument()
  })

  it('renders filter buttons', async () => {
    vi.mocked(api.get).mockResolvedValue({ cases: [] })
    render(<CaseManagement />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('open')).toBeInTheDocument()
    expect(screen.getByText('escalated')).toBeInTheDocument()
  })

  it('shows empty state when no cases', async () => {
    vi.mocked(api.get).mockResolvedValue({ cases: [] })
    render(<CaseManagement />)
    await waitFor(() => expect(screen.getByText(/no cases/i)).toBeInTheDocument())
  })

  it('renders case cards when cases exist', async () => {
    vi.mocked(api.get).mockResolvedValue({ cases: [mockCase] })
    render(<CaseManagement />)
    await waitFor(() => expect(screen.getByText('Case: Jane Doe')).toBeInTheDocument())
  })

  it('shows error on fetch failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Server error'))
    render(<CaseManagement />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'))
  })

  it('clicking filter button refetches with status param', async () => {
    vi.mocked(api.get).mockResolvedValue({ cases: [] })
    render(<CaseManagement />)
    await waitFor(() => screen.getByText('All'))
    await userEvent.click(screen.getByRole('button', { name: /^open$/i }))
    expect(api.get).toHaveBeenCalledWith('/cases?status=open')
  })
})
