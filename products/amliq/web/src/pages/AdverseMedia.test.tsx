import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdverseMedia } from './AdverseMedia'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}))

vi.mock('../components/compliance/MediaResultCard', () => ({
  MediaResultCard: ({ hit, onReview }: any) => (
    <div>
      <span>{hit.title}</span>
      <button onClick={() => onReview(hit.id, 'reviewed')}>Review</button>
    </div>
  ),
}))

const mockHit = {
  id: 'h1',
  entity_name: 'Suspect Corp',
  category: 'fraud',
  categories: ['fraud'],
  title: 'Fraud Investigation',
  snippet: 'Company under investigation',
  url: 'https://news.example.com',
  risk_score: 0.9,
  severity: 3,
  review_status: 'pending',
  detected_at: '2026-01-01',
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdverseMedia', () => {
  it('renders page title', async () => {
    vi.mocked(api.get).mockResolvedValue({ hits: [] })
    render(<AdverseMedia />)
    expect(screen.getByText('Adverse Media')).toBeInTheDocument()
  })

  it('loads and shows unreviewed hits on mount', async () => {
    vi.mocked(api.get).mockResolvedValue({ hits: [mockHit] })
    render(<AdverseMedia />)
    await waitFor(() => expect(screen.getByText('Fraud Investigation')).toBeInTheDocument())
  })

  it('handles initial load error gracefully', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network fail'))
    render(<AdverseMedia />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/media/unreviewed'))
  })

  it('scans by entity name on button click', async () => {
    vi.mocked(api.get).mockResolvedValue({ hits: [] })
    const newHit = { ...mockHit, id: 'h2', title: 'Bribery Case' }
    vi.mocked(api.post).mockResolvedValue({ hits: [newHit] })
    render(<AdverseMedia />)
    await userEvent.type(screen.getByPlaceholderText(/adverse_media\.search_entity/i), 'Test Corp')
    await userEvent.click(screen.getByRole('button', { name: /adverse_media\.scan/i }))
    await waitFor(() => expect(screen.getByText('Bribery Case')).toBeInTheDocument())
  })

  it('does not scan when search field is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ hits: [] })
    render(<AdverseMedia />)
    await userEvent.click(screen.getByRole('button', { name: /adverse_media\.scan/i }))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('filters hits by category', async () => {
    const hit2 = { ...mockHit, id: 'h2', title: 'Laundering Article', category: 'money_laundering', categories: ['money_laundering'] }
    vi.mocked(api.get).mockResolvedValue({ hits: [mockHit, hit2] })
    render(<AdverseMedia />)
    await waitFor(() => screen.getByText('Fraud Investigation'))
    await userEvent.click(screen.getByRole('button', { name: /fraud/i }))
    expect(screen.getByText('Fraud Investigation')).toBeInTheDocument()
    expect(screen.queryByText('Laundering Article')).not.toBeInTheDocument()
  })

  it('removes hit after review', async () => {
    vi.mocked(api.get).mockResolvedValue({ hits: [mockHit] })
    vi.mocked(api.put).mockResolvedValue({})
    render(<AdverseMedia />)
    await waitFor(() => screen.getByText('Fraud Investigation'))
    await userEvent.click(screen.getByRole('button', { name: /review/i }))
    await waitFor(() => expect(screen.queryByText('Fraud Investigation')).not.toBeInTheDocument())
    expect(api.put).toHaveBeenCalledWith('/media/results/h1/review', { status: 'reviewed' })
  })

  it('scans on Enter key', async () => {
    vi.mocked(api.get).mockResolvedValue({ hits: [] })
    vi.mocked(api.post).mockResolvedValue({ hits: [] })
    render(<AdverseMedia />)
    await userEvent.type(screen.getByPlaceholderText(/adverse_media\.search_entity/i), 'Test{Enter}')
    expect(api.post).toHaveBeenCalledWith('/media/scan', { entity_name: 'Test' })
  })
})
