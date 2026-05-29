import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface RealtimeMessage {
  id: string
  type: string
  userId: string
  roomId?: string
  data: any
  timestamp: Date
  metadata?: Record<string, any>
}

export interface Presence {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline'
  activity?: string
  lastSeen: Date
  metadata?: Record<string, any>
}

export interface Room {
  id: string
  name: string
  type: 'collaboration' | 'meeting' | 'webinar' | 'chat'
  participantCount: number
  createdAt: Date
}

interface RealtimeContextType {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  rooms: Room[]
  presence: Map<string, Presence>
  messages: RealtimeMessage[]
  sendMessage: (message: Omit<RealtimeMessage, 'id' | 'timestamp'>) => void
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
  updatePresence: (status: Presence['status'], activity?: string) => void
  sendTypingStart: (roomId: string) => void
  sendTypingStop: (roomId: string) => void
}

const RealtimeContext = createContext<RealtimeContextType | null>(null)

interface RealtimeProviderProps {
  children: ReactNode
  token: string
  serverUrl: string
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({
  children,
  token,
  serverUrl
}) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<RealtimeContextType['connectionStatus']>('disconnected')
  const [rooms, setRooms] = useState<Room[]>([])
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map())
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    const connectWebSocket = () => {
      setConnectionStatus('connecting')

      const wsUrl = `${serverUrl}?token=${token}`
      const websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setConnectionStatus('connected')
        setWs(websocket)
      }

      websocket.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data)

          switch (message.type) {
            case 'connected':
              console.log('Real-time connection established')
              break

            case 'room:joined':
            case 'room:left':
            case 'room:updated':
              // Handle room updates
              break

            case 'presence:updated':
              handlePresenceUpdate(message.data)
              break

            case 'chat:message':
            case 'collaboration:operation':
            case 'typing:started':
            case 'typing:stopped':
              setMessages(prev => [...prev, message])
              break

            default:
              console.log('Received message:', message)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      websocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        setConnectionStatus('disconnected')
        setWs(null)

        // Attempt to reconnect after 3 seconds
        if (event.code !== 1000) {
          setTimeout(connectWebSocket, 3000)
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus('error')
      }
    }

    connectWebSocket()

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounted')
      }
    }
  }, [token, serverUrl])

  const handlePresenceUpdate = (presenceData: any) => {
    setPresence(prev => {
      const updated = new Map(prev)
      updated.set(presenceData.userId, {
        ...presenceData,
        lastSeen: new Date(presenceData.lastSeen)
      })
      return updated
    })
  }

  const sendMessage = (message: Omit<RealtimeMessage, 'id' | 'timestamp'>) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const fullMessage: RealtimeMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: new Date()
      }

      ws.send(JSON.stringify(fullMessage))
      setMessages(prev => [...prev, fullMessage])
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }

  const joinRoom = (roomId: string) => {
    sendMessage({
      type: 'room:join',
      userId: '', // This would be filled by the server
      data: { roomId }
    })
  }

  const leaveRoom = (roomId: string) => {
    sendMessage({
      type: 'room:leave',
      userId: '', // This would be filled by the server
      data: { roomId }
    })
  }

  const updatePresence = (status: Presence['status'], activity?: string) => {
    sendMessage({
      type: 'presence:update',
      userId: '', // This would be filled by the server
      data: { status, activity }
    })
  }

  const sendTypingStart = (roomId: string) => {
    sendMessage({
      type: 'typing:start',
      userId: '', // This would be filled by the server
      data: { roomId }
    })
  }

  const sendTypingStop = (roomId: string) => {
    sendMessage({
      type: 'typing:stop',
      userId: '', // This would be filled by the server
      data: { roomId }
    })
  }

  const value: RealtimeContextType = {
    isConnected,
    connectionStatus,
    rooms,
    presence,
    messages,
    sendMessage,
    joinRoom,
    leaveRoom,
    updatePresence,
    sendTypingStart,
    sendTypingStop
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

export const useRealtime = () => {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}
