import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ConfidenceScore } from './ConfidenceScore'

describe('ConfidenceScore', () => {
  it('displays score as percentage', () => {
    render(<ConfidenceScore score={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('rounds score to nearest integer', () => {
    render(<ConfidenceScore score={75.6} />)
    expect(screen.getByText('76%')).toBeInTheDocument()
  })

  it('renders high score with red color', () => {
    render(<ConfidenceScore score={85} />)
    const element = screen.getByText('85%')
    expect(element).toHaveClass('text-red-700', 'bg-red-50')
  })

  it('renders medium score with orange color', () => {
    render(<ConfidenceScore score={65} />)
    const element = screen.getByText('65%')
    expect(element).toHaveClass('text-amber-700', 'bg-amber-50')
  })

  it('renders low score with green color', () => {
    render(<ConfidenceScore score={50} />)
    const element = screen.getByText('50%')
    expect(element).toHaveClass('text-emerald-700', 'bg-emerald-50')
  })

  it('uses boundary score 80 for red threshold', () => {
    render(<ConfidenceScore score={80} />)
    expect(screen.getByText('80%')).toHaveClass('text-red-700', 'bg-red-50')
  })

  it('uses boundary score 60 for orange threshold', () => {
    render(<ConfidenceScore score={60} />)
    expect(screen.getByText('60%')).toHaveClass('text-amber-700', 'bg-amber-50')
  })

  it('renders different sizes', () => {
    const { rerender } = render(<ConfidenceScore score={75} size="sm" />)
    let element = screen.getByText('75%')
    expect(element).toHaveClass('text-xs', 'px-2', 'py-0.5')

    rerender(<ConfidenceScore score={75} size="md" />)
    element = screen.getByText('75%')
    expect(element).toHaveClass('text-sm', 'px-3', 'py-1')

    rerender(<ConfidenceScore score={75} size="lg" />)
    element = screen.getByText('75%')
    expect(element).toHaveClass('text-base', 'px-4', 'py-1.5')
  })

  it('has rounded-full class', () => {
    render(<ConfidenceScore score={50} />)
    expect(screen.getByText('50%')).toHaveClass('rounded-full', 'font-semibold')
  })
})
