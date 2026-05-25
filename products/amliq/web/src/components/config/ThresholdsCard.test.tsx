import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ThresholdsCard } from './ThresholdsCard'

describe('ThresholdsCard', () => {
  const defaultConfig = {
    fuzzyThreshold: 50,
    alertThreshold: 75,
  }

  it('renders card title', () => {
    render(<ThresholdsCard config={defaultConfig} onChange={vi.fn()} />)
    expect(screen.getByText('Thresholds')).toBeInTheDocument()
  })

  it('renders fuzzy match threshold slider', () => {
    render(<ThresholdsCard config={defaultConfig} onChange={vi.fn()} />)
    expect(screen.getByText('Fuzzy Match Threshold')).toBeInTheDocument()
  })

  it('renders alert threshold slider', () => {
    render(<ThresholdsCard config={defaultConfig} onChange={vi.fn()} />)
    expect(screen.getByText('Auto-Alert Threshold')).toBeInTheDocument()
  })

  it('displays current fuzzy threshold value', () => {
    render(<ThresholdsCard config={defaultConfig} onChange={vi.fn()} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('displays current alert threshold value', () => {
    render(<ThresholdsCard config={defaultConfig} onChange={vi.fn()} />)
    const percentages = screen.getAllByText(/\d+%/)
    expect(percentages.some(el => el.textContent === '75%')).toBe(true)
  })

  it('updates fuzzy threshold on slider change', () => {
    const handler = vi.fn()
    const { container } = render(
      <ThresholdsCard config={defaultConfig} onChange={handler} />
    )
    const sliders = container.querySelectorAll('input[type="range"]')
    const fuzzySlider = sliders[0] as HTMLInputElement

    fireEvent.change(fuzzySlider, { target: { value: '70' } })

    expect(handler).toHaveBeenCalled()
  })

  it('updates alert threshold on slider change', () => {
    const handler = vi.fn()
    const { container } = render(
      <ThresholdsCard config={defaultConfig} onChange={handler} />
    )
    const sliders = container.querySelectorAll('input[type="range"]')
    const alertSlider = sliders[1] as HTMLInputElement

    fireEvent.change(alertSlider, { target: { value: '85' } })

    expect(handler).toHaveBeenCalled()
  })

  it('renders slider descriptions', () => {
    render(<ThresholdsCard config={defaultConfig} onChange={vi.fn()} />)
    expect(screen.getByText('Minimum confidence for potential matches')).toBeInTheDocument()
    expect(screen.getByText('Automatically create alerts at this confidence level')).toBeInTheDocument()
  })

  it('sliders accept 0-100 range', async () => {
    const handler = vi.fn()
    const { container } = render(
      <ThresholdsCard config={defaultConfig} onChange={handler} />
    )
    const sliders = container.querySelectorAll('input[type="range"]')
    expect(sliders[0]).toHaveAttribute('min', '0')
    expect(sliders[0]).toHaveAttribute('max', '100')
  })
})
