import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Alerts" value={42} />)
    expect(screen.getByText('Total Alerts')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders string value', () => {
    render(<StatCard title="Status" value="Active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders positive trend with TrendingUp icon', () => {
    const { container } = render(
      <StatCard title="Growth" value={100} trend={12} />
    )
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders negative trend with TrendingDown icon', () => {
    render(<StatCard title="Decline" value={50} trend={-5} />)
    expect(screen.getByText('5%')).toBeInTheDocument()
  })

  it('displays absolute trend value', () => {
    render(<StatCard title="Test" value={100} trend={-25} />)
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <StatCard
        title="Resolution Time"
        value="2.5h"
        description="Average time in hours"
      />
    )
    expect(screen.getByText('Average time in hours')).toBeInTheDocument()
  })

  it('renders different color variants', () => {
    const { rerender } = render(
      <StatCard title="Growth" value={10} trend={5} color="green" />
    )
    let trendDiv = screen.getByText('5%').parentElement
    expect(trendDiv?.className).toContain('text-[#2D7A4F]')

    rerender(<StatCard title="Decline" value={20} trend={-8} color="red" />)
    trendDiv = screen.getByText('8%').parentElement
    expect(trendDiv?.className).toContain('text-[#C0392B]')

    rerender(<StatCard title="Change" value={30} trend={3} color="orange" />)
    trendDiv = screen.getByText('3%').parentElement
    expect(trendDiv?.className).toContain('text-[#2D7A4F]')
  })

  it('applies default blue color', () => {
    render(<StatCard title="Default" value={5} trend={2} />)
    const trendDiv = screen.getByText('2%').parentElement
    expect(trendDiv?.className).toContain('text-[#2D7A4F]')
  })

  it('does not render trend when undefined', () => {
    render(<StatCard title="No Trend" value={100} />)
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })
})
