import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders initials from name', () => {
    render(<Avatar name="John Doe" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('handles single name', () => {
    render(<Avatar name="Prince" />)
    expect(screen.getByText('P')).toBeInTheDocument()
  })

  it('handles multiple names and takes first two initials', () => {
    render(<Avatar name="John Michael Doe" />)
    expect(screen.getByText('JM')).toBeInTheDocument()
  })

  it('converts initials to uppercase', () => {
    render(<Avatar name="alice bob" />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('renders different sizes', () => {
    const { rerender } = render(<Avatar name="Test User" size="sm" />)
    expect(screen.getByText('TU')).toHaveClass('w-6', 'h-6', 'text-xs')

    rerender(<Avatar name="Test User" size="md" />)
    expect(screen.getByText('TU')).toHaveClass('w-8', 'h-8', 'text-sm')

    rerender(<Avatar name="Test User" size="lg" />)
    expect(screen.getByText('TU')).toHaveClass('w-10', 'h-10', 'text-base')
  })

  it('applies custom className', () => {
    render(<Avatar name="Test User" className="custom-class" />)
    expect(screen.getByText('TU')).toHaveClass('custom-class')
  })

  it('has base styling', () => {
    render(<Avatar name="Test User" />)
    const element = screen.getByText('TU')
    expect(element).toHaveClass('rounded-full', 'flex', 'items-center', 'justify-center', 'font-semibold')
  })
})
