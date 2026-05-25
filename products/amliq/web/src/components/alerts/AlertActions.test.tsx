import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AlertActions } from './AlertActions'

describe('AlertActions', () => {
  it('renders actions card title', () => {
    render(<AlertActions />)
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('renders confirm button', () => {
    render(<AlertActions />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const handler = vi.fn()
    render(<AlertActions onConfirm={handler} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls onFalsePositive when false positive button clicked', async () => {
    const handler = vi.fn()
    render(<AlertActions onFalsePositive={handler} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[1])
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls onEscalate when escalate button clicked', async () => {
    const handler = vi.fn()
    render(<AlertActions onEscalate={handler} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[2])
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls onDraftAI when AI draft button clicked', async () => {
    const handler = vi.fn()
    render(<AlertActions onDraftAI={handler} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[3])
    expect(handler).toHaveBeenCalledOnce()
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<AlertActions disabled={true} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('renders 4 action buttons', () => {
    render(<AlertActions />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(4)
  })

  it('only disables buttons when disabled true and handlers exist', async () => {
    const handler = vi.fn()
    render(
      <AlertActions
        onConfirm={handler}
        onFalsePositive={handler}
        onEscalate={handler}
        onDraftAI={handler}
        disabled={false}
      />
    )
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).not.toBeDisabled()
    })
  })
})
