import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders status badge with correct color for open', () => {
    render(<StatusBadge status="open" type="status" />)
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Open')).toHaveClass('bg-[rgba(26,24,20,0.08)]', 'text-[#1A1814]')
  })

  it('renders status badge with correct color for investigating', () => {
    render(<StatusBadge status="investigating" type="status" />)
    expect(screen.getByText('Investigating')).toBeInTheDocument()
    expect(screen.getByText('Investigating')).toHaveClass('bg-amber-50', 'text-amber-700')
  })

  it('renders status badge with correct color for resolved', () => {
    render(<StatusBadge status="resolved" type="status" />)
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toHaveClass('bg-emerald-50', 'text-emerald-700')
  })

  it('renders status badge with correct color for archived', () => {
    render(<StatusBadge status="archived" type="status" />)
    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toHaveClass('bg-slate-100', 'text-slate-600')
  })

  it('renders priority badge with correct color for critical', () => {
    render(<StatusBadge priority="critical" type="priority" />)
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('CRITICAL')).toHaveClass('bg-red-50', 'text-red-700')
  })

  it('renders priority badge with correct color for high', () => {
    render(<StatusBadge priority="high" type="priority" />)
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toHaveClass('bg-amber-50', 'text-amber-700')
  })

  it('renders priority badge with correct color for medium', () => {
    render(<StatusBadge priority="medium" type="priority" />)
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
    expect(screen.getByText('MEDIUM')).toHaveClass('bg-amber-50', 'text-amber-700')
  })

  it('renders priority badge with correct color for low', () => {
    render(<StatusBadge priority="low" type="priority" />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
    expect(screen.getByText('LOW')).toHaveClass('bg-slate-100', 'text-slate-600')
  })

  it('returns null when no status or priority provided', () => {
    const { container } = render(<StatusBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when type does not match prop', () => {
    const { container } = render(<StatusBadge status="open" type="priority" />)
    expect(container.firstChild).toBeNull()
  })
})
