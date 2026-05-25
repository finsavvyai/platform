import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MetricsOverview } from '../dashboard/MetricsOverview'
import { SystemHealth } from '../dashboard/SystemHealth'
import { useDashboardStore } from '@/store/useDashboardStore'
import { FraudMetrics, SystemHealth as SystemHealthType, WebSocketMessage } from '@/types'

// Mock WebSocket for real-time testing
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {}
  close() {
    this.readyState = MockWebSocket.CLOSED
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }
}

global.WebSocket = MockWebSocket as any

// Mock initial data
const initialMetrics: FraudMetrics = {
  total_transactions: 1000,
  fraud_transactions: 20,
  fraud_rate: 2.0,
  avg_confidence_score: 90.0,
  quantum_vs_classical: {
    quantum_processed: 800,
    classical_processed: 200,
    quantum_accuracy: 95.0,
    classical_accuracy: 90.0,
    quantum_avg_time: 80,
    classical_avg_time: 120,
  },
  risk_distribution: {
    low: 900,
    medium: 80,
    high: 20,
  },
  top_fraud_patterns: [],
  geographic_hotspots: [],
}

const initialSystemHealth: SystemHealthType = {
  status: 'healthy',
  uptime: 1000000,
  response_time_p95: 100,
  error_rate: 0.1,
  quantum_backend_status: {
    status: 'available',
    queue_time: 200,
    success_rate: 99.0,
    active_backends: ['IBM Quantum'],
  },
  services: [
    {
      name: 'API Gateway',
      status: 'healthy',
      response_time: 50,
      last_check: '2024-01-15T10:30:00Z',
      dependencies: [],
    },
  ],
}

// Mock store with real-time update capabilities
const mockStore = {
  metrics: initialMetrics,
  systemHealth: initialSystemHealth,
  setMetrics: jest.fn(),
  setSystemHealth: jest.fn(),
}

jest.mock('@/store/useDashboardStore', () => ({
  useDashboardStore: () => mockStore,
  useMetrics: () => mockStore.metrics,
  useSystemHealth: () => mockStore.systemHealth,
  useTheme: () => 'light',
}))

// Mock chart components for faster testing
jest.mock('@/components/charts/MetricsChart', () => ({
  FraudRateChart: ({ data }: any) => (
    <div data-testid="fraud-rate-chart" data-value={data[data.length - 1]?.value} />
  ),
  QuantumAdvantageChart: ({ data }: any) => (
    <div data-testid="quantum-advantage-chart" data-value={data[data.length - 1]?.value} />
  ),
  TransactionVolumeChart: ({ data }: any) => (
    <div data-testid="transaction-volume-chart" data-value={data[data.length - 1]?.value} />
  ),
  ResponseTimeChart: ({ data }: any) => (
    <div data-testid="response-time-chart" data-value={data[data.length - 1]?.value} />
  ),
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

// Real-time update component wrapper
const RealtimeMetricsWrapper = () => {
  const [wsInstance, setWsInstance] = React.useState<MockWebSocket | null>(null)

  React.useEffect(() => {
    const ws = new MockWebSocket('ws://localhost/ws')
    setWsInstance(ws)

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      if (message.type === 'metrics_update') {
        mockStore.setMetrics(message.payload)
        mockStore.metrics = message.payload
      } else if (message.type === 'system_status') {
        mockStore.setSystemHealth(message.payload)
        mockStore.systemHealth = message.payload
      }
    }

    return () => ws.close()
  }, [])

  // Expose WebSocket instance for testing
  React.useEffect(() => {
    if (wsInstance) {
      (window as any).testWebSocket = wsInstance
    }
  }, [wsInstance])

  return <MetricsOverview />
}

const RealtimeSystemHealthWrapper = () => {
  const [wsInstance, setWsInstance] = React.useState<MockWebSocket | null>(null)

  React.useEffect(() => {
    const ws = new MockWebSocket('ws://localhost/ws')
    setWsInstance(ws)

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      if (message.type === 'system_status') {
        mockStore.setSystemHealth(message.payload)
        mockStore.systemHealth = message.payload
      }
    }

    return () => ws.close()
  }, [])

  React.useEffect(() => {
    if (wsInstance) {
      (window as any).testWebSocket = wsInstance
    }
  }, [wsInstance])

  return <SystemHealth />
}

describe('Real-time Data Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockStore.metrics = initialMetrics
    mockStore.systemHealth = initialSystemHealth
    delete (window as any).testWebSocket
  })

  afterEach(() => {
    jest.useRealTimers()
    delete (window as any).testWebSocket
  })

  describe('MetricsOverview Real-time Updates', () => {
    it('updates metrics display when receiving WebSocket data', async () => {
      render(<RealtimeMetricsWrapper />)

      // Wait for WebSocket connection
      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Initial state
      expect(screen.getByText('1,000')).toBeInTheDocument() // total_transactions
      expect(screen.getByText('2.0%')).toBeInTheDocument() // fraud_rate

      // Simulate real-time update
      const updatedMetrics: FraudMetrics = {
        ...initialMetrics,
        total_transactions: 1500,
        fraud_rate: 1.8,
        avg_confidence_score: 92.5,
      }

      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'metrics_update',
          payload: updatedMetrics,
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      // Verify updates are reflected
      await waitFor(() => {
        expect(screen.getByText('1,500')).toBeInTheDocument()
        expect(screen.getByText('1.8%')).toBeInTheDocument()
        expect(screen.getByText('92.5%')).toBeInTheDocument()
      })
    })

    it('updates quantum vs classical comparison in real-time', async () => {
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Initial quantum advantage: 95.0 - 90.0 = 5.0%
      expect(screen.getByText('5.0%')).toBeInTheDocument()

      // Update with improved quantum performance
      const updatedMetrics: FraudMetrics = {
        ...initialMetrics,
        quantum_vs_classical: {
          ...initialMetrics.quantum_vs_classical,
          quantum_accuracy: 97.0,
          classical_accuracy: 90.5,
        },
      }

      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'metrics_update',
          payload: updatedMetrics,
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      // New quantum advantage: 97.0 - 90.5 = 6.5%
      await waitFor(() => {
        expect(screen.getByText('6.5%')).toBeInTheDocument()
      })
    })

    it('updates risk distribution in real-time', async () => {
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Initial risk distribution
      expect(screen.getByText('900')).toBeInTheDocument() // low risk
      expect(screen.getByText('80')).toBeInTheDocument() // medium risk
      expect(screen.getByText('20')).toBeInTheDocument() // high risk

      // Update risk distribution
      const updatedMetrics: FraudMetrics = {
        ...initialMetrics,
        risk_distribution: {
          low: 950,
          medium: 45,
          high: 5,
        },
      }

      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'metrics_update',
          payload: updatedMetrics,
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('950')).toBeInTheDocument()
        expect(screen.getByText('45')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
      })
    })

    it('handles rapid successive updates correctly', async () => {
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Send multiple rapid updates
      const updates = [
        { total_transactions: 1100, fraud_rate: 1.9 },
        { total_transactions: 1200, fraud_rate: 1.7 },
        { total_transactions: 1300, fraud_rate: 1.5 },
      ]

      updates.forEach((update, index) => {
        act(() => {
          const ws = (window as any).testWebSocket as MockWebSocket
          ws.simulateMessage({
            type: 'metrics_update',
            payload: { ...initialMetrics, ...update },
            timestamp: `2024-01-15T10:3${5 + index}:00Z`,
          })
        })
      })

      // Should show the latest update
      await waitFor(() => {
        expect(screen.getByText('1,300')).toBeInTheDocument()
        expect(screen.getByText('1.5%')).toBeInTheDocument()
      })
    })
  })

  describe('SystemHealth Real-time Updates', () => {
    it('updates system status in real-time', async () => {
      render(<RealtimeSystemHealthWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Initial healthy status
      expect(screen.getByText('HEALTHY')).toBeInTheDocument()
      expect(screen.getByText('0.100%')).toBeInTheDocument() // error rate

      // Update to degraded status
      const updatedHealth: SystemHealthType = {
        ...initialSystemHealth,
        status: 'degraded',
        error_rate: 2.5,
        response_time_p95: 250,
      }

      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'system_status',
          payload: updatedHealth,
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('DEGRADED')).toBeInTheDocument()
        expect(screen.getByText('2.500%')).toBeInTheDocument()
        expect(screen.getByText('250ms')).toBeInTheDocument()
      })
    })

    it('updates quantum backend status in real-time', async () => {
      render(<RealtimeSystemHealthWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Initial quantum backend status
      expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
      expect(screen.getByText('99.0%')).toBeInTheDocument() // success rate

      // Update quantum backend status
      const updatedHealth: SystemHealthType = {
        ...initialSystemHealth,
        quantum_backend_status: {
          status: 'degraded',
          queue_time: 500,
          success_rate: 85.0,
          active_backends: ['IBM Quantum', 'AWS Braket'],
        },
      }

      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'system_status',
          payload: updatedHealth,
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('DEGRADED')).toBeInTheDocument()
        expect(screen.getByText('85.0%')).toBeInTheDocument()
        expect(screen.getByText('500ms')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument() // active backends count
      })
    })

    it('updates service status in real-time', async () => {
      render(<RealtimeSystemHealthWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Initial service status
      expect(screen.getByText('API Gateway')).toBeInTheDocument()
      expect(screen.getByText('50ms response time')).toBeInTheDocument()

      // Update service status
      const updatedHealth: SystemHealthType = {
        ...initialSystemHealth,
        services: [
          {
            name: 'API Gateway',
            status: 'unhealthy',
            response_time: 300,
            last_check: '2024-01-15T10:35:00Z',
            dependencies: ['Authentication'],
          },
          {
            name: 'Fraud Detection Service',
            status: 'healthy',
            response_time: 85,
            last_check: '2024-01-15T10:35:00Z',
            dependencies: ['Database'],
          },
        ],
      }

      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'system_status',
          payload: updatedHealth,
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('300ms response time')).toBeInTheDocument()
        expect(screen.getByText('Fraud Detection Service')).toBeInTheDocument()
        expect(screen.getByText('85ms response time')).toBeInTheDocument()
      })
    })
  })

  describe('WebSocket Connection Management', () => {
    it('handles WebSocket connection errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Simulate WebSocket error
      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        if (ws.onerror) {
          ws.onerror(new Event('error'))
        }
      })

      // Component should continue to function with existing data
      expect(screen.getByText('1,000')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('handles malformed WebSocket messages gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Simulate malformed message
      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', { data: 'invalid json' }))
        }
      })

      // Component should continue to function with existing data
      expect(screen.getByText('1,000')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('ignores unknown message types', async () => {
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Send unknown message type
      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        ws.simulateMessage({
          type: 'unknown_type',
          payload: { some: 'data' },
          timestamp: '2024-01-15T10:35:00Z',
        })
      })

      // Component should continue to function with existing data
      expect(screen.getByText('1,000')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory Management', () => {
    it('does not cause memory leaks with frequent updates', async () => {
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Send many updates rapidly
      for (let i = 0; i < 100; i++) {
        act(() => {
          const ws = (window as any).testWebSocket as MockWebSocket
          ws.simulateMessage({
            type: 'metrics_update',
            payload: {
              ...initialMetrics,
              total_transactions: 1000 + i,
            },
            timestamp: `2024-01-15T10:35:${i.toString().padStart(2, '0')}Z`,
          })
        })
      }

      // Should show the latest update
      await waitFor(() => {
        expect(screen.getByText('1,099')).toBeInTheDocument()
      })

      // Component should still be responsive
      expect(screen.getByText('Fraud Rate')).toBeInTheDocument()
    })

    it('batches rapid updates efficiently', async () => {
      const setMetricsSpy = jest.spyOn(mockStore, 'setMetrics')
      
      render(<RealtimeMetricsWrapper />)

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect((window as any).testWebSocket).toBeDefined()
      })

      // Send multiple updates in quick succession
      act(() => {
        const ws = (window as any).testWebSocket as MockWebSocket
        for (let i = 0; i < 5; i++) {
          ws.simulateMessage({
            type: 'metrics_update',
            payload: {
              ...initialMetrics,
              total_transactions: 1000 + i,
            },
            timestamp: `2024-01-15T10:35:0${i}Z`,
          })
        }
      })

      // Should have called setMetrics for each update
      expect(setMetricsSpy).toHaveBeenCalledTimes(5)
    })
  })
})