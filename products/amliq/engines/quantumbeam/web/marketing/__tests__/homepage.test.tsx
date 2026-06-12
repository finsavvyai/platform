import { render, screen } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import HomePage from '../app/page'

describe('HomePage', () => {
  test('renders main heading', () => {
    render(<HomePage />)
    expect(screen.getByText(/Fraud Detection/)).toBeInTheDocument()
  })

  test('displays key statistics', () => {
    render(<HomePage />)
    expect(screen.getByText('ML')).toBeInTheDocument()
    expect(screen.getByText('<50ms')).toBeInTheDocument()
    expect(screen.getByText('24/7')).toBeInTheDocument()
  })

  test('renders navigation links', () => {
    render(<HomePage />)
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
  })

  test('displays call-to-action buttons', () => {
    render(<HomePage />)
    expect(screen.getAllByText('Start Free Trial').length).toBeGreaterThan(0)
    expect(screen.getByText('Watch Demo')).toBeInTheDocument()
  })

  test('shows feature cards', () => {
    render(<HomePage />)
    expect(screen.getByText('Ensemble Machine Learning')).toBeInTheDocument()
    expect(screen.getByText('Real-Time Processing')).toBeInTheDocument()
    expect(screen.getByText('Strong Encryption')).toBeInTheDocument()
  })

  test('does not make quantum-computing or accuracy claims', () => {
    render(<HomePage />)
    expect(screen.queryByText(/Powered by Quantum Computing/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/quantum algorithms/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/99\.7/)).not.toBeInTheDocument()
  })
})
