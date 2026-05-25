import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TransactionMonitoring } from './TransactionMonitoring'

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn((endpoint: string) => {
      if (endpoint.includes('summary')) {
        return Promise.resolve({})
      }
      return Promise.resolve({ alerts: [] })
    }),
  },
  ApiError: class extends Error {
    status: number
    constructor(msg: string, status: number) { super(msg); this.status = status }
  },
}))

const renderTxn = () =>
  render(
    <MemoryRouter>
      <TransactionMonitoring />
    </MemoryRouter>
  )

describe('TransactionMonitoring', () => {
  it('renders title', async () => {
    renderTxn()
    await waitFor(() => {
      expect(screen.getByText('Transaction Monitoring')).toBeInTheDocument()
    })
  })
})
