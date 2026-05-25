import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Divider } from './Divider'

describe('Divider', () => {
  it('renders divider element', () => {
    const { container } = render(<Divider />)
    const divider = container.querySelector('div[class*="h-px"]')
    expect(divider).toBeInTheDocument()
  })

  it('has correct styling', () => {
    const { container } = render(<Divider />)
    const divider = container.querySelector('div[class*="h-px"]')
    expect(divider).toHaveClass('h-px', 'bg-apple-separator', 'my-lg')
  })

  it('creates a visual separator', () => {
    const { container } = render(<Divider />)
    const divider = container.querySelector('div[class*="h-px"]')
    expect(divider?.className).toContain('h-px')
    expect(divider?.className).toContain('bg-apple-separator')
  })
})
