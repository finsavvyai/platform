import { render, screen } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import GetStartedPage from '../app/get-started/page'

describe('GetStartedPage', () => {
  test('renders sign-up page header', () => {
    render(<GetStartedPage />)
    expect(screen.getByText('Get Started with QuantumBeam')).toBeInTheDocument()
  })

  test('displies pricing plans', () => {
    render(<GetStartedPage />)
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Professional')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
  })

  test('shows form fields', () => {
    render(<GetStartedPage />)
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
    expect(screen.getByText('Work Email')).toBeInTheDocument()
    expect(screen.getByText('Company Name')).toBeInTheDocument()
  })

  test('displays use cases', () => {
    render(<GetStartedPage />)
    expect(screen.getByText('Payment Processing')).toBeInTheDocument()
    expect(screen.getByText('Account Protection')).toBeInTheDocument()
    expect(screen.getByText('User Verification')).toBeInTheDocument()
    expect(screen.getByText('Enterprise Security')).toBeInTheDocument()
  })

  test('shows plan features', () => {
    render(<GetStartedPage />)
    expect(screen.getByText('Standard ML models')).toBeInTheDocument()
    expect(screen.getByText('Advanced ML models')).toBeInTheDocument()
    expect(screen.getByText('Custom quantum model development')).toBeInTheDocument()
  })

  test('displays trial information', () => {
    render(<GetStartedPage />)
    expect(screen.getByText('14-day free trial')).toBeInTheDocument()
    expect(screen.getByText('No credit card required')).toBeInTheDocument()
    expect(screen.getByText('Personalized onboarding')).toBeInTheDocument()
  })
})