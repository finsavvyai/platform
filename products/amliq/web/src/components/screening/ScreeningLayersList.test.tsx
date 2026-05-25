import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { ScreeningLayersList, LayerKey } from './ScreeningLayersList'

function Harness({ initial }: { initial?: Record<LayerKey, boolean> }) {
  const [value, setValue] = useState<Record<LayerKey, boolean>>(
    initial ?? { ofac: true, eu: true, un: true, custom: true }
  )
  return <ScreeningLayersList value={value} onChange={setValue} />
}

describe('ScreeningLayersList', () => {
  it('renders title', () => {
    render(<Harness />)
    expect(screen.getByText(/screening layers/i)).toBeInTheDocument()
  })

  it('renders all four layer toggles', () => {
    render(<Harness />)
    expect(screen.getAllByText(/ofac sdn/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/eu sanctions/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/un consolidated/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/custom lists/i).length).toBeGreaterThan(0)
  })

  it('all toggles are on when all value flags are true', () => {
    render(<Harness />)
    const switches = screen.getAllByRole('switch')
    const on = switches.filter(s => s.getAttribute('aria-checked') === 'true')
    expect(on.length).toBe(4)
  })

  it('calls onChange when a toggle is clicked', async () => {
    render(<Harness />)
    const switches = screen.getAllByRole('switch')
    await userEvent.click(switches[0])
    const on = screen.getAllByRole('switch').filter(s => s.getAttribute('aria-checked') === 'true')
    expect(on.length).toBe(3)
  })
})
