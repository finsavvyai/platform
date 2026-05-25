import { useEffect, useRef, useState, useCallback } from 'react'
import { useDomainConfig } from './use-domain'

interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
}

interface UseWebSocketOptions {
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onMessage?: (message: WebSocketMessage) => void
  onError?: (event: Event) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onOpen,
    onClose,
    onMessage,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options

  const domainConfig = useDomainConfig()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const websocketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!domainConfig.features.websocket || !domainConfig.wsUrl) {
      console.warn('WebSocket not supported for this domain')
      return
    }

    if (isConnected || isConnecting) {
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const wsUrl = domainConfig.wsUrl
      const token = localStorage.getItem('auth_token')

      // Append token as query parameter if available
      const urlWithToken = token ? `${wsUrl}?token=${token}` : wsUrl

      websocketRef.current = new WebSocket(urlWithToken)

      websocketRef.current.onopen = (event) => {
        setIsConnected(true)
        setIsConnecting(false)
        setReconnectAttempts(0)
        setError(null)
        onOpen?.(event)
      }

      websocketRef.current.onclose = (event) => {
        setIsConnected(false)
        setIsConnecting(false)
        onClose?.(event)

        // Attempt reconnection if not explicitly closed and max attempts not reached
        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          const nextAttempt = reconnectAttempts + 1
          setReconnectAttempts(nextAttempt)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval * nextAttempt)
        }
      }

      websocketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          message.timestamp = Date.now()
          setLastMessage(message)
          onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      websocketRef.current.onerror = (event) => {
        setIsConnecting(false)
        setError('WebSocket connection error')
        onError?.(event)
      }
    } catch (error) {
      setIsConnecting(false)
      setError('Failed to create WebSocket connection')
      onError?.(event as any)
    }
  }, [
    domainConfig,
    isConnected,
    isConnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectInterval,
    onOpen,
    onClose,
    onMessage,
    onError,
  ])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (websocketRef.current) {
      websocketRef.current.close(1000, 'User disconnected')
      websocketRef.current = null
    }

    setIsConnected(false)
    setIsConnecting(false)
    setReconnectAttempts(0)
  }, [])

  const sendMessage = useCallback((type: string, data: any) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
      }

      websocketRef.current.send(JSON.stringify(message))
      return true
    } else {
      console.warn('WebSocket is not connected')
      return false
    }
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    setReconnectAttempts(0)
    setTimeout(() => {
      connect()
    }, 100)
  }, [disconnect, connect])

  // Auto-connect on mount if WebSocket is supported
  useEffect(() => {
    if (domainConfig.features.websocket && domainConfig.wsUrl) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [domainConfig.features.websocket, domainConfig.wsUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    isConnecting,
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage,
    reconnect,
    reconnectAttempts,
  }
}

export function useRealtime(channel?: string) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const [subscribers, setSubscribers] = useState<string[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)

  const websocket = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'subscription_update') {
        setSubscribers(message.data.subscribers || [])
      } else if (message.type === 'channel_message' && message.data.channel === channel) {
        setMessages(prev => [...prev, message])
      }
    },
  })

  const subscribe = useCallback((channelName: string) => {
    if (websocket.sendMessage('subscribe', { channel: channelName })) {
      setIsSubscribed(true)
      return true
    }
    return false
  }, [websocket.sendMessage])

  const unsubscribe = useCallback((channelName: string) => {
    if (websocket.sendMessage('unsubscribe', { channel: channelName })) {
      setIsSubscribed(false)
      setMessages([])
      return true
    }
    return false
  }, [websocket.sendMessage])

  const publish = useCallback((channelName: string, data: any) => {
    return websocket.sendMessage('publish', {
      channel: channelName,
      data,
    })
  }, [websocket.sendMessage])

  useEffect(() => {
    if (channel && websocket.isConnected) {
      subscribe(channel)
    }

    return () => {
      if (channel && isSubscribed) {
        unsubscribe(channel)
      }
    }
  }, [channel, websocket.isConnected, subscribe, unsubscribe, isSubscribed])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    ...websocket,
    messages,
    subscribers,
    isSubscribed,
    subscribe,
    unsubscribe,
    publish,
    clearMessages,
  }
}

export function useAIAssistant() {
  const [conversation, setConversation] = useState<WebSocketMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [aiStatus, setAIStatus] = useState<'idle' | 'thinking' | 'responding'>('idle')

  const websocket = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'ai_response':
          setConversation(prev => [...prev, message])
          setAIStatus('responding')
          setIsTyping(false)
          break
        case 'ai_typing':
          setIsTyping(true)
          setAIStatus('thinking')
          break
        case 'ai_error':
          setConversation(prev => [...prev, message])
          setIsTyping(false)
          setAIStatus('idle')
          break
      }
    },
  })

  const sendMessage = useCallback((content: string) => {
    if (websocket.sendMessage('user_message', { content })) {
      setConversation(prev => [...prev, {
        type: 'user_message',
        data: { content },
        timestamp: Date.now(),
      }])
      setAIStatus('thinking')
      setIsTyping(true)
      return true
    }
    return false
  }, [websocket.sendMessage])

  const clearConversation = useCallback(() => {
    setConversation([])
    setAIStatus('idle')
    setIsTyping(false)
    websocket.sendMessage('clear_conversation', {})
  }, [websocket.sendMessage])

  const resetConversation = useCallback(() => {
    clearConversation()
  }, [clearConversation])

  return {
    ...websocket,
    conversation,
    isTyping,
    aiStatus,
    sendMessage,
    clearConversation,
    resetConversation,
  }
}