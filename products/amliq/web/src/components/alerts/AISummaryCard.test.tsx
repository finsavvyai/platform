import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AISummaryCard } from './AISummaryCard'
import { createMockAlert } from '../../test/utils'

vi.mock('../../api/ai', () => ({
  fetchAlertSummary: vi.fn(),
}))

import { fetchAlertSummary } from '../../api/ai'

const mockFetchAlertSummary = vi.mocked(fetchAlertSummary)

describe('AISummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders AI Summary heading', () => {
    render(<AISummaryCard alert={createMockAlert()} />)
    expect(screen.getByText('AI Summary')).toBeInTheDocument()
  })

  it('renders Beta badge', () => {
    render(<AISummaryCard alert={createMockAlert()} />)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders idle state with description and generate button', () => {
    render(<AISummaryCard alert={createMockAlert()} />)
    expect(
      screen.getByText(/generate a concise analyst summary/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /generate summary/i })
    ).toBeInTheDocument()
  })

  it('does not show collapse toggle in idle state', () => {
    render(<AISummaryCard alert={createMockAlert()} />)
    expect(
      screen.queryByLabelText(/collapse summary/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/expand summary/i)
    ).not.toBeInTheDocument()
  })

  it('shows loading spinner after clicking generate', async () => {
    mockFetchAlertSummary.mockReturnValue(new Promise(() => {}))
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))

    expect(screen.getByText(/analysing alert/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate summary/i })).not.toBeInTheDocument()
  })

  it('shows summary text and model after successful generation', async () => {
    mockFetchAlertSummary.mockResolvedValue({
      summary: 'High risk entity with sanctions match.',
      model: 'claude-sonnet-4-6',
    })
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))

    expect(
      await screen.findByText('High risk entity with sanctions match.')
    ).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
  })

  it('shows regenerate button after successful generation', async () => {
    mockFetchAlertSummary.mockResolvedValue({
      summary: 'Some summary.',
      model: 'model-x',
    })
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))
    expect(await screen.findByText('Regenerate')).toBeInTheDocument()
  })

  it('clicking regenerate calls fetchAlertSummary again', async () => {
    mockFetchAlertSummary.mockResolvedValue({
      summary: 'Summary v1.',
      model: 'model-x',
    })
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))
    await screen.findByText('Regenerate')

    mockFetchAlertSummary.mockResolvedValue({
      summary: 'Summary v2.',
      model: 'model-x',
    })
    await userEvent.click(screen.getByText('Regenerate'))

    expect(await screen.findByText('Summary v2.')).toBeInTheDocument()
    expect(mockFetchAlertSummary).toHaveBeenCalledTimes(2)
  })

  it('shows collapse toggle button when summary is done', async () => {
    mockFetchAlertSummary.mockResolvedValue({
      summary: 'A summary.',
      model: 'model-x',
    })
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))
    await screen.findByText('A summary.')

    expect(screen.getByLabelText('Collapse summary')).toBeInTheDocument()
  })

  it('collapses and expands summary using toggle button', async () => {
    mockFetchAlertSummary.mockResolvedValue({
      summary: 'Collapsible summary text.',
      model: 'model-x',
    })
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))
    await screen.findByText('Collapsible summary text.')

    await userEvent.click(screen.getByLabelText('Collapse summary'))
    expect(screen.queryByText('Collapsible summary text.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Expand summary')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Expand summary'))
    expect(await screen.findByText('Collapsible summary text.')).toBeInTheDocument()
  })

  it('shows error message when generation fails', async () => {
    mockFetchAlertSummary.mockRejectedValue(new Error('Service timeout'))
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))

    expect(await screen.findByText('Service timeout')).toBeInTheDocument()
  })

  it('shows backend hint in error state', async () => {
    mockFetchAlertSummary.mockRejectedValue(new Error('500'))
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))

    expect(
      await screen.findByText(/POST \/api\/v1\/ai\/summarize/i)
    ).toBeInTheDocument()
  })

  it('does not show collapse toggle in error state', async () => {
    mockFetchAlertSummary.mockRejectedValue(new Error('err'))
    render(<AISummaryCard alert={createMockAlert()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))
    await screen.findByText('err')

    expect(screen.queryByLabelText(/collapse summary/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/expand summary/i)).not.toBeInTheDocument()
  })
})
