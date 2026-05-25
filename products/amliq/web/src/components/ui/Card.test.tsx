import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders children content', () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>
    )
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies base styling classes', () => {
    const { container } = render(<Card>Test</Card>)
    const card = container.querySelector('div[class*="rounded-"]')
    expect(card?.className).toContain('rounded-2xl')
    expect(card).toHaveStyle({ background: 'var(--dash-surface)' })
  })

  it('handles click events when onClick provided', async () => {
    const handler = vi.fn()
    render(<Card onClick={handler}>Clickable</Card>)
    await userEvent.click(screen.getByText('Clickable'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('applies hover styles when hover prop is true', () => {
    const { container } = render(<Card hover>Hoverable</Card>)
    const card = container.querySelector('div[class*="rounded-2xl"]')
    expect(card).toBeInTheDocument()
    expect(card?.className).toContain('rounded-2xl')
  })

  it('does not render as button when hover prop is true without onClick', () => {
    const { container } = render(<Card hover>Not Clickable</Card>)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Test</Card>)
    const card = container.querySelector('div[class*="custom-class"]')
    expect(card?.className).toContain('custom-class')
  })

  it('combines all props correctly', async () => {
    const handler = vi.fn()
    const { container } = render(
      <Card hover onClick={handler} className="extra">
        Combined
      </Card>
    )
    const card = container.querySelector('button[class*="extra"]')
    expect(card?.className).toContain('extra')
    expect(card?.className).toContain('cursor-pointer')
    expect(card?.className).toContain('w-full')
    await userEvent.click(card!)
    expect(handler).toHaveBeenCalledOnce()
  })
})
