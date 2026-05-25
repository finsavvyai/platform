import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EDDWorkflow } from './EDDWorkflow'

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({
      id: 'edd_1', entity_name: 'John Doe', status: 'in_progress',
      risk_level: 'high', notes: '',
      checklist: { identity_verified: true, source_of_funds: false },
    })),
  },
}))

describe('EDDWorkflow', () => {
  it('renders title after load', async () => {
    render(
      <MemoryRouter initialEntries={['/compliance/edd/edd_1']}>
        <Routes>
          <Route path="/compliance/edd/:id" element={<EDDWorkflow />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })
  })
})
