import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('renders toggle with checked state', () => {
    const { container } = render(
      <Toggle checked={true} onChange={vi.fn()} />
    )
    const toggle = container.querySelector('div[class*="bg-apple-green"]')
    expect(toggle).toBeInTheDocument()
  })

  it('renders toggle with unchecked state', () => {
    const { container } = render(
      <Toggle checked={false} onChange={vi.fn()} />
    )
    const toggle = container.querySelector('div[class*="bg-apple-bg-tertiary"]')
    expect(toggle).toBeInTheDocument()
  })

  it('calls onChange when clicked', async () => {
    const handler = vi.fn()
    const { container } = render(
      <Toggle checked={false} onChange={handler} />
    )
    const toggleDiv = container.querySelector('div[class*="rounded-full"]')
    await userEvent.click(toggleDiv!)
    expect(handler).toHaveBeenCalledWith(true)
  })

  it('toggles between true and false', async () => {
    const handler = vi.fn()
    const { rerender, container } = render(
      <Toggle checked={false} onChange={handler} />
    )
    const toggleDiv = container.querySelector('div[class*="rounded-full"]')
    await userEvent.click(toggleDiv!)
    expect(handler).toHaveBeenCalledWith(true)

    rerender(<Toggle checked={true} onChange={handler} />)
    await userEvent.click(toggleDiv!)
    expect(handler).toHaveBeenCalledWith(false)
  })

  it('renders with label', () => {
    render(<Toggle checked={true} onChange={vi.fn()} label="Enable feature" />)
    expect(screen.getByText('Enable feature')).toBeInTheDocument()
  })

  it('does not call onChange when disabled', async () => {
    const handler = vi.fn()
    const { container } = render(
      <Toggle checked={false} onChange={handler} disabled={true} />
    )
    const toggleDiv = container.querySelector('div[class*="rounded-full"]')
    await userEvent.click(toggleDiv!)
    expect(handler).not.toHaveBeenCalled()
  })

  it('applies disabled styling', () => {
    const { container } = render(
      <Toggle checked={false} onChange={vi.fn()} disabled={true} />
    )
    const toggleDiv = container.querySelector('div[class*="rounded-full"]')
    expect(toggleDiv).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('slides indicator to the right when checked', () => {
    const { container } = render(
      <Toggle checked={true} onChange={vi.fn()} />
    )
    const span = container.querySelector('span[class*="translate-x"]')
    expect(span).toHaveClass('translate-x-7')
  })

  it('slides indicator to the left when unchecked', () => {
    const { container } = render(
      <Toggle checked={false} onChange={vi.fn()} />
    )
    const span = container.querySelector('span[class*="translate-x"]')
    expect(span).toHaveClass('translate-x-0.5')
  })
})
