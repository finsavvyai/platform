import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useRealtime } from '@/hooks/useRealtime'
import { Send, Users, MessageCircle, Wifi, WifiOff } from 'lucide-react'

export const RealtimeDemo: React.FC = () => {
  const {
    isConnected,
    connectionStatus,
    messages,
    sendMessage,
    presence,
    updatePresence,
    sendTypingStart,
    sendTypingStop
  } = useRealtime()

  const [messageInput, setMessageInput] = useState('')
  const [selectedRoom, _setSelectedRoom] = useState('demo-room')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessage({
        type: 'chat:message',
        userId: 'current-user', // This would be filled by the server
        roomId: selectedRoom,
        data: {
          content: messageInput.trim(),
          type: 'text'
        }
      })
      setMessageInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value)

    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true)
      sendTypingStart(selectedRoom)
    } else if (isTyping && !e.target.value.trim()) {
      setIsTyping(false)
      sendTypingStop(selectedRoom)
    }
  }

  const handlePresenceChange = (status: 'online' | 'away' | 'busy') => {
    updatePresence(status, `Demoing real-time features`)
  }

  const filteredMessages = messages.filter(msg => msg.roomId === selectedRoom)

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            Real-time Connection
          </CardTitle>
          <CardDescription>
            Experience live WebSocket connectivity with real-time messaging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {connectionStatus}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected to real-time service' : 'Connecting...'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <select
                className="px-2 py-1 border border-border rounded text-sm"
                onChange={(e) => handlePresenceChange(e.target.value as any)}
                defaultValue="online"
              >
                <option value="online">🟢 Online</option>
                <option value="away">🟡 Away</option>
                <option value="busy">🔴 Busy</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Messages */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Live Chat Demo
            </CardTitle>
            <CardDescription>
              Send and receive messages in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Messages List */}
              <div className="h-96 overflow-y-auto border border-border rounded-lg p-4 space-y-3">
                {filteredMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex flex-col ${
                        message.userId === 'current-user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.userId === 'current-user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.data.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message... (Enter to send)"
                  className="flex-1 resize-none border border-border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={2}
                  disabled={!isConnected}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!isConnected || !messageInput.trim()}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Presence & Info */}
        <div className="space-y-6">
          {/* Active Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from(presence.values()).map((user) => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          user.status === 'online' ? 'bg-green-500' :
                          user.status === 'away' ? 'bg-yellow-500' :
                          user.status === 'busy' ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                      />
                      <span className="text-sm font-medium">User {user.userId.slice(-4)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {user.status}
                    </Badge>
                  </div>
                ))}

                {presence.size === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active users
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Messages</span>
                <span className="text-sm font-medium">{filteredMessages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Users</span>
                <span className="text-sm font-medium">{presence.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Room</span>
                <span className="text-sm font-medium">{selectedRoom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Connection</span>
                <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
                  {connectionStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Real-time messaging</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Presence tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Typing indicators</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Auto-reconnection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">WebSocket connectivity</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
