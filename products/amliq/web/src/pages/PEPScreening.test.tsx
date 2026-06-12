import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PEPScreening } from './PEPScreening'
import { api } from '../api/client'
import * as screeningApiModule from '../api/screening'

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(_code: string, msg: string, status: number) { super(msg); this.status = status }
  },
}))

vi.mock('../api/screening', () => ({
  screeningApi: { getQuota: vi.fn() },
}))

vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title, description }: any) => <><h1>{title}</h1><p>{description}</p></>,
}))

vi.mock('../components/screening/ScreeningQuotaBanner', () => ({
  ScreeningQuotaBanner: () => <div data-testid="quota-banner" />,
}))

vi.mock('../components/screening/ScreenResults', () => ({
  ScreenResults: ({ data }: any) => <div>ScreenResults: {data?.total ?? 0}</div>,
}))

vi.mock('../components/screening/LimitReachedBanner', () => ({
  LimitReachedBanner: () => <div>LimitReached</div>,
}))

vi.mock('../components/screening/ScreeningProgress', () => ({
  ScreeningProgress: () => <div>Screening in progress</div>,
}))

const mockQuota = { limit: 100, remaining: 50, used: 50, plan_name: 'Free', has_subscription: false }
const mockScreenResponse = { matches: [], total: 2 }
const mockPepResponse = {
  results: [
    { entity_id: 'q1', name: 'Test Person', position: 'Minister', country: 'US', tier: 1 },
    { entity_id: 'q2', name: '', position: 'Senator', country: 'UK', tier: 3 },
  ],
  total: 2,
}

const renderPage = () => render(<MemoryRouter><PEPScreening /></MemoryRouter>)

beforeEach(() => { vi.clearAllMocks() })

describe('PEPScreening', () => {
  it('renders page title and description', () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    renderPage()
    expect(screen.getByText('PEP & Sanctions Screening')).toBeInTheDocument()
    expect(screen.getByText(/screen against pep databases/i)).toBeInTheDocument()
  })

  it('screen button disabled when query empty', () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    renderPage()
    expect(screen.getByRole('button', { name: /screen pep/i })).toBeDisabled()
  })

  it('enables screen button after typing query', async () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/enter name/i), 'Vladimir Putin')
    expect(screen.getByRole('button', { name: /screen pep/i })).not.toBeDisabled()
  })

  it('shows PEP results and screen results on success', async () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/screen') return Promise.resolve(mockScreenResponse)
      if (url === '/pep/screen') return Promise.resolve(mockPepResponse)
      return Promise.resolve({})
    })
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/enter name/i), 'Test Person')
    await userEvent.click(screen.getByRole('button', { name: /screen pep/i }))
    await waitFor(() => expect(screen.getByText('Test Person')).toBeInTheDocument())
    expect(screen.getByText(/PEP Results/i)).toBeInTheDocument()
    expect(screen.getByText('ScreenResults: 2')).toBeInTheDocument()
  })

  it('uses position as display name when name is empty', async () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/screen') return Promise.resolve(mockScreenResponse)
      if (url === '/pep/screen') return Promise.resolve(mockPepResponse)
      return Promise.resolve({})
    })
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/enter name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /screen pep/i }))
    await waitFor(() => expect(screen.getByText('Senator')).toBeInTheDocument())
  })

  it('shows limit reached banner when quota-exhausted error returned', async () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    const ApiErrorClass = (await import('../api/client')).ApiError
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/screen') return Promise.reject(new ApiErrorClass('FREE_TIER_EXHAUSTED', 'Quota exhausted', 402))
      return Promise.resolve(mockPepResponse)
    })
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/enter name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /screen pep/i }))
    await waitFor(() => expect(screen.getByText('LimitReached')).toBeInTheDocument())
  })

  it('shows quota exhausted state when remaining is 0', async () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue({ limit: 100, remaining: 0, used: 100, plan_name: 'Free', has_subscription: false })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /quota exhausted/i })).toBeDisabled()
    })
  })

  it('quota banner is rendered', () => {
    vi.mocked(screeningApiModule.screeningApi.getQuota).mockResolvedValue(mockQuota)
    renderPage()
    expect(screen.getByTestId('quota-banner')).toBeInTheDocument()
  })
})
