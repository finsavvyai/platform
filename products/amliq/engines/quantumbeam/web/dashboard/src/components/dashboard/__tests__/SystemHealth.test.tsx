import React from 'react'
import { render, screen } from '@testing-library/react'
import { SystemHealth } from '../SystemHealth'
import { SystemHealth as SystemHealthType } from '@/types'

// Mock system health data
const mockSystemHealth: SystemHealthType = {
  status: 'healthy',
  uptime: 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000 + 30 * 60 * 1000, // 7 days, 5 hours, 30 minutes
  response_time_p95: 95,
  error_rate: 0.12,
  quantum_backend_status: {
    status: 'available',
    queue_time: 250,
    success_rate: 98.7,
    active_backends: ['IBM Quantum', 'AWS Braket', 'Google Quantum AI'],
  },
  services: [
    {
      name: 'API Gateway',
      status: 'healthy',
      response_time: 45,
      last_check: '2024-01-15T10:30:00Z',
      dependencies: ['Authentication', 'Rate Limiting'],
    },
    {
      name: 'Fraud Detection Service',
      status: 'healthy',
      response_time: 85,
      last_check: '2024-01-15T10:29:45Z',
      dependencies: ['Quantum Engine', 'Database'],
    },
    {
      name: 'Quantum Processing Engine',
      status: 'healthy',
      response_time: 120,
      last_check: '2024-01-15T10:29:30Z',
      dependencies: ['Quantum Backends'],
    },
  ],
}

const mockDegradedSystemHealth: SystemHealthType = {
  ...mockSystemHealth,
  status: 'degraded',
  error_rate: 2.5,
  quantum_backend_status: {
    ...mockSystemHealth.quantum_backend_status,
    status: 'degraded',
    success_rate: 85.2,
  },
  services: [
    ...mockSystemHealth.services.slice(0, 2),
    {
      name: 'Quantum Processing Engine',
      status: 'unhealthy',
      response_time: 450,
      last_check: '2024-01-15T10:25:00Z',
      dependencies: ['Quantum Backends'],
    },
  ],
}

jest.mock('@/store/useDashboardStore', () => ({
  useSystemHealth: jest.fn(),
}))

jest.mock('@/lib/utils', () => ({
  formatDuration: (ms: number) => `${ms}ms`,
  getStatusColor: (status: string) => 'text-green-600',
  formatDate: (date: string) => new Date(date).toLocaleString(),
}))

describe('SystemHealth', () => {
  const { useSystemHealth } = require('@/store/useDashboardStore')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state when system health is null', () => {
    useSystemHealth.mockReturnValue(null)

    render(<SystemHealth />)

    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText('Loading system health...')).toBeInTheDocument()
  })

  it('renders healthy system status correctly', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    // Check overall status
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText('HEALTHY')).toBeInTheDocument()

    // Check uptime display
    expect(screen.getByText('Uptime')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument() // days
    expect(screen.getByText('5')).toBeInTheDocument() // hours
    expect(screen.getByText('30')).toBeInTheDocument() // minutes

    // Check response time
    expect(screen.getByText('Response Time (p95)')).toBeInTheDocument()
    expect(screen.getByText('95ms')).toBeInTheDocument()

    // Check error rate
    expect(screen.getByText('Error Rate')).toBeInTheDocument()
    expect(screen.getByText('0.120%')).toBeInTheDocument()
  })

  it('renders degraded system status correctly', () => {
    useSystemHealth.mockReturnValue(mockDegradedSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('DEGRADED')).toBeInTheDocument()
    expect(screen.getByText('2.500%')).toBeInTheDocument() // Higher error rate
  })

  it('displays quantum backend status information', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('Quantum Backend Status')).toBeInTheDocument()
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
    
    // Check quantum metrics
    expect(screen.getByText('Queue Time')).toBeInTheDocument()
    expect(screen.getByText('250ms')).toBeInTheDocument()
    
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('98.7%')).toBeInTheDocument()
    
    expect(screen.getByText('Active Backends')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Check available backends
    expect(screen.getByText('Available Backends')).toBeInTheDocument()
    expect(screen.getByText('IBM Quantum')).toBeInTheDocument()
    expect(screen.getByText('AWS Braket')).toBeInTheDocument()
    expect(screen.getByText('Google Quantum AI')).toBeInTheDocument()
  })

  it('displays degraded quantum backend status', () => {
    useSystemHealth.mockReturnValue(mockDegradedSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('DEGRADED')).toBeInTheDocument()
    expect(screen.getByText('85.2%')).toBeInTheDocument() // Lower success rate
  })

  it('renders individual service status correctly', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('Service Status')).toBeInTheDocument()

    // Check each service
    expect(screen.getByText('API Gateway')).toBeInTheDocument()
    expect(screen.getByText('45ms response time')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Rate Limiting')).toBeInTheDocument()

    expect(screen.getByText('Fraud Detection Service')).toBeInTheDocument()
    expect(screen.getByText('85ms response time')).toBeInTheDocument()
    expect(screen.getByText('Quantum Engine')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()

    expect(screen.getByText('Quantum Processing Engine')).toBeInTheDocument()
    expect(screen.getByText('120ms response time')).toBeInTheDocument()
    expect(screen.getByText('Quantum Backends')).toBeInTheDocument()

    // Check status badges
    const healthyBadges = screen.getAllByText('HEALTHY')
    expect(healthyBadges.length).toBeGreaterThan(0)
  })

  it('shows unhealthy service status', () => {
    useSystemHealth.mockReturnValue(mockDegradedSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('UNHEALTHY')).toBeInTheDocument()
    expect(screen.getByText('450ms response time')).toBeInTheDocument()
  })

  it('displays database health metrics', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('Database Health')).toBeInTheDocument()
    expect(screen.getByText('Connection Pool')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    
    expect(screen.getByText('Query Performance')).toBeInTheDocument()
    expect(screen.getByText('60ms')).toBeInTheDocument()
    
    expect(screen.getByText('Active Connections')).toBeInTheDocument()
    expect(screen.getByText('42/100')).toBeInTheDocument()
  })

  it('displays network health metrics', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    expect(screen.getByText('Network Health')).toBeInTheDocument()
    expect(screen.getByText('Latency')).toBeInTheDocument()
    expect(screen.getByText('12ms')).toBeInTheDocument()
    
    expect(screen.getByText('Packet Loss')).toBeInTheDocument()
    expect(screen.getByText('0.1%')).toBeInTheDocument()
    
    expect(screen.getByText('Bandwidth')).toBeInTheDocument()
    expect(screen.getByText('847 Mbps')).toBeInTheDocument()
  })

  it('handles empty active backends gracefully', () => {
    const healthWithNoBackends = {
      ...mockSystemHealth,
      quantum_backend_status: {
        ...mockSystemHealth.quantum_backend_status,
        active_backends: [],
      },
    }
    useSystemHealth.mockReturnValue(healthWithNoBackends)

    render(<SystemHealth />)

    expect(screen.getByText('Active Backends')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('Available Backends')).not.toBeInTheDocument()
  })

  it('renders proper status icons for different states', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    // Should have various status indicators (icons are rendered as SVG elements)
    const svgElements = document.querySelectorAll('svg')
    expect(svgElements.length).toBeGreaterThan(0)
  })

  it('displays formatted timestamps correctly', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    // Check that last check times are displayed
    // The exact format depends on the formatDate mock, but should be present
    const timestamps = screen.getAllByText(/2024-01-15/i)
    expect(timestamps.length).toBeGreaterThan(0)
  })

  it('shows service dependencies correctly', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    // Check dependencies are shown
    expect(screen.getByText('Depends on:')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Rate Limiting')).toBeInTheDocument()
    expect(screen.getByText('Quantum Engine')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Quantum Backends')).toBeInTheDocument()
  })

  it('has proper accessibility structure', () => {
    useSystemHealth.mockReturnValue(mockSystemHealth)

    render(<SystemHealth />)

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)

    // Check for proper semantic structure
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText('Quantum Backend Status')).toBeInTheDocument()
    expect(screen.getByText('Service Status')).toBeInTheDocument()
  })

  it('handles uptime calculation correctly', () => {
    // Test different uptime values
    const shortUptime = {
      ...mockSystemHealth,
      uptime: 2 * 60 * 60 * 1000 + 15 * 60 * 1000, // 2 hours, 15 minutes
    }
    useSystemHealth.mockReturnValue(shortUptime)

    render(<SystemHealth />)

    expect(screen.getByText('0')).toBeInTheDocument() // days
    expect(screen.getByText('2')).toBeInTheDocument() // hours
    expect(screen.getByText('15')).toBeInTheDocument() // minutes
  })
})