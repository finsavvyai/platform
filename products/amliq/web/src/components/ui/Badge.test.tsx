import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders badge with text', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('renders different color variants', () => {
    const { rerender } = render(<Badge color="green">Green</Badge>)
    expect(screen.getByText('Green')).toHaveClass('bg-emerald-50', 'text-emerald-700')

    rerender(<Badge color="red">Red</Badge>)
    expect(screen.getByText('Red')).toHaveClass('bg-red-50', 'text-red-700')

    rerender(<Badge color="orange">Orange</Badge>)
    expect(screen.getByText('Orange')).toHaveClass('bg-amber-50', 'text-amber-700')

    rerender(<Badge color="blue">Blue</Badge>)
    expect(screen.getByText('Blue')).toHaveClass('bg-[rgba(26,24,20,0.08)]', 'text-[#1A1814]')

    rerender(<Badge color="purple">Purple</Badge>)
    expect(screen.getByText('Purple')).toHaveClass('bg-slate-100', 'text-slate-700')

    rerender(<Badge color="gray">Gray</Badge>)
    expect(screen.getByText('Gray')).toHaveClass('bg-slate-100', 'text-slate-600')
  })

  it('renders different sizes', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>)
    expect(screen.getByText('Small')).toHaveClass('px-2', 'py-0.5', 'text-xs')

    rerender(<Badge size="md">Medium</Badge>)
    expect(screen.getByText('Medium')).toHaveClass('px-2.5', 'py-0.5', 'text-xs')
  })

  it('applies default color and size', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default')).toHaveClass('bg-[rgba(26,24,20,0.08)]', 'text-[#1A1814]')
    expect(screen.getByText('Default')).toHaveClass('px-2.5', 'py-0.5')
  })

  it('has rounded-full class', () => {
    render(<Badge>Pill</Badge>)
    expect(screen.getByText('Pill')).toHaveClass('rounded-full')
  })
})
