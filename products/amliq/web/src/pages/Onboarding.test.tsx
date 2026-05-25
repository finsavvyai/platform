import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Onboarding from './Onboarding'
import { api } from '../api/client'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

beforeEach(() => { vi.clearAllMocks() })

const mockLists = [{ list_id: 'ofac', threshold: 0.8, sync_enabled: true }]

describe('Onboarding', () => {
  it('renders welcome title', () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [] })
    render(<Onboarding />)
    expect(screen.getByText('Welcome to AMLIQ')).toBeInTheDocument()
  })

  it('renders step indicators', () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [] })
    render(<Onboarding />)
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Lists')).toBeInTheDocument()
    expect(screen.getByText('Threshold')).toBeInTheDocument()
  })

  it('renders country selection on step 1', () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [] })
    render(<Onboarding />)
    expect(screen.getByText('Select your country')).toBeInTheDocument()
    expect(screen.getByText('United States')).toBeInTheDocument()
    expect(screen.getByText('Israel')).toBeInTheDocument()
  })

  it('advances to step 2 and fetches lists when country selected', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: mockLists })
    render(<Onboarding />)
    await userEvent.click(screen.getByText('United States'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/onboarding/lists?country=US'))
    await waitFor(() => expect(screen.getByText('Recommended Lists')).toBeInTheDocument())
  })

  it('shows ofac list in step 2', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: mockLists })
    render(<Onboarding />)
    await userEvent.click(screen.getByText('United States'))
    await waitFor(() => expect(screen.getByText('ofac')).toBeInTheDocument())
  })

  it('advances to step 3 and calls api.put on finish', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: mockLists })
    vi.mocked(api.put).mockResolvedValue({})
    render(<Onboarding />)
    await userEvent.click(screen.getByText('United States'))
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => screen.getByRole('slider'))
    await userEvent.click(screen.getByRole('button', { name: /start screening/i }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/config', { default_threshold: 0.7 }))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
