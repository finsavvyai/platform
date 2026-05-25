import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AlertCard } from './AlertCard'
import { createMockAlert } from '../../test/utils'

describe('AlertCard', () => {
  it('renders alert name', () => {
    const alert = createMockAlert({
      entity: {
        id: 'ent1',
        type: 'individual',
        name: {
          firstName: 'John',
          lastName: 'Doe',
          aliases: [],
        },
        identifiers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders entity type', () => {
    const alert = createMockAlert({ entity: { id: 'ent1', type: 'company', name: { firstName: '', lastName: '', aliases: [] }, identifiers: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('company')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    const alert = createMockAlert({ status: 'investigating' })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('Investigating')).toBeInTheDocument()
  })

  it('renders priority badge', () => {
    const alert = createMockAlert({ priority: 'critical' })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })

  it('renders risk level badge', () => {
    const alert = createMockAlert({ riskLevel: 'high' })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('Risk: high')).toBeInTheDocument()
  })

  it('renders alert notes', () => {
    const alert = createMockAlert({ notes: 'Suspicious transaction pattern detected' })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('Suspicious transaction pattern detected')).toBeInTheDocument()
  })

  it('renders matched count', () => {
    const alert = createMockAlert({ matchedCount: 5 })
    render(<AlertCard alert={alert} />)
    expect(screen.getByText('5 matches')).toBeInTheDocument()
  })

  it('renders creation date', () => {
    const dateStr = '2024-01-15T10:00:00.000Z'
    const alert = createMockAlert({ createdAt: dateStr })
    render(<AlertCard alert={alert} />)
    const date = new Date(dateStr).toLocaleDateString()
    expect(screen.getByText(date)).toBeInTheDocument()
  })

  it('calls onClick handler when clicked', async () => {
    const handler = vi.fn()
    const alert = createMockAlert()
    render(<AlertCard alert={alert} onClick={handler} />)
    await userEvent.click(screen.getByText(alert.entity.name.firstName + ' ' + alert.entity.name.lastName).closest('div')!)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('renders different risk level colors', () => {
    const { rerender } = render(<AlertCard alert={createMockAlert({ riskLevel: 'critical' })} />)
    expect(screen.getByText('Risk: critical')).toHaveClass('bg-red-50', 'text-red-700')

    rerender(<AlertCard alert={createMockAlert({ riskLevel: 'low' })} />)
    expect(screen.getByText('Risk: low')).toHaveClass('bg-emerald-50', 'text-emerald-700')
  })
})
