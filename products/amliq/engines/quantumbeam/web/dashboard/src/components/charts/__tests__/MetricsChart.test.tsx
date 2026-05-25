import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MetricsChart, FraudRateChart, QuantumAdvantageChart, TransactionVolumeChart, ResponseTimeChart } from '../MetricsChart'

// Mock recharts with more detailed mocks
jest.mock('recharts', () => ({
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={data?.length || 0}>
      {children}
    </div>
  ),
  Line: ({ stroke, strokeWidth }: any) => (
    <div data-testid="line" data-stroke={stroke} data-stroke-width={strokeWidth} />
  ),
  AreaChart: ({ children, data }: any) => (
    <div data-testid="area-chart" data-points={data?.length || 0}>
      {children}
    </div>
  ),
  Area: ({ stroke, fill, fillOpacity }: any) => (
    <div data-testid="area" data-stroke={stroke} data-fill={fill} data-fill-opacity={fillOpacity} />
  ),
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-points={data?.length || 0}>
      {children}
    </div>
  ),
  Bar: ({ fill }: any) => <div data-testid="bar" data-fill={fill} />,
  XAxis: ({ tickFormatter }: any) => (
    <div data-testid="x-axis" data-has-formatter={!!tickFormatter} />
  ),
  YAxis: ({ tickFormatter }: any) => (
    <div data-testid="y-axis" data-has-formatter={!!tickFormatter} />
  ),
  CartesianGrid: ({ strokeDasharray }: any) => (
    <div data-testid="cartesian-grid" data-dash-array={strokeDasharray} />
  ),
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip" data-has-custom-content={!!content} />
  ),
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
}))

// Mock the store
jest.mock('@/store/useDashboardStore', () => ({
  useTheme: () => 'light',
}))

// Mock utils
jest.mock('@/lib/utils', () => ({
  formatNumber: (num: number) => num.toLocaleString(),
  formatPercentage: (num: number) => `${num.toFixed(1)}%`,
  getChartColors: (theme: string) => ({
    primary: theme === 'dark' ? '#60a5fa' : '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
  }),
}))

describe('MetricsChart', () => {
  const mockData = [
    { timestamp: '2024-01-01T00:00:00Z', value: 100 },
    { timestamp: '2024-01-01T01:00:00Z', value: 150 },
    { timestamp: '2024-01-01T02:00:00Z', value: 120 },
  ]

  describe('Basic Rendering', () => {
    it('renders chart with default line type', () => {
      render(<MetricsChart title="Test Chart" data={mockData} />)

      expect(screen.getByText('Test Chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '3')
    })

    it('renders area chart when type is area', () => {
      render(<MetricsChart title="Area Chart" data={mockData} type="area" />)

      expect(screen.getByText('Area Chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area')).toBeInTheDocument()
    })

    it('renders bar chart when type is bar', () => {
      render(<MetricsChart title="Bar Chart" data={mockData} type="bar" />)

      expect(screen.getByText('Bar Chart')).toBeInTheDocument()
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      expect(screen.getByTestId('bar')).toBeInTheDocument()
    })

    it('applies custom height', () => {
      const { container } = render(
        <MetricsChart title="Custom Height" data={mockData} height={500} />
      )

      const chartContainer = container.querySelector('[style*="height: 500px"]')
      expect(chartContainer).toBeInTheDocument()
    })
  })

  describe('Configuration Options', () => {
    it('hides grid when showGrid is false', () => {
      render(<MetricsChart title="No Grid" data={mockData} showGrid={false} />)

      expect(screen.queryByTestId('cartesian-grid')).not.toBeInTheDocument()
    })

    it('shows grid when showGrid is true', () => {
      render(<MetricsChart title="With Grid" data={mockData} showGrid={true} />)

      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    })

    it('displays legend when showLegend is true', () => {
      render(<MetricsChart title="With Legend" data={mockData} showLegend />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('hides legend when showLegend is false', () => {
      render(<MetricsChart title="No Legend" data={mockData} showLegend={false} />)

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
    })

    it('shows tooltip when showTooltip is true', () => {
      render(<MetricsChart title="With Tooltip" data={mockData} showTooltip />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('hides tooltip when showTooltip is false', () => {
      render(<MetricsChart title="No Tooltip" data={mockData} showTooltip={false} />)

      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument()
    })
  })

  describe('Styling and Customization', () => {
    it('applies custom color', () => {
      render(<MetricsChart title="Custom Color" data={mockData} color="#ff0000" />)

      const line = screen.getByTestId('line')
      expect(line).toHaveAttribute('data-stroke', '#ff0000')
    })

    it('applies custom stroke width', () => {
      render(<MetricsChart title="Custom Stroke" data={mockData} strokeWidth={5} />)

      const line = screen.getByTestId('line')
      expect(line).toHaveAttribute('data-stroke-width', '5')
    })

    it('applies custom fill opacity for area charts', () => {
      render(
        <MetricsChart 
          title="Custom Opacity" 
          data={mockData} 
          type="area" 
          fillOpacity={0.8} 
        />
      )

      const area = screen.getByTestId('area')
      expect(area).toHaveAttribute('data-fill-opacity', '0.8')
    })

    it('uses different curve types', () => {
      const { rerender } = render(
        <MetricsChart title="Monotone Curve" data={mockData} curve="monotone" />
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()

      rerender(<MetricsChart title="Linear Curve" data={mockData} curve="linear" />)
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()

      rerender(<MetricsChart title="Step Curve" data={mockData} curve="step" />)
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })
  })

  describe('Data Formatting', () => {
    it('formats values as numbers by default', () => {
      render(<MetricsChart title="Number Format" data={mockData} />)

      const yAxis = screen.getByTestId('y-axis')
      expect(yAxis).toHaveAttribute('data-has-formatter', 'true')
    })

    it('formats values as percentages', () => {
      render(<MetricsChart title="Percentage Format" data={mockData} valueFormat="percentage" />)

      const yAxis = screen.getByTestId('y-axis')
      expect(yAxis).toHaveAttribute('data-has-formatter', 'true')
    })

    it('formats values as currency', () => {
      render(<MetricsChart title="Currency Format" data={mockData} valueFormat="currency" />)

      const yAxis = screen.getByTestId('y-axis')
      expect(yAxis).toHaveAttribute('data-has-formatter', 'true')
    })

    it('formats timestamps on x-axis', () => {
      render(<MetricsChart title="Time Format" data={mockData} />)

      const xAxis = screen.getByTestId('x-axis')
      expect(xAxis).toHaveAttribute('data-has-formatter', 'true')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty data gracefully', () => {
      render(<MetricsChart title="Empty Data" data={[]} />)

      expect(screen.getByText('Empty Data')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '0')
    })

    it('handles single data point', () => {
      const singlePoint = [{ timestamp: '2024-01-01T00:00:00Z', value: 100 }]
      render(<MetricsChart title="Single Point" data={singlePoint} />)

      expect(screen.getByText('Single Point')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '1')
    })

    it('handles null/undefined values in data', () => {
      const dataWithNulls = [
        { timestamp: '2024-01-01T00:00:00Z', value: 100 },
        { timestamp: '2024-01-01T01:00:00Z', value: null as any },
        { timestamp: '2024-01-01T02:00:00Z', value: 120 },
      ]
      render(<MetricsChart title="Null Values" data={dataWithNulls} />)

      expect(screen.getByText('Null Values')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })

    it('handles very large numbers', () => {
      const largeData = [
        { timestamp: '2024-01-01T00:00:00Z', value: 1000000 },
        { timestamp: '2024-01-01T01:00:00Z', value: 2000000 },
      ]
      render(<MetricsChart title="Large Numbers" data={largeData} />)

      expect(screen.getByText('Large Numbers')).toBeInTheDocument()
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })
  })

  describe('Responsive Container', () => {
    it('uses responsive container', () => {
      render(<MetricsChart title="Responsive" data={mockData} />)

      const container = screen.getByTestId('responsive-container')
      expect(container).toBeInTheDocument()
      expect(container).toHaveAttribute('data-width', '100%')
      expect(container).toHaveAttribute('data-height', '100%')
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<MetricsChart title="Accessible Chart" data={mockData} />)

      const heading = screen.getByRole('heading', { name: 'Accessible Chart' })
      expect(heading).toBeInTheDocument()
    })

    it('provides chart structure for screen readers', () => {
      render(<MetricsChart title="Screen Reader Chart" data={mockData} />)

      // Chart components should be present for screen reader navigation
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('x-axis')).toBeInTheDocument()
      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    })
  })
})

describe('Specialized Chart Components', () => {
  const mockData = [
    { timestamp: '2024-01-01T00:00:00Z', value: 2.5 },
    { timestamp: '2024-01-01T01:00:00Z', value: 3.1 },
  ]

  it('renders FraudRateChart with correct configuration', () => {
    render(<FraudRateChart data={mockData} />)

    expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    
    const area = screen.getByTestId('area')
    expect(area).toHaveAttribute('data-stroke', '#ef4444')
    expect(area).toHaveAttribute('data-fill-opacity', '0.2')
  })

  it('renders QuantumAdvantageChart with correct configuration', () => {
    render(<QuantumAdvantageChart data={mockData} />)

    expect(screen.getByText('Quantum Advantage')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    
    const line = screen.getByTestId('line')
    expect(line).toHaveAttribute('data-stroke', '#0ea5e9')
    expect(line).toHaveAttribute('data-stroke-width', '3')
  })

  it('renders TransactionVolumeChart with correct configuration', () => {
    render(<TransactionVolumeChart data={mockData} />)

    expect(screen.getByText('Transaction Volume')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    
    const bar = screen.getByTestId('bar')
    expect(bar).toHaveAttribute('data-fill', '#10b981')
  })

  it('renders ResponseTimeChart with correct configuration', () => {
    render(<ResponseTimeChart data={mockData} />)

    expect(screen.getByText('Response Time')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    
    const line = screen.getByTestId('line')
    expect(line).toHaveAttribute('data-stroke', '#f59e0b')
  })
})

describe('Theme Integration', () => {
  it('adapts to dark theme', () => {
    // Mock dark theme
    jest.mocked(require('@/store/useDashboardStore').useTheme).mockReturnValue('dark')

    render(<MetricsChart title="Dark Theme" data={mockData} />)

    expect(screen.getByText('Dark Theme')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('adapts to light theme', () => {
    // Mock light theme
    jest.mocked(require('@/store/useDashboardStore').useTheme).mockReturnValue('light')

    render(<MetricsChart title="Light Theme" data={mockData} />)

    expect(screen.getByText('Light Theme')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})