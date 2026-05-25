import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from './EmptyState'
import { Button } from './Button'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No results" />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(
      <EmptyState
        title="No data"
        description="Try adjusting your filters"
      />
    )
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
  })

  it('renders action button', () => {
    render(
      <EmptyState
        title="Empty"
        action={<Button>Go Back</Button>}
      />
    )
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  it('renders all content together', () => {
    render(
      <EmptyState
        title="No alerts"
        description="Your alert queue is clear"
        action={<Button variant="secondary">Refresh</Button>}
      />
    )
    expect(screen.getByText('No alerts')).toBeInTheDocument()
    expect(screen.getByText('Your alert queue is clear')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders without optional props', () => {
    render(<EmptyState title="Minimal" />)
    expect(screen.getByText('Minimal')).toBeInTheDocument()
  })
})
