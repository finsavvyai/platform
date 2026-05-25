import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders spinner with accessible role', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has aria-label for screen readers', () => {
    render(<LoadingSpinner />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('renders small size with correct svg dimensions', () => {
    const { container } = render(<LoadingSpinner size="sm" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
  })

  it('renders medium size by default', () => {
    const { container } = render(<LoadingSpinner />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '36')
    expect(svg).toHaveAttribute('height', '36')
  })

  it('renders large size with correct svg dimensions', () => {
    const { container } = render(<LoadingSpinner size="lg" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '48')
    expect(svg).toHaveAttribute('height', '48')
  })

  it('uses gold accent color for spinner stroke', () => {
    const { container } = render(<LoadingSpinner />)
    const activeCircle = container.querySelectorAll('circle')[1]
    expect(activeCircle).toHaveAttribute('stroke', '#C9A96E')
  })
})
