import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Configuration } from './Configuration'

const mockConfig = {
  default_threshold: 0.7,
  auto_dismiss_below: 0.3,
  auto_escalate_above: 0.9,
  enabled_lists: [
    { list_id: 'OFAC_SDN', sync_schedule: 'daily' },
  ],
}

const mockUpdateConfig = vi.fn().mockResolvedValue(mockConfig)

vi.mock('../hooks/useConfig', () => ({
  useConfig: () => ({
    config: mockConfig,
    loading: false,
    error: null,
    updateConfig: mockUpdateConfig,
    refetch: vi.fn(),
  }),
}))

const renderConfig = () =>
  render(
    <MemoryRouter>
      <Configuration />
    </MemoryRouter>
  )

describe('Configuration', () => {
  beforeEach(() => { mockUpdateConfig.mockClear() })

  it('renders page title', () => {
    renderConfig()
    expect(screen.getByText('Configuration')).toBeInTheDocument()
  })

  it('renders page description', () => {
    renderConfig()
    expect(screen.getByText(/screening parameters/i)).toBeInTheDocument()
  })

  it('renders thresholds card', () => {
    renderConfig()
    expect(screen.getByText('Thresholds')).toBeInTheDocument()
  })

  it('renders threshold sliders', () => {
    const { container } = renderConfig()
    const sliders = container.querySelectorAll('input[type="range"]')
    expect(sliders.length).toBe(3)
  })

  it('displays initial threshold percentages', () => {
    renderConfig()
    expect(screen.getByText(/70%/)).toBeInTheDocument()
    expect(screen.getByText(/30%/)).toBeInTheDocument()
    expect(screen.getByText(/90%/)).toBeInTheDocument()
  })

  it('renders lists section', () => {
    renderConfig()
    expect(screen.getByText(/Lists \(/)).toBeInTheDocument()
    expect(screen.getByText('OFAC_SDN')).toBeInTheDocument()
  })

  it('renders save button', () => {
    renderConfig()
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument()
  })

  it('calls updateConfig on save', async () => {
    renderConfig()
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    )
    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledTimes(1)
    })
  })

  it('shows threshold labels', () => {
    renderConfig()
    expect(screen.getByText(/Default Match Threshold/)).toBeInTheDocument()
    expect(screen.getByText(/Auto-Dismiss Below/)).toBeInTheDocument()
    expect(screen.getByText(/Auto-Escalate Above/)).toBeInTheDocument()
  })

  it('allows threshold adjustment via slider', async () => {
    const { container } = renderConfig()
    const slider = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement
    expect(slider).toBeTruthy()
    expect(slider.value).toBe('70')
  })
})
