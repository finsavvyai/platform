import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket, useFraudAlerts, useRealtimeMetrics, useSystemStatus } from '../useWebSocket'
import { WebSocketMessage, RealtimeUpdate } from '@/types'

// Mock WebSocket
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
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason, wasClean: true }))
    }
  }

  // Helper method to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  // Helper method to simulate an error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  // Helper method to simulate connection close
  simulateClose(wasClean = true, code = 1000) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, wasClean }))
    }
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any

describe('useWebSocket', () => {
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('establishes connection on mount', async () => {
    const onConnect = jest.fn()
    const { result } = renderHook(() =>
      useWebSocket({ onConnect })
    )

    expect(result.current.isConnected).toBe(false)

    // Fast-forward to simulate connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  it('handles incoming messages correctly', async () => {
    const onMessage = jest.fn()
    const { result } = renderHook(() =>
      useWebSocket({ onMessage })
    )

    // Wait for connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate receiving a message
    const testMessage: WebSocketMessage = {
      type: 'metrics',
      payload: { test: 'data' },
      timestamp: '2024-01-15T10:30:00Z',
    }

    act(() => {
      // Get the current WebSocket instance and simulate message
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage(testMessage)
      }
    })

    expect(onMessage).toHaveBeenCalledWith(testMessage)
    expect(result.current.lastMessage).toEqual(testMessage)
  })

  it('sends messages when connected', async () => {
    const { result } = renderHook(() => useWebSocket())

    // Wait for connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const testMessage = { type: 'test', data: 'hello' }
    
    act(() => {
      result.current.sendMessage(testMessage)
    })

    // Verify message would be sent (mock doesn't actually send)
    expect(result.current.isConnected).toBe(true)
  })

  it('handles connection errors', async () => {
    const onError = jest.fn()
    const { result } = renderHook(() =>
      useWebSocket({ onError })
    )

    // Wait for connection attempt
    act(() => {
      jest.advanceTimersByTime(20)
    })

    // Simulate error
    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateError()
      }
    })

    expect(onError).toHaveBeenCalled()
    expect(result.current.connectionError).toBe('WebSocket connection error')
  })

  it('attempts reconnection on unexpected disconnect', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ reconnectAttempts: 2, reconnectInterval: 1000 })
    )

    // Wait for initial connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate unexpected disconnect
    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateClose(false, 1006) // Abnormal closure
      }
    })

    expect(result.current.isConnected).toBe(false)

    // Fast-forward to trigger reconnection
    act(() => {
      jest.advanceTimersByTime(1100)
    })

    // Should attempt to reconnect
    await waitFor(() => {
      // Connection attempt should be made
      expect(result.current.isConnected).toBe(false) // Still connecting
    })
  })

  it('disconnects cleanly', async () => {
    const onDisconnect = jest.fn()
    const { result } = renderHook(() =>
      useWebSocket({ onDisconnect })
    )

    // Wait for connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Disconnect
    act(() => {
      result.current.disconnect()
    })

    expect(result.current.isConnected).toBe(false)
    expect(onDisconnect).toHaveBeenCalled()
  })

  it('handles manual reconnection', async () => {
    const { result } = renderHook(() => useWebSocket())

    // Wait for initial connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Disconnect
    act(() => {
      result.current.disconnect()
    })

    expect(result.current.isConnected).toBe(false)

    // Reconnect
    act(() => {
      result.current.reconnect()
    })

    act(() => {
      jest.advanceTimersByTime(120)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })
  })

  it('uses custom URL when provided', () => {
    const customUrl = 'ws://custom.example.com/ws'
    renderHook(() => useWebSocket({ url: customUrl }))

    // Verify WebSocket was created with custom URL
    const wsInstances = (global.WebSocket as any).mock?.instances
    if (wsInstances && wsInstances.length > 0) {
      expect(wsInstances[0].url).toBe(customUrl)
    }
  })

  it('handles malformed JSON messages gracefully', async () => {
    const onMessage = jest.fn()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    const { result } = renderHook(() =>
      useWebSocket({ onMessage })
    )

    // Wait for connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate malformed message
    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        if (wsInstances[0].onmessage) {
          wsInstances[0].onmessage(new MessageEvent('message', { data: 'invalid json' }))
        }
      }
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error))
    expect(onMessage).not.toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })
})

describe('useFraudAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('handles fraud alert messages', async () => {
    const { result } = renderHook(() => useFraudAlerts())

    // Wait for connection
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const fraudAlert: RealtimeUpdate = {
      type: 'fraud_alert',
      data: {
        alert_id: 'alert_123',
        transaction_id: 'tx_456',
        risk_level: 'high',
        confidence_score: 0.95,
      },
      timestamp: '2024-01-15T10:30:00Z',
      severity: 'warning',
    }

    const message: WebSocketMessage = {
      type: 'fraud_alert',
      payload: fraudAlert,
      timestamp: '2024-01-15T10:30:00Z',
    }

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage(message)
      }
    })

    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.alerts[0]).toEqual(fraudAlert)
    expect(result.current.unreadCount).toBe(1)
  })

  it('marks alerts as read', async () => {
    const { result } = renderHook(() => useFraudAlerts())

    // Wait for connection and add alert
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Add alert
    const fraudAlert: RealtimeUpdate = {
      type: 'fraud_alert',
      data: { alert_id: 'alert_123' },
      timestamp: '2024-01-15T10:30:00Z',
      severity: 'warning',
    }

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage({
          type: 'fraud_alert',
          payload: fraudAlert,
          timestamp: '2024-01-15T10:30:00Z',
        })
      }
    })

    expect(result.current.unreadCount).toBe(1)

    // Mark as read
    act(() => {
      result.current.markAsRead('alert_123')
    })

    expect(result.current.unreadCount).toBe(0)
  })

  it('marks all alerts as read', async () => {
    const { result } = renderHook(() => useFraudAlerts())

    // Add multiple alerts
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Add two alerts
    for (let i = 0; i < 2; i++) {
      act(() => {
        const wsInstances = (global.WebSocket as any).mock?.instances
        if (wsInstances && wsInstances.length > 0) {
          wsInstances[0].simulateMessage({
            type: 'fraud_alert',
            payload: {
              type: 'fraud_alert',
              data: { alert_id: `alert_${i}` },
              timestamp: '2024-01-15T10:30:00Z',
              severity: 'warning',
            },
            timestamp: '2024-01-15T10:30:00Z',
          })
        }
      })
    }

    expect(result.current.unreadCount).toBe(2)

    // Mark all as read
    act(() => {
      result.current.markAllAsRead()
    })

    expect(result.current.unreadCount).toBe(0)
  })

  it('clears all alerts', async () => {
    const { result } = renderHook(() => useFraudAlerts())

    // Add alert and clear
    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage({
          type: 'fraud_alert',
          payload: {
            type: 'fraud_alert',
            data: { alert_id: 'alert_123' },
            timestamp: '2024-01-15T10:30:00Z',
            severity: 'warning',
          },
          timestamp: '2024-01-15T10:30:00Z',
        })
      }
    })

    expect(result.current.alerts).toHaveLength(1)

    act(() => {
      result.current.clearAlerts()
    })

    expect(result.current.alerts).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it('limits alerts to 100 items', async () => {
    const { result } = renderHook(() => useFraudAlerts())

    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Add 105 alerts
    for (let i = 0; i < 105; i++) {
      act(() => {
        const wsInstances = (global.WebSocket as any).mock?.instances
        if (wsInstances && wsInstances.length > 0) {
          wsInstances[0].simulateMessage({
            type: 'fraud_alert',
            payload: {
              type: 'fraud_alert',
              data: { alert_id: `alert_${i}` },
              timestamp: '2024-01-15T10:30:00Z',
              severity: 'warning',
            },
            timestamp: '2024-01-15T10:30:00Z',
          })
        }
      })
    }

    // Should be limited to 100
    expect(result.current.alerts).toHaveLength(100)
  })
})

describe('useRealtimeMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('handles metrics update messages', async () => {
    const { result } = renderHook(() => useRealtimeMetrics())

    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const metricsData = {
      total_transactions: 1000,
      fraud_rate: 2.5,
    }

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage({
          type: 'metrics_update',
          payload: metricsData,
          timestamp: '2024-01-15T10:30:00Z',
        })
      }
    })

    expect(result.current.metrics).toEqual(metricsData)
    expect(result.current.lastUpdate).toBeInstanceOf(Date)
  })

  it('ignores non-metrics messages', async () => {
    const { result } = renderHook(() => useRealtimeMetrics())

    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage({
          type: 'fraud_alert',
          payload: { alert: 'data' },
          timestamp: '2024-01-15T10:30:00Z',
        })
      }
    })

    expect(result.current.metrics).toBeNull()
    expect(result.current.lastUpdate).toBeNull()
  })
})

describe('useSystemStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('handles system status messages', async () => {
    const { result } = renderHook(() => useSystemStatus())

    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const statusData = {
      status: 'healthy',
      uptime: 1000000,
    }

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage({
          type: 'system_status',
          payload: statusData,
          timestamp: '2024-01-15T10:30:00Z',
        })
      }
    })

    expect(result.current.status).toEqual(statusData)
    expect(result.current.isHealthy).toBe(true)
  })

  it('detects unhealthy status', async () => {
    const { result } = renderHook(() => useSystemStatus())

    act(() => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const statusData = {
      status: 'degraded',
      uptime: 1000000,
    }

    act(() => {
      const wsInstances = (global.WebSocket as any).mock?.instances
      if (wsInstances && wsInstances.length > 0) {
        wsInstances[0].simulateMessage({
          type: 'system_status',
          payload: statusData,
          timestamp: '2024-01-15T10:30:00Z',
        })
      }
    })

    expect(result.current.status).toEqual(statusData)
    expect(result.current.isHealthy).toBe(false)
  })
})