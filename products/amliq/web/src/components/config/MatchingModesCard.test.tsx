import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MatchingModesCard } from './MatchingModesCard'

describe('MatchingModesCard', () => {
  const defaultProps = {
    strictMatching: true,
    autoAlert: false,
    onChange: vi.fn(),
  }

  it('renders card title', () => {
    render(<MatchingModesCard {...defaultProps} />)
    expect(screen.getByText('Matching Modes')).toBeInTheDocument()
  })

  it('renders strict matching toggle', () => {
    render(<MatchingModesCard {...defaultProps} />)
    expect(screen.getByText('Strict Matching Mode')).toBeInTheDocument()
  })

  it('renders auto alert toggle', () => {
    render(<MatchingModesCard {...defaultProps} />)
    expect(screen.getByText('Automatic Alerting')).toBeInTheDocument()
  })

  it('displays strict matching description', () => {
    render(<MatchingModesCard {...defaultProps} />)
    expect(screen.getByText('Require exact matches on key identifiers')).toBeInTheDocument()
  })

  it('displays auto alert description', () => {
    render(<MatchingModesCard {...defaultProps} />)
    expect(screen.getByText('Automatically create alerts for high-confidence matches')).toBeInTheDocument()
  })

  it('calls onChange when strict matching toggle clicked', async () => {
    const handler = vi.fn()
    render(<MatchingModesCard {...defaultProps} onChange={handler} />)
    const label = screen.getByText('Strict Matching Mode').closest('label')
    const toggle = label?.querySelector('div')
    await userEvent.click(toggle!)
    expect(handler).toHaveBeenCalledWith('strictMatching', false)
  })

  it('calls onChange when auto alert toggle clicked', async () => {
    const handler = vi.fn()
    render(<MatchingModesCard {...defaultProps} onChange={handler} />)
    const label = screen.getByText('Automatic Alerting').closest('label')
    const toggle = label?.querySelector('div')
    await userEvent.click(toggle!)
    expect(handler).toHaveBeenCalledWith('autoAlert', true)
  })

  it('reflects current mode states', () => {
    const { rerender } = render(
      <MatchingModesCard
        strictMatching={true}
        autoAlert={false}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Strict Matching Mode')).toBeInTheDocument()

    rerender(
      <MatchingModesCard
        strictMatching={false}
        autoAlert={true}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Automatic Alerting')).toBeInTheDocument()
  })
})
