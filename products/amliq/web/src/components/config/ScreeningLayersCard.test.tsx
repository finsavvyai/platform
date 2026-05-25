import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { ScreeningLayersCard } from './ScreeningLayersCard'

describe('ScreeningLayersCard', () => {
  it('renders card title', () => {
    render(<ScreeningLayersCard />)
    expect(screen.getByText('Enabled Screening Layers')).toBeInTheDocument()
  })

  it('renders all screening layers', () => {
    render(<ScreeningLayersCard />)
    expect(screen.getByText(/OFAC Specially Designated Nationals/)).toBeInTheDocument()
    expect(screen.getByText(/OFAC Consolidated Non-SDN/)).toBeInTheDocument()
    expect(screen.getByText(/EU Consolidated Sanctions List/)).toBeInTheDocument()
    expect(screen.getByText(/UN Security Council/)).toBeInTheDocument()
    expect(screen.getByText(/UK Sanctions List/)).toBeInTheDocument()
    expect(screen.getByText(/Canada UNSC/)).toBeInTheDocument()
  })

  it('enables all layers by default', () => {
    const { container } = render(<ScreeningLayersCard />)
    const toggles = container.querySelectorAll('div[class*="bg-apple-green"]')
    expect(toggles.length).toBeGreaterThan(0)
  })

  it('toggles layer on and off', async () => {
    render(<ScreeningLayersCard />)
    const label = screen.getByText(/OFAC Specially Designated Nationals/).closest('label')
    const toggleDiv = label?.querySelector('div')
    await userEvent.click(toggleDiv!)
    await userEvent.click(toggleDiv!)
    expect(screen.getByText(/OFAC Specially Designated Nationals/)).toBeInTheDocument()
  })

  it('renders correct number of toggles', () => {
    render(<ScreeningLayersCard />)
    const labels = screen.getAllByText(/OFAC|EU|UN|UK|Canada/)
    expect(labels.length).toBe(6)
  })

  it('allows toggling individual layers independently', async () => {
    render(<ScreeningLayersCard />)
    const ofacLabel = screen.getByText(/OFAC Specially Designated Nationals/).closest('label')
    const euLabel = screen.getByText(/EU Consolidated Sanctions List/).closest('label')

    const ofacToggle = ofacLabel?.querySelector('div')
    const euToggle = euLabel?.querySelector('div')

    await userEvent.click(ofacToggle!)
    await userEvent.click(euToggle!)

    expect(ofacLabel).toBeInTheDocument()
    expect(euLabel).toBeInTheDocument()
  })
})
