import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BillingPage from './BillingPage'

vi.mock('../../api/billing', () => ({
  getSubscriptions: vi.fn(() => Promise.resolve([])),
  getInvoices: vi.fn(() => Promise.resolve([])),
  getSeats: vi.fn(() => Promise.resolve([])),
  getUsage: vi.fn(() => Promise.resolve(null)),
  getProducts: vi.fn(() => Promise.resolve([])),
}))

describe('BillingPage', () => {
  it('renders page title', () => {
    render(<BillingPage />)
    expect(screen.getByText('Billing & Subscriptions')).toBeInTheDocument()
  })

  it('renders section headings', () => {
    render(<BillingPage />)
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Dashboard Seats')).toBeInTheDocument()
    expect(screen.getByText('Promo Code')).toBeInTheDocument()
  })

  it('renders add product button', () => {
    render(<BillingPage />)
    expect(screen.getByText('Add Product')).toBeInTheDocument()
  })
})
