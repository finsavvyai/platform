import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { UBOChain } from './UBOChain'

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({
        data: {
          owners: [
            { id: 'ubo_1', owner_name: 'Jane Smith', nationality: 'US',
              ownership_pct: 30, is_direct_owner: true, is_pep: false },
          ],
          total_ownership_pct: 30,
        },
      }),
    })
  ) as any
})

describe('UBOChain', () => {
  it('renders title after load', async () => {
    render(
      <MemoryRouter initialEntries={['/compliance/ubo/org_1']}>
        <Routes>
          <Route path="/compliance/ubo/:id" element={<UBOChain />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Beneficial Ownership')).toBeInTheDocument()
    })
  })
})
