import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHeader } from './PageHeader'
import { Button } from '../ui/Button'

describe('PageHeader', () => {
  it('renders page title', () => {
    render(<PageHeader title="Dashboard" />)
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <PageHeader
        title="Alerts"
        description="Review pending alerts"
      />
    )
    expect(screen.getByText('Review pending alerts')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<PageHeader title="Test" />)
    const captions = container.querySelectorAll('.sf-caption')
    expect(captions.length).toBe(0)
  })

  it('renders action element when provided', () => {
    render(
      <PageHeader
        title="Test"
        action={<Button>Export</Button>}
      />
    )
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('renders title and description together', () => {
    render(
      <PageHeader
        title="Configuration"
        description="Manage system settings"
      />
    )
    expect(screen.getByRole('heading', { name: /configuration/i })).toBeInTheDocument()
    expect(screen.getByText('Manage system settings')).toBeInTheDocument()
  })

  it('renders title, description, and action together', () => {
    render(
      <PageHeader
        title="Screening"
        description="Screen new entities"
        action={<Button variant="primary">New</Button>}
      />
    )
    expect(screen.getByRole('heading', { name: /screening/i })).toBeInTheDocument()
    expect(screen.getByText('Screen new entities')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument()
  })
})
