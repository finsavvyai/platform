import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EntityDetailsCard } from './EntityDetailsCard'
import { createMockAlert } from '../../test/utils'

describe('EntityDetailsCard', () => {
  it('renders entity type', () => {
    const alert = createMockAlert()
    render(<EntityDetailsCard alert={alert} />)
    expect(screen.getByText('individual')).toBeInTheDocument()
  })

  it('renders match count', () => {
    const alert = createMockAlert({ matchedCount: 7 })
    render(<EntityDetailsCard alert={alert} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('hides nationality field when missing', () => {
    const alert = createMockAlert()
    render(<EntityDetailsCard alert={alert} />)
    expect(screen.queryByText('N/A')).not.toBeInTheDocument()
  })

  it('renders nationality when provided', () => {
    const alert = createMockAlert({
      entity: {
        id: 'e-1', type: 'individual',
        name: { firstName: 'John', lastName: 'Doe', aliases: [] },
        identifiers: [], nationality: 'US',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    })
    render(<EntityDetailsCard alert={alert} />)
    expect(screen.getByText('US')).toBeInTheDocument()
  })

  it('renders date of birth when provided', () => {
    const alert = createMockAlert({
      entity: {
        id: 'e-1', type: 'individual',
        name: { firstName: 'John', lastName: 'Doe', aliases: [] },
        identifiers: [], dob: '1990-01-15',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    })
    render(<EntityDetailsCard alert={alert} />)
    expect(screen.getByText(/1990/)).toBeInTheDocument()
  })

  it('hides dob section when not provided', () => {
    const alert = createMockAlert()
    render(<EntityDetailsCard alert={alert} />)
    expect(screen.queryByText(/date of birth/i)).not.toBeInTheDocument()
  })

  it('renders heading', () => {
    render(<EntityDetailsCard alert={createMockAlert()} />)
    expect(screen.getByText(/entity details/i)).toBeInTheDocument()
  })
})
