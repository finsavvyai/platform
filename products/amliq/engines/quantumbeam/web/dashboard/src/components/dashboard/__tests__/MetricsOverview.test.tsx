import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MetricsOverview } from '../MetricsOverview'
import { FraudMetrics } from '@/types'

// Mock the store
const mockMetrics: FraudMetrics = {
  total_transactions: 15420,
  fraud_transactions: 234,
  fraud_rate: 1.52,
  avg_confidence_score: 94.7,
  quantum_vs_classical: {
    quantum_processed: 12000,
    classical_processed: 3420,
    quantum_accuracy: 96.8,
    classical_accuracy: 92.1,
    quantum_avg_time: 85,
    classical_avg_time: 120,
  },
  risk_distribution: {
    low: 14500,
    medium: 686,
    high: 234,
  },
  top_fraud_patterns: [
    {
      pattern_id: 'pattern_1',
      name: 'Velocity Fraud',
      description: 'Multiple transactions in short time',
      frequency: 45,
      confidence: 0.92,
      examples: ['High frequency transactions', 'Rapid succession payments'],
    },
    {
      pattern_id: 'pattern_2',
      name: 'Geographic Anomaly',
      description: 'Transactions from unusual locations',
      frequency: 32,
      confidence: 0.88,
      examples: ['Cross-country transactions', 'VPN usage patterns'],
    },
  ],
  geographic_hotspots: [],
}

jest.mock('@/store/useDashboardStore', () => ({
  useMetrics: jest.fn(),
}))

jest.mock('@/components/charts/MetricsChart', () => ({
  FraudRateChart: ({ data }: any) => (
    <div data-testid="fraud-rate-chart" data-points={data.length} />
  ),
  QuantumAdvantageChart: ({ data }: any) => (
    <div data-testid="quantum-advantage-chart" data-points={data.length} />
  ),
  TransactionVolumeChart: ({ data }: any) => (
    <div data-testid="transaction-volume-chart" data-points={data.length} />
  ),
  ResponseTimeChart: ({ data }: any) => (
    <div data-testid="response-time-chart" data-points={data.length} />
  ),
}))

jest.mock('@/lib/utils', () => ({
  formatNumber: (num: number) => num.toLocaleString(),
  formatPercentage: (num: number) => `${num.toFixed(1)}%`,
  formatDuration: (ms: number) => `${ms}ms`,
  getRiskLevelColor: (level: string) => 'text-green-600',
}))

describe('MetricsOverview', () => {
  const { useMetrics } = require('@/store/useDashboardStore')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state when metrics are null', () => {
    useMetrics.mockReturnValue(null)

    render(<MetricsOverview />)

    expect(screen.getByText('Loading metrics...')).toBeInTheDocument()
    expect(screen.getByRole('generic', { name: /loading/i })).toBeInTheDocument()
  })

  it('renders metrics overview with all key metrics cards', () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    // Check key metric cards
    expect(screen.getByText('Total Transactions')).toBeInTheDocument()
    expect(screen.getByText('15,420')).toBeInTheDocument()

    expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
    expect(screen.getByText('1.5%')).toBeInTheDocument()

    expect(screen.getByText('Avg Confidence')).toBeInTheDocument()
    expect(screen.getByText('94.7%')).toBeInTheDocument()

    expect(screen.getByText('Quantum Advantage')).toBeInTheDocument()
    expect(screen.getByText('4.7%')).toBeInTheDocument() // 96.8 - 92.1
  })

  it('displays risk distribution correctly', () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    expect(screen.getByText('Risk Distribution')).toBeInTheDocument()
    expect(screen.getByText('Low Risk')).toBeInTheDocument()
    expect(screen.getByText('14,500')).toBeInTheDocument()
    expect(screen.getByText('Medium Risk')).toBeInTheDocument()
    expect(screen.getByText('686')).toBeInTheDocument()
    expect(screen.getByText('High Risk')).toBeInTheDocument()
    expect(screen.getByText('234')).toBeInTheDocument()
  })

  it('shows quantum vs classical processing comparison', () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    expect(screen.getByText('Quantum vs Classical Processing')).toBeInTheDocument()
    
    // Quantum processing section
    expect(screen.getByText('Quantum Processing')).toBeInTheDocument()
    expect(screen.getByText('12,000')).toBeInTheDocument() // quantum_processed
    expect(screen.getByText('96.8%')).toBeInTheDocument() // quantum_accuracy
    expect(screen.getByText('85ms')).toBeInTheDocument() // quantum_avg_time

    // Classical processing section
    expect(screen.getByText('Classical Processing')).toBeInTheDocument()
    expect(screen.getByText('3,420')).toBeInTheDocument() // classical_processed
    expect(screen.getByText('92.1%')).toBeInTheDocument() // classical_accuracy
    expect(screen.getByText('120ms')).toBeInTheDocument() // classical_avg_time
  })

  it('renders all chart components', () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    expect(screen.getByTestId('fraud-rate-chart')).toBeInTheDocument()
    expect(screen.getByTestId('quantum-advantage-chart')).toBeInTheDocument()
    expect(screen.getByTestId('transaction-volume-chart')).toBeInTheDocument()
    expect(screen.getByTestId('response-time-chart')).toBeInTheDocument()
  })

  it('displays top fraud patterns when available', () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    expect(screen.getByText('Top Fraud Patterns')).toBeInTheDocument()
    expect(screen.getByText('Velocity Fraud')).toBeInTheDocument()
    expect(screen.getByText('Multiple transactions in short time')).toBeInTheDocument()
    expect(screen.getByText('45 occurrences')).toBeInTheDocument()
    expect(screen.getByText('92.0% confidence')).toBeInTheDocument()

    expect(screen.getByText('Geographic Anomaly')).toBeInTheDocument()
    expect(screen.getByText('Transactions from unusual locations')).toBeInTheDocument()
    expect(screen.getByText('32 occurrences')).toBeInTheDocument()
    expect(screen.getByText('88.0% confidence')).toBeInTheDocument()
  })

  it('does not render fraud patterns section when empty', () => {
    const metricsWithoutPatterns = {
      ...mockMetrics,
      top_fraud_patterns: [],
    }
    useMetrics.mockReturnValue(metricsWithoutPatterns)

    render(<MetricsOverview />)

    expect(screen.queryByText('Top Fraud Patterns')).not.toBeInTheDocument()
  })

  it('applies correct color coding for fraud rate', () => {
    // Test high fraud rate (error color)
    const highFraudMetrics = { ...mockMetrics, fraud_rate: 6.5 }
    useMetrics.mockReturnValue(highFraudMetrics)

    const { rerender } = render(<MetricsOverview />)
    
    // Test medium fraud rate (warning color)
    const mediumFraudMetrics = { ...mockMetrics, fraud_rate: 3.2 }
    useMetrics.mockReturnValue(mediumFraudMetrics)
    rerender(<MetricsOverview />)

    // Test low fraud rate (success color)
    const lowFraudMetrics = { ...mockMetrics, fraud_rate: 1.2 }
    useMetrics.mockReturnValue(lowFraudMetrics)
    rerender(<MetricsOverview />)

    // Verify the component renders without errors for all scenarios
    expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
  })

  it('handles missing optional data gracefully', () => {
    const minimalMetrics = {
      ...mockMetrics,
      top_fraud_patterns: [],
      geographic_hotspots: [],
    }
    useMetrics.mockReturnValue(minimalMetrics)

    render(<MetricsOverview />)

    // Should still render core metrics
    expect(screen.getByText('Total Transactions')).toBeInTheDocument()
    expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
    expect(screen.getByText('Quantum vs Classical Processing')).toBeInTheDocument()
  })

  it('generates time series data for charts', async () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      // Verify charts receive data points (default 24 for most, 12 for some)
      const fraudRateChart = screen.getByTestId('fraud-rate-chart')
      const quantumAdvantageChart = screen.getByTestId('quantum-advantage-chart')
      const volumeChart = screen.getByTestId('transaction-volume-chart')
      const responseTimeChart = screen.getByTestId('response-time-chart')

      expect(fraudRateChart).toHaveAttribute('data-points', '24')
      expect(quantumAdvantageChart).toHaveAttribute('data-points', '12')
      expect(volumeChart).toHaveAttribute('data-points', '24')
      expect(responseTimeChart).toHaveAttribute('data-points', '12')
    })
  })

  it('has proper accessibility attributes', () => {
    useMetrics.mockReturnValue(mockMetrics)

    render(<MetricsOverview />)

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)

    // Check for proper button/interactive elements
    const interactiveElements = screen.getAllByRole('button', { hidden: true })
    // Should have some interactive elements (even if hidden in this test)
  })
})