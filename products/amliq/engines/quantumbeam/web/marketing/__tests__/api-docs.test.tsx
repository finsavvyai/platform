import { render, screen } from '@testing-library/react'
import { expect, test, describe } from 'vitest'
import APIDocsPage from '../app/api-docs/page'

describe('APIDocsPage', () => {
  test('renders API documentation header', () => {
    render(<APIDocsPage />)
    expect(screen.getByText('API Documentation')).toBeInTheDocument()
  })

  test('displays authentication information', () => {
    render(<APIDocsPage />)
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Authorization: Bearer YOUR_API_KEY')).toBeInTheDocument()
  })

  test('shows API examples tabs', () => {
    render(<APIDocsPage />)
    expect(screen.getByText('Transaction Analysis')).toBeInTheDocument()
    expect(screen.getByText('Batch Processing')).toBeInTheDocument()
    expect(screen.getByText('Real-time Monitoring')).toBeInTheDocument()
  })

  test('displays code examples', () => {
    render(<APIDocsPage />)
    expect(screen.getByText('curl -X POST')).toBeInTheDocument()
    expect(screen.getByText('risk_score')).toBeInTheDocument()
    expect(screen.getByText('quantum_confidence')).toBeInTheDocument()
  })

  test('shows rate limits information', () => {
    render(<APIDocsPage />)
    expect(screen.getByText('Rate Limits')).toBeInTheDocument()
    expect(screen.getByText('Standard Plan')).toBeInTheDocument()
    expect(screen.getByText('Enterprise Plan')).toBeInTheDocument()
  })

  test('displays error handling information', () => {
    render(<APIDocsPage />)
    expect(screen.getByText('Error Handling')).toBeInTheDocument()
    expect(screen.getByText('Bad Request')).toBeInTheDocument()
    expect(screen.getByText('Unauthorized')).toBeInTheDocument()
  })
})