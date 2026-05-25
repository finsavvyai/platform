import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RiskAssessment } from './RiskAssessment'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
}))

vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}))

vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}))

vi.mock('../components/compliance/RiskResultCard', () => ({
  RiskResultCard: ({ result }: any) => <div>Risk: {result.risk_level}</div>,
}))

vi.mock('../data/riskCountries', () => ({
  RISK_COUNTRIES: [
    { code: 'US', name: 'United States', risk: 'low' },
    { code: 'IR', name: 'Iran', risk: 'high' },
    { code: 'DE', name: 'Germany', risk: 'medium' },
  ],
}))

const mockResult = { composite_score: 0.75, risk_level: 'high', factors: ['PEP'], breakdown: { pep: 0.75 } }

beforeEach(() => { vi.clearAllMocks() })

describe('RiskAssessment', () => {
  it('renders page title', () => {
    render(<RiskAssessment />)
    expect(screen.getByText('Risk Assessment')).toBeInTheDocument()
  })

  it('calculate button disabled when entity ID empty', () => {
    render(<RiskAssessment />)
    expect(screen.getByRole('button', { name: /calculate/i })).toBeDisabled()
  })

  it('enables button after typing entity ID', async () => {
    render(<RiskAssessment />)
    await userEvent.type(screen.getByLabelText(/entity identifier/i), 'cust_abc123')
    expect(screen.getByRole('button', { name: /calculate/i })).not.toBeDisabled()
  })

  it('shows validation error when entity ID too short', async () => {
    render(<RiskAssessment />)
    await userEvent.type(screen.getByLabelText(/entity identifier/i), 'a')
    await userEvent.click(screen.getByRole('button', { name: /calculate/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/at least 2/i))
  })

  it('shows risk result on success', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResult)
    render(<RiskAssessment />)
    await userEvent.type(screen.getByLabelText(/entity identifier/i), 'cust_abc123')
    await userEvent.click(screen.getByRole('button', { name: /calculate/i }))
    await waitFor(() => expect(screen.getByText('Risk: high')).toBeInTheDocument())
  })

  it('shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Service unavailable'))
    render(<RiskAssessment />)
    await userEvent.type(screen.getByLabelText(/entity identifier/i), 'cust_abc123')
    await userEvent.click(screen.getByRole('button', { name: /calculate/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable'))
  })

  it('toggles PEP checkbox', async () => {
    render(<RiskAssessment />)
    const pep = screen.getByRole('checkbox', { name: /politically exposed/i })
    expect(pep).not.toBeChecked()
    await userEvent.click(pep)
    expect(pep).toBeChecked()
  })

  it('toggles sanctions hit checkbox', async () => {
    render(<RiskAssessment />)
    const cb = screen.getByRole('checkbox', { name: /sanctions list hit/i })
    await userEvent.click(cb)
    expect(cb).toBeChecked()
  })

  it('changes entity type select', async () => {
    render(<RiskAssessment />)
    const select = screen.getByLabelText(/entity type/i)
    await userEvent.selectOptions(select, 'company')
    expect(select).toHaveValue('company')
  })

  it('selects medium risk country', async () => {
    render(<RiskAssessment />)
    const select = screen.getByLabelText(/country/i)
    await userEvent.selectOptions(select, 'DE')
    expect(select).toHaveValue('DE')
    expect(screen.getByText(/enhanced DD/i)).toBeInTheDocument()
  })

  it('calculates with PEP and sanctions checked', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResult)
    render(<RiskAssessment />)
    await userEvent.type(screen.getByLabelText(/entity identifier/i), 'cust_abc123')
    await userEvent.click(screen.getByRole('checkbox', { name: /politically exposed/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /sanctions list hit/i }))
    await userEvent.click(screen.getByRole('button', { name: /calculate/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/risk/score', expect.objectContaining({
      pep_score: 1,
      sanctions_score: 1,
    })))
  })

  it('shows generic error on non-Error API failure', async () => {
    vi.mocked(api.post).mockRejectedValue('timeout')
    render(<RiskAssessment />)
    await userEvent.type(screen.getByLabelText(/entity identifier/i), 'cust_abc123')
    await userEvent.click(screen.getByRole('button', { name: /calculate/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Calculation failed'))
  })
})
