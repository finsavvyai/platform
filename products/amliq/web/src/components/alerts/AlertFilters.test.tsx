import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AlertFilters } from './AlertFilters'

describe('AlertFilters', () => {
  const renderFilters = () => render(
    <AlertFilters
      selectedStatus={[]}
      selectedPriority={[]}
      onStatusChange={vi.fn()}
      onPriorityChange={vi.fn()}
      onReset={vi.fn()}
    />
  )

  it('renders all filter buttons', () => {
    renderFilters()
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /critical/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('calls filter handlers on button click', async () => {
    const statusHandler = vi.fn()
    const priorityHandler = vi.fn()
    render(
      <AlertFilters
        selectedStatus={[]}
        selectedPriority={[]}
        onStatusChange={statusHandler}
        onPriorityChange={priorityHandler}
        onReset={vi.fn()}
      />
    )
    const openBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent === 'open')
    const criticalBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent === 'critical')
    await userEvent.click(openBtn!)
    await userEvent.click(criticalBtn!)
    expect(statusHandler).toHaveBeenCalled()
    expect(priorityHandler).toHaveBeenCalled()
  })

  it('highlights selected filters and renders reset', () => {
    render(
      <AlertFilters
        selectedStatus={['open']}
        selectedPriority={['critical']}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    const openBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent === 'open')
    expect(openBtn).toHaveClass('bg-[#1A1814]')
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('calls onReset when reset button clicked', async () => {
    const handler = vi.fn()
    render(
      <AlertFilters
        selectedStatus={['open']}
        selectedPriority={['critical']}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onReset={handler}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(handler).toHaveBeenCalledOnce()
  })
})
