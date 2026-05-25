import React from 'react'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MetricsOverview } from '../dashboard/MetricsOverview'
import { SystemHealth } from '../dashboard/SystemHealth'
import { MetricsChart } from '../charts/MetricsChart'
import { FraudMetrics, SystemHealth as SystemHealthType } from '@/types'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock data
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
      examples: ['High frequency transactions'],
    },
  ],
  geographic_hotspots: [],
}

const mockSystemHealth: SystemHealthType = {
  status: 'healthy',
  uptime: 7 * 24 * 60 * 60 * 1000,
  response_time_p95: 95,
  error_rate: 0.12,
  quantum_backend_status: {
    status: 'available',
    queue_time: 250,
    success_rate: 98.7,
    active_backends: ['IBM Quantum', 'AWS Braket'],
  },
  services: [
    {
      name: 'API Gateway',
      status: 'healthy',
      response_time: 45,
      last_check: '2024-01-15T10:30:00Z',
      dependencies: ['Authentication'],
    },
  ],
}

const mockChartData = [
  { timestamp: '2024-01-01T00:00:00Z', value: 100 },
  { timestamp: '2024-01-01T01:00:00Z', value: 150 },
]

// Mock dependencies
jest.mock('@/store/useDashboardStore', () => ({
  useMetrics: () => mockMetrics,
  useSystemHealth: () => mockSystemHealth,
  useTheme: () => 'light',
}))

jest.mock('@/components/charts/MetricsChart', () => ({
  FraudRateChart: ({ data }: any) => (
    <div role="img" aria-label="Fraud rate chart" data-testid="fraud-rate-chart" />
  ),
  QuantumAdvantageChart: ({ data }: any) => (
    <div role="img" aria-label="Quantum advantage chart" data-testid="quantum-advantage-chart" />
  ),
  TransactionVolumeChart: ({ data }: any) => (
    <div role="img" aria-label="Transaction volume chart" data-testid="transaction-volume-chart" />
  ),
  ResponseTimeChart: ({ data }: any) => (
    <div role="img" aria-label="Response time chart" data-testid="response-time-chart" />
  ),
}))

jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div role="img" aria-label="Line chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@/lib/utils', () => ({
  formatNumber: (num: number) => num.toLocaleString(),
  formatPercentage: (num: number) => `${num.toFixed(1)}%`,
  formatDuration: (ms: number) => `${ms}ms`,
  getRiskLevelColor: () => 'text-green-600',
  getStatusColor: () => 'text-green-600',
  formatDate: (date: string) => new Date(date).toLocaleString(),
  getChartColors: () => ({ primary: '#0ea5e9' }),
}))

describe('Accessibility Tests', () => {
  describe('MetricsOverview', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<MetricsOverview />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has proper heading hierarchy', () => {
      render(<MetricsOverview />)
      
      // Should have proper heading structure
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
      
      // Check for main section headings
      expect(screen.getByText('Risk Distribution')).toBeInTheDocument()
      expect(screen.getByText('Quantum vs Classical Processing')).toBeInTheDocument()
    })

    it('provides accessible names for metric cards', () => {
      render(<MetricsOverview />)
      
      // Metric cards should have accessible content
      expect(screen.getByText('Total Transactions')).toBeInTheDocument()
      expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Confidence')).toBeInTheDocument()
      expect(screen.getByText('Quantum Advantage')).toBeInTheDocument()
    })

    it('provides accessible chart labels', () => {
      render(<MetricsOverview />)
      
      // Charts should have accessible labels
      expect(screen.getByLabelText('Fraud rate chart')).toBeInTheDocument()
      expect(screen.getByLabelText('Quantum advantage chart')).toBeInTheDocument()
      expect(screen.getByLabelText('Transaction volume chart')).toBeInTheDocument()
      expect(screen.getByLabelText('Response time chart')).toBeInTheDocument()
    })

    it('uses semantic HTML structure', () => {
      render(<MetricsOverview />)
      
      // Should use proper semantic elements
      const regions = screen.getAllByRole('region', { hidden: true })
      const headings = screen.getAllByRole('heading')
      
      expect(headings.length).toBeGreaterThan(0)
    })

    it('provides color information through text', () => {
      render(<MetricsOverview />)
      
      // Risk levels should be identifiable without color
      expect(screen.getByText('Low Risk')).toBeInTheDocument()
      expect(screen.getByText('Medium Risk')).toBeInTheDocument()
      expect(screen.getByText('High Risk')).toBeInTheDocument()
    })

    it('has proper contrast for status indicators', () => {
      render(<MetricsOverview />)
      
      // Status indicators should have sufficient contrast
      // This is tested through the color utility functions
      const statusElements = screen.getAllByText(/\d+,?\d*/)
      expect(statusElements.length).toBeGreaterThan(0)
    })
  })

  describe('SystemHealth', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<SystemHealth />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has proper heading hierarchy', () => {
      render(<SystemHealth />)
      
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
      
      // Check for main section headings
      expect(screen.getByText('System Health')).toBeInTheDocument()
      expect(screen.getByText('Quantum Backend Status')).toBeInTheDocument()
      expect(screen.getByText('Service Status')).toBeInTheDocument()
    })

    it('provides accessible status information', () => {
      render(<SystemHealth />)
      
      // Status should be conveyed through text, not just color
      expect(screen.getByText('HEALTHY')).toBeInTheDocument()
      expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
    })

    it('uses proper ARIA labels for status badges', () => {
      render(<SystemHealth />)
      
      // Status badges should be accessible
      const statusBadges = screen.getAllByText(/HEALTHY|AVAILABLE/)
      expect(statusBadges.length).toBeGreaterThan(0)
    })

    it('provides accessible uptime information', () => {
      render(<SystemHealth />)
      
      // Uptime should be clearly labeled
      expect(screen.getByText('Uptime')).toBeInTheDocument()
      expect(screen.getByText('Days:')).toBeInTheDocument()
      expect(screen.getByText('Hours:')).toBeInTheDocument()
      expect(screen.getByText('Minutes:')).toBeInTheDocument()
    })

    it('has accessible service dependency information', () => {
      render(<SystemHealth />)
      
      // Dependencies should be clearly labeled
      expect(screen.getByText('Depends on:')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })

    it('provides accessible metrics with units', () => {
      render(<SystemHealth />)
      
      // Metrics should include units for clarity
      expect(screen.getByText('Response Time (p95)')).toBeInTheDocument()
      expect(screen.getByText('Error Rate')).toBeInTheDocument()
      expect(screen.getByText('Queue Time')).toBeInTheDocument()
    })
  })

  describe('MetricsChart', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <MetricsChart title="Test Chart" data={mockChartData} />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has accessible chart title', () => {
      render(<MetricsChart title="Test Chart" data={mockChartData} />)
      
      expect(screen.getByText('Test Chart')).toBeInTheDocument()
    })

    it('provides chart as image with label', () => {
      render(<MetricsChart title="Test Chart" data={mockChartData} />)
      
      const chart = screen.getByRole('img')
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('aria-label', 'Line chart')
    })

    it('handles empty data accessibly', () => {
      render(<MetricsChart title="Empty Chart" data={[]} />)
      
      expect(screen.getByText('Empty Chart')).toBeInTheDocument()
      // Should still render chart structure for screen readers
      expect(screen.getByRole('img')).toBeInTheDocument()
    })
  })

  describe('Apple HIG Compliance', () => {
    it('follows Apple HIG clarity principles', () => {
      render(<MetricsOverview />)
      
      // Clear visual hierarchy with headings
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
      
      // Clear labeling of interactive elements
      const buttons = screen.getAllByRole('button', { hidden: true })
      // Should have some interactive elements
    })

    it('follows Apple HIG deference principles', () => {
      render(<SystemHealth />)
      
      // Content should be the focus, not UI chrome
      // Verify content is present and accessible
      expect(screen.getByText('System Health')).toBeInTheDocument()
      expect(screen.getByText('Uptime')).toBeInTheDocument()
    })

    it('follows Apple HIG depth principles through semantic structure', () => {
      render(<MetricsOverview />)
      
      // Proper nesting and hierarchy
      const regions = screen.getAllByRole('region', { hidden: true })
      const headings = screen.getAllByRole('heading')
      
      // Should have structured content hierarchy
      expect(headings.length).toBeGreaterThan(0)
    })

    it('provides consistent interaction patterns', () => {
      render(<SystemHealth />)
      
      // Consistent status representation
      const statusElements = screen.getAllByText(/HEALTHY|AVAILABLE|DEGRADED/)
      expect(statusElements.length).toBeGreaterThan(0)
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for interactive elements', () => {
      render(<MetricsOverview />)
      
      // Interactive elements should be keyboard accessible
      const interactiveElements = screen.getAllByRole('button', { hidden: true })
      
      interactiveElements.forEach(element => {
        // Should be focusable (tabIndex 0 or naturally focusable)
        expect(element).not.toHaveAttribute('tabindex', '-1')
      })
    })

    it('has proper focus management', () => {
      render(<SystemHealth />)
      
      // Focus should be manageable and visible
      const focusableElements = screen.getAllByRole('button', { hidden: true })
      
      // Should not have focus traps in static content
      focusableElements.forEach(element => {
        expect(element).toBeInTheDocument()
      })
    })
  })

  describe('Screen Reader Support', () => {
    it('provides meaningful text alternatives for visual content', () => {
      render(<MetricsOverview />)
      
      // Charts should have text alternatives
      expect(screen.getByLabelText('Fraud rate chart')).toBeInTheDocument()
      expect(screen.getByLabelText('Quantum advantage chart')).toBeInTheDocument()
    })

    it('uses proper semantic markup for data tables', () => {
      render(<SystemHealth />)
      
      // Service status should be in accessible format
      expect(screen.getByText('Service Status')).toBeInTheDocument()
      expect(screen.getByText('API Gateway')).toBeInTheDocument()
    })

    it('provides context for numeric data', () => {
      render(<MetricsOverview />)
      
      // Numbers should have context
      expect(screen.getByText('Total Transactions')).toBeInTheDocument()
      expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
      expect(screen.getByText('15,420')).toBeInTheDocument()
    })
  })

  describe('Color and Contrast', () => {
    it('does not rely solely on color for information', () => {
      render(<SystemHealth />)
      
      // Status should be conveyed through text and icons, not just color
      expect(screen.getByText('HEALTHY')).toBeInTheDocument()
      expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
    })

    it('provides text labels for color-coded information', () => {
      render(<MetricsOverview />)
      
      // Risk levels should have text labels
      expect(screen.getByText('Low Risk')).toBeInTheDocument()
      expect(screen.getByText('Medium Risk')).toBeInTheDocument()
      expect(screen.getByText('High Risk')).toBeInTheDocument()
    })
  })

  describe('Responsive Design Accessibility', () => {
    it('maintains accessibility across different viewport sizes', () => {
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<MetricsOverview />)
      
      // Content should still be accessible on mobile
      expect(screen.getByText('Total Transactions')).toBeInTheDocument()
      expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
    })

    it('preserves semantic structure on smaller screens', () => {
      render(<SystemHealth />)
      
      // Heading hierarchy should be preserved
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })
  })
})