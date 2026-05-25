import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ScreeningResults } from './ScreeningResults'

const mockResults = [
  { name: 'John Doe', confidence: 0.95 },
  { name: 'Jane Smith', confidence: 0.72 },
]

describe('ScreeningResults', () => {
  it('renders results title', () => {
    render(<ScreeningResults results={mockResults} />)
    expect(screen.getByText(/screening results/i)).toBeInTheDocument()
  })

  it('renders all result names', () => {
    render(<ScreeningResults results={mockResults} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('renders match description for each result', () => {
    render(<ScreeningResults results={mockResults} />)
    const matches = screen.getAllByText(/match found/i)
    expect(matches).toHaveLength(2)
  })

  it('renders empty list for no results', () => {
    const { container } = render(<ScreeningResults results={[]} />)
    expect(container.querySelectorAll('[class*="space-y-md"] > div')).toHaveLength(0)
  })

  it('renders one result correctly', () => {
    render(<ScreeningResults results={[{ name: 'Solo', confidence: 0.5 }]} />)
    expect(screen.getByText('Solo')).toBeInTheDocument()
  })
})
