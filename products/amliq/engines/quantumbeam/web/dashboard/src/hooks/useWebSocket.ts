import { useEffect, useRef, useState, useCallback } from 'react'
import { WebSocketMessage, RealtimeUpdate } from '@/types'

interface UseWebSocketOptions {
  url?: string
  reconnectAttempts?: number
  reconnectInterval?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

interface UseWebSocketReturn {
  isConnected: boolean
  lastMessage: WebSocketMessage | null
  sendMessage: (message: any) => void
  disconnect: () => void
  reconnect: () => void
  connectionError: string | null
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = `ws://${window.location.host}/ws`,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [reconnectCount, setReconnectCount] = useState(0)

  const websocketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxReconnectAttemptsRef = useRef(reconnectAttempts)

  const connect = useCallback(() => {
    try {
      const wsUrl = url.startsWith('ws') ? url : `ws://${window.location.host}${url}`
      websocketRef.current = new WebSocket(wsUrl)

      websocketRef.current.onopen = () => {
        setIsConnected(true)
        setConnectionError(null)
        setReconnectCount(0)
        onConnect?.()
      }

      websocketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
          onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      websocketRef.current.onclose = (event) => {
        setIsConnected(false)
        onDisconnect?.()

        // Attempt to reconnect if not explicitly closed and within retry limit
        if (!event.wasClean && reconnectCount < maxReconnectAttemptsRef.current) {
          const timeout = reconnectInterval * Math.pow(2, reconnectCount) // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1)
            connect()
          }, timeout)
        }
      }

      websocketRef.current.onerror = (error) => {
        setConnectionError('WebSocket connection error')
        onError?.(error)
      }

    } catch (error) {
      setConnectionError('Failed to create WebSocket connection')
      console.error('WebSocket connection error:', error)
    }
  }, [url, reconnectCount, reconnectInterval, onConnect, onDisconnect, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (websocketRef.current) {
      websocketRef.current.close(1000, 'Disconnected by user')
      websocketRef.current = null
    }

    setIsConnected(false)
    setConnectionError(null)
    setReconnectCount(0)
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    setReconnectCount(0)
    maxReconnectAttemptsRef.current = reconnectAttempts
    setTimeout(connect, 100)
  }, [disconnect, connect, reconnectAttempts])

  const sendMessage = useCallback((message: any) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message)
    }
  }, [])

  // Initial connection
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    isConnected,
    lastMessage,
    sendMessage,
    disconnect,
    reconnect,
    connectionError,
  }
}

// Specialized hook for real-time fraud alerts
export function useFraudAlerts() {
  const [alerts, setAlerts] = useState<RealtimeUpdate[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'fraud_alert') {
      const alert = message.payload as RealtimeUpdate
      setAlerts(prev => [alert, ...prev].slice(0, 100)) // Keep last 100 alerts
      setUnreadCount(prev => prev + 1)
    }
  }, [])

  const markAsRead = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.data?.alert_id === alertId
          ? { ...alert, read: true }
          : alert
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllAsRead = useCallback(() => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })))
    setUnreadCount(0)
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
    setUnreadCount(0)
  }, [])

  const websocket = useWebSocket({
    onMessage: handleMessage,
  })

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    ...websocket,
  }
}

// Specialized hook for real-time metrics
export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<any>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'metrics_update') {
      setMetrics(message.payload)
      setLastUpdate(new Date())
    }
  }, [])

  const websocket = useWebSocket({
    onMessage: handleMessage,
  })

  return {
    metrics,
    lastUpdate,
    ...websocket,
  }
}

// Specialized hook for system status monitoring
export function useSystemStatus() {
  const [status, setStatus] = useState<any>(null)
  const [isHealthy, setIsHealthy] = useState(true)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'system_status') {
      setStatus(message.payload)
      setIsHealthy(message.payload?.status === 'healthy')
    }
  }, [])

  const websocket = useWebSocket({
    onMessage: handleMessage,
  })

  return {
    status,
    isHealthy,
    ...websocket,
  }
}