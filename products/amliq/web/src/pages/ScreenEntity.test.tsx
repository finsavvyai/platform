import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ScreenEntity } from './ScreenEntity'

const mockScreen = vi.fn()
const mockClear = vi.fn()

vi.mock('../hooks/useScreening', () => ({
  useScreening: () => ({
    result: null,
    loading: false,
    error: null,
    screen: mockScreen,
    clear: mockClear,
  }),
}))

vi.mock('../components/screening/ScreeningQuotaBanner', () => ({
  ScreeningQuotaBanner: () => <div data-testid="quota-banner" />,
}))

vi.mock('../components/screening/LimitReachedBanner', () => ({
  LimitReachedBanner: () => null,
}))

vi.mock('../components/screening/ScreeningProgress', () => ({
  ScreeningProgress: () => null,
}))

vi.mock('../components/screening/ScreenResults', () => ({
  ScreenResults: () => null,
}))

const renderScreen = () =>
  render(
    <MemoryRouter>
      <ScreenEntity />
    </MemoryRouter>
  )

describe('ScreenEntity', () => {
  it('renders page title', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: /Screen Entity/i })).toBeInTheDocument()
  })

  it('renders page description', () => {
    renderScreen()
    expect(screen.getByText('Perform manual entity screening')).toBeInTheDocument()
  })

  it('renders screening form', () => {
    renderScreen()
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument()
  })

  it('renders screening layers list', () => {
    renderScreen()
    expect(screen.getByText('Screening Layers')).toBeInTheDocument()
  })

  it('does not show results section initially', () => {
    renderScreen()
    expect(screen.queryByText(/Screening Results/i)).not.toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderScreen()
    const btn = screen.getByRole('button', { name: /screen entity/i })
    expect(btn).toBeInTheDocument()
  })

  it('calls screen on form submit', async () => {
    mockScreen.mockClear()
    renderScreen()
    await userEvent.type(screen.getByPlaceholderText('First Name'), 'John')
    await userEvent.type(screen.getByPlaceholderText('Last Name'), 'Doe')
    await userEvent.click(screen.getByRole('button', { name: /screen entity/i }))
    await waitFor(() => {
      expect(mockScreen).toHaveBeenCalledTimes(1)
    })
  })

  it('passes correct payload for individual screening', async () => {
    mockScreen.mockClear()
    renderScreen()
    await userEvent.type(screen.getByPlaceholderText('First Name'), 'Jane')
    await userEvent.type(screen.getByPlaceholderText('Last Name'), 'Smith')
    await userEvent.click(screen.getByRole('button', { name: /screen entity/i }))
    await waitFor(() => {
      expect(mockScreen).toHaveBeenCalledWith(
        expect.objectContaining({ entity_name: 'Jane Smith', entity_type: 'individual' }),
      )
    })
  })

  it('allows switching between individual and company types', () => {
    renderScreen()
    const tabs = screen.getAllByRole('button').filter(
      btn => btn.textContent === 'Individual' || btn.textContent === 'Company'
    )
    expect(tabs.length).toBe(2)
  })
})
