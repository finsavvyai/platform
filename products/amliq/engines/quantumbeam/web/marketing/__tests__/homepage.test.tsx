import { render, screen } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import HomePage from '../app/page'

describe('HomePage', () => {
  test('renders main heading', () => {
    render(<HomePage />)
    expect(screen.getByText(/Quantum-Powered Fraud Detection/)).toBeInTheDocument()
  })

  test('displays key statistics', () => {
    render(<HomePage />)
    expect(screen.getByText('99.7%')).toBeInTheDocument()
    expect(screen.getByText('100M+/sec')).toBeInTheDocument()
    expect(screen.getByText('<0.1%')).toBeInTheDocument()
  })

  test('renders navigation links', () => {
    render(<HomePage />)
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
  })

  test('displays call-to-action buttons', () => {
    render(<HomePage />)
    expect(screen.getByText('Start Free Trial')).toBeInTheDocument()
    expect(screen.getByText('Watch Demo')).toBeInTheDocument()
  })

  test('shows feature cards', () => {
    render(<HomePage />)
    expect(screen.getByText('Quantum Machine Learning')).toBeInTheDocument()
    expect(screen.getByText('Real-time Processing')).toBeInTheDocument()
    expect(screen.getByText('Quantum Encryption')).toBeInTheDocument()
  })

  test('includes quantum-themed elements', () => {
    render(<HomePage />)
    expect(screen.getByText('Quantum-Enhanced Security')).toBeInTheDocument()
    expect(screen.getByText('Quantum Advantage')).toBeInTheDocument()
    expect(screen.getByText('How Quantum Works')).toBeInTheDocument()
  })
})