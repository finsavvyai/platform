import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { WinstonLogger } from '@/utils/logger'
import { RoomManager } from './room-manager'

export interface Message {
  id: string
  type: string
  userId: string
  roomId?: string
  data: unknown
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface MessageHandlerResult {
  success: boolean
  response?: unknown
  error?: string
}

/**
 * Wire shape for an inbound WebSocket frame, before the handler does any
 * runtime validation. Every field is optional because the client is
 * untrusted — handlers narrow from here.
 */
interface IncomingFrame {
  type?: string
  data?: unknown
  roomId?: string
  metadata?: Record<string, unknown>
}

// Payload shapes per message.type. These mirror the fields the handlers
// actually read. Anything missing at runtime triggers the handler's own
// validation path and returns an error.
interface ChatData {
  content?: unknown
  mentions?: unknown[]
}
interface CollaborationData {
  operation?: unknown
  documentId?: string
  version?: unknown
}
interface PresenceData {
  status?: string
  activity?: string
}
interface RoomData {
  roomId?: string
}
interface VoiceSignalData {
  roomId?: string
  signal?: unknown
  targetUserId?: string
}
interface ScreenShareData {
  roomId?: string
  action?: string
  streamId?: string
}

export class MessageHandler {
  private redis: Redis
  private logger: WinstonLogger
  private roomManager: RoomManager

  constructor(redis: Redis) {
    this.redis = redis
    this.logger = new WinstonLogger()
    this.roomManager = new RoomManager(redis)
  }

  async handleMessage(connectionId: string, message: unknown, user: { id: string; tenantId: string }): Promise<MessageHandlerResult> {
    try {
      if (typeof message !== 'object' || message === null) {
        return {
          success: false,
          error: 'Invalid message structure. Expected object.'
        }
      }
      const { type, data, roomId, metadata } = message as IncomingFrame

      // Validate message structure
      if (!type || !data) {
        return {
          success: false,
          error: 'Invalid message structure. Type and data are required.'
        }
      }

      const messageObj: Message = {
        id: uuidv4(),
        type,
        userId: user.id,
        roomId,
        data,
        timestamp: new Date(),
        metadata
      }

      // Store message in Redis for history
      await this.storeMessage(messageObj)

      // Route message to appropriate handler
      let response: unknown

      switch (type) {
        case 'chat:message':
          response = await this.handleChatMessage(messageObj, user)
          break
        case 'collaboration:operation':
          response = await this.handleCollaborationOperation(messageObj, user)
          break
        case 'presence:update':
          response = await this.handlePresenceUpdate(messageObj, user)
          break
        case 'room:join':
          response = await this.handleRoomJoin(messageObj, user)
          break
        case 'room:leave':
          response = await this.handleRoomLeave(messageObj, user)
          break
        case 'typing:start':
          response = await this.handleTypingStart(messageObj, user)
          break
        case 'typing:stop':
          response = await this.handleTypingStop(messageObj, user)
          break
        case 'voice:signal':
          response = await this.handleVoiceSignal(messageObj, user)
          break
        case 'screen:share':
          response = await this.handleScreenShare(messageObj, user)
          break
        default:
          response = await this.handleGenericMessage(messageObj, user)
      }

      // Broadcast message to relevant recipients
      await this.broadcastMessage(messageObj)

      return {
        success: true,
        response
      }

    } catch (error) {
      this.logger.error(`Error handling message from ${connectionId}:`, {
        error: error instanceof Error ? error.message : String(error)
      })
      return {
        success: false,
        error: 'Internal server error'
      }
    }
  }

  private async handleChatMessage(message: Message, _user: { id: string; tenantId: string }): Promise<unknown> {
    const { content, mentions } = (message.data ?? {}) as ChatData

    // Validate chat message
    if (!content || typeof content !== 'string' || content.length > 4000) {
      throw new Error('Invalid chat message')
    }

    // Store in room chat history
    if (message.roomId) {
      await this.redis.lpush(
        `room:${message.roomId}:chat`,
        JSON.stringify({
          id: message.id,
          userId: message.userId,
          content,
          mentions: mentions || [],
          timestamp: message.timestamp.toISOString()
        })
      )

      // Keep only last 100 messages
      await this.redis.ltrim(`room:${message.roomId}:chat`, 0, 99)
      await this.redis.expire(`room:${message.roomId}:chat`, 24 * 60 * 60)
    }

    return {
      type: 'chat:message:sent',
      messageId: message.id,
      timestamp: message.timestamp.toISOString()
    }
  }

  private async handleCollaborationOperation(message: Message, _user: { id: string; tenantId: string }): Promise<unknown> {
    const { operation, documentId, version } = (message.data ?? {}) as CollaborationData

    // Validate operation
    if (!operation || !documentId) {
      throw new Error('Invalid collaboration operation')
    }

    // Store operation in document history
    await this.redis.lpush(
      `document:${documentId}:operations`,
      JSON.stringify({
        id: message.id,
        userId: message.userId,
        operation,
        version,
        timestamp: message.timestamp.toISOString()
      })
    )

    // Keep only last 1000 operations
    await this.redis.ltrim(`document:${documentId}:operations`, 0, 999)
    await this.redis.expire(`document:${documentId}:operations`, 24 * 60 * 60)

    return {
      type: 'collaboration:operation:applied',
      operationId: message.id,
      documentId,
      version
    }
  }

  private async handlePresenceUpdate(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { status, activity } = (message.data ?? {}) as PresenceData

    // Update user presence
    await this.redis.hset(`presence:${user.id}`, {
      status: status || 'online',
      activity: activity || '',
      lastSeen: new Date().toISOString(),
      userId: user.id
    })

    await this.redis.expire(`presence:${user.id}`, 300) // 5 minutes

    return {
      type: 'presence:updated',
      userId: user.id,
      status,
      activity
    }
  }

  private async handleRoomJoin(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { roomId } = (message.data ?? {}) as RoomData

    if (!roomId) {
      throw new Error('Room ID is required')
    }

    // Join room
    const success = await this.roomManager.joinRoom(roomId, user.id)

    if (!success) {
      throw new Error('Failed to join room')
    }

    return {
      type: 'room:joined',
      roomId,
      userId: user.id
    }
  }

  private async handleRoomLeave(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { roomId } = (message.data ?? {}) as RoomData

    if (!roomId) {
      throw new Error('Room ID is required')
    }

    // Leave room
    const success = await this.roomManager.leaveRoom(roomId, user.id)

    if (!success) {
      throw new Error('Failed to leave room')
    }

    return {
      type: 'room:left',
      roomId,
      userId: user.id
    }
  }

  private async handleTypingStart(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { roomId } = (message.data ?? {}) as RoomData

    if (roomId) {
      await this.redis.sadd(`room:${roomId}:typing`, user.id)
      await this.redis.expire(`room:${roomId}:typing`, 10) // 10 seconds
    }

    return {
      type: 'typing:started',
      userId: user.id,
      roomId
    }
  }

  private async handleTypingStop(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { roomId } = (message.data ?? {}) as RoomData

    if (roomId) {
      await this.redis.srem(`room:${roomId}:typing`, user.id)
    }

    return {
      type: 'typing:stopped',
      userId: user.id,
      roomId
    }
  }

  private async handleVoiceSignal(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { roomId, signal, targetUserId } = (message.data ?? {}) as VoiceSignalData

    // Voice signaling would be handled by WebRTC infrastructure
    // For now, just forward the message
    if (roomId && targetUserId) {
      await this.redis.publish(`voice:signal:${roomId}:${targetUserId}`, JSON.stringify({
        from: user.id,
        signal,
        timestamp: message.timestamp.toISOString()
      }))
    }

    return {
      type: 'voice:signal:sent',
      targetUserId
    }
  }

  private async handleScreenShare(message: Message, user: { id: string; tenantId: string }): Promise<unknown> {
    const { roomId, action, streamId } = (message.data ?? {}) as ScreenShareData

    // Handle screen share start/stop
    if (roomId) {
      await this.redis.hset(`room:${roomId}:screen-share`, {
        userId: user.id,
        action,
        streamId: streamId || '',
        timestamp: message.timestamp.toISOString()
      })
    }

    return {
      type: 'screen:share:' + action,
      userId: user.id,
      roomId,
      streamId
    }
  }

  private async handleGenericMessage(message: Message, _user: { id: string; tenantId: string }): Promise<unknown> {
    // Handle any other message types
    return {
      type: 'message:received',
      messageId: message.id,
      timestamp: message.timestamp.toISOString()
    }
  }

  private async storeMessage(message: Message): Promise<void> {
    // Store message in Redis for history and debugging
    await this.redis.lpush(
      `messages:${message.userId}`,
      JSON.stringify(message)
    )

    // Keep only last 100 messages per user
    await this.redis.ltrim(`messages:${message.userId}`, 0, 99)
    await this.redis.expire(`messages:${message.userId}`, 24 * 60 * 60)
  }

  private async broadcastMessage(message: Message): Promise<void> {
    const broadcastData = {
      id: message.id,
      type: message.type,
      userId: message.userId,
      roomId: message.roomId,
      data: message.data,
      timestamp: message.timestamp.toISOString(),
      metadata: message.metadata
    }

    if (message.roomId) {
      // Broadcast to room participants
      await this.redis.publish('realtime:room', JSON.stringify({
        roomId: message.roomId,
        message: broadcastData
      }))
    } else {
      // Broadcast to tenant
      await this.redis.publish('realtime:broadcast', JSON.stringify(broadcastData))
    }
  }

  async getMessageHistory(userId: string, limit: number = 50): Promise<Message[]> {
    const messages = await this.redis.lrange(`messages:${userId}`, 0, limit - 1)
    return messages.map(msg => {
      const parsed = JSON.parse(msg)
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
      }
    })
  }

  async getRoomChatHistory(roomId: string, limit: number = 50): Promise<any[]> {
    const messages = await this.redis.lrange(`room:${roomId}:chat`, 0, limit - 1)
    return messages.map(msg => JSON.parse(msg)).reverse() // Most recent first
  }

  async getDocumentOperations(documentId: string, limit: number = 100): Promise<any[]> {
    const operations = await this.redis.lrange(`document:${documentId}:operations`, 0, limit - 1)
    return operations.map(op => JSON.parse(op)).reverse() // Most recent first
  }
}
