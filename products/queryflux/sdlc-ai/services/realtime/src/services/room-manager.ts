import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { WinstonLogger } from '@/utils/logger'

export interface Room {
  id: string
  name: string
  type: 'collaboration' | 'meeting' | 'webinar' | 'chat'
  tenantId: string
  createdBy: string
  createdAt: Date
  metadata?: Record<string, any>
  settings?: {
    maxParticipants?: number
    isPublic?: boolean
    requireApproval?: boolean
    enableRecording?: boolean
  }
}

export interface RoomParticipant {
  userId: string
  email: string
  role: 'owner' | 'moderator' | 'participant'
  joinedAt: Date
  lastActivity: Date
  permissions?: string[]
}

export class RoomManager {
  private redis: Redis
  private logger: WinstonLogger

  constructor(redis: Redis) {
    this.redis = redis
    this.logger = new WinstonLogger()
  }

  async createRoom(roomData: Omit<Room, 'id' | 'createdAt'>): Promise<Room> {
    const room: Room = {
      id: uuidv4(),
      createdAt: new Date(),
      ...roomData
    }

    // Store room in Redis
    await this.redis.hset(`rooms:${room.tenantId}`, room.id, JSON.stringify(room))

    // Set expiration for rooms (30 days)
    await this.redis.expire(`rooms:${room.tenantId}`, 30 * 24 * 60 * 60)

    this.logger.info(`Room created: ${room.id} by ${room.createdBy}`)

    return room
  }

  async getRoom(roomId: string, tenantId: string): Promise<Room | null> {
    const roomData = await this.redis.hget(`rooms:${tenantId}`, roomId)
    if (!roomData) return null

    return JSON.parse(roomData)
  }

  async getTenantRooms(tenantId: string): Promise<Room[]> {
    const rooms = await this.redis.hgetall(`rooms:${tenantId}`)
    return Object.values(rooms).map(room => JSON.parse(room))
  }

  async updateRoom(roomId: string, tenantId: string, updates: Partial<Room>): Promise<Room | null> {
    const room = await this.getRoom(roomId, tenantId)
    if (!room) return null

    const updatedRoom = { ...room, ...updates }
    await this.redis.hset(`rooms:${tenantId}`, roomId, JSON.stringify(updatedRoom))

    // Notify room participants about update
    await this.notifyRoomParticipants(roomId, {
      type: 'room:updated',
      room: updatedRoom
    })

    return updatedRoom
  }

  async deleteRoom(roomId: string, tenantId: string): Promise<boolean> {
    const room = await this.getRoom(roomId, tenantId)
    if (!room) return false

    // Remove room
    await this.redis.hdel(`rooms:${tenantId}`, roomId)

    // Remove all participants
    await this.redis.del(`room:${roomId}:participants`)
    await this.redis.del(`room:${roomId}:connections`)

    // Notify participants
    await this.notifyRoomParticipants(roomId, {
      type: 'room:deleted',
      roomId
    })

    this.logger.info(`Room deleted: ${roomId}`)
    return true
  }

  async joinRoom(roomId: string, userId: string, role: string = 'participant'): Promise<boolean> {
    // Get room info to determine tenant
    const rooms = await this.redis.keys('rooms:*')
    let room: Room | null = null
    let tenantId: string | null = null

    for (const roomKey of rooms) {
      const roomData = await this.redis.hget(roomKey, roomId)
      if (roomData) {
        room = JSON.parse(roomData)
        tenantId = roomKey.replace('rooms:', '')
        break
      }
    }

    if (!room || !tenantId) return false

    // Check if room is full
    const currentParticipants = await this.redis.scard(`room:${roomId}:participants`)
    if (room.settings?.maxParticipants && currentParticipants >= room.settings.maxParticipants) {
      return false
    }

    // Add participant to room
    const participant: RoomParticipant = {
      userId,
      email: '', // This would be fetched from user service
      role: role as any,
      joinedAt: new Date(),
      lastActivity: new Date()
    }

    await this.redis.sadd(`room:${roomId}:participants`, userId)
    await this.redis.hset(`room:${roomId}:participant:${userId}`, JSON.stringify(participant))

    // Set expiration
    await this.redis.expire(`room:${roomId}:participants`, 24 * 60 * 60)
    await this.redis.expire(`room:${roomId}:participant:${userId}`, 24 * 60 * 60)

    // Notify other participants
    await this.notifyRoomParticipants(roomId, {
      type: 'participant:joined',
      participant,
      roomId
    }, userId)

    this.logger.info(`User ${userId} joined room ${roomId}`)
    return true
  }

  async leaveRoom(roomId: string, userId: string): Promise<boolean> {
    const participantData = await this.redis.hget(`room:${roomId}:participant:${userId}`, userId)
    if (!participantData) return false

    // Remove participant
    await this.redis.srem(`room:${roomId}:participants`, userId)
    await this.redis.hdel(`room:${roomId}:participant:${userId}`, userId)

    // Notify other participants
    await this.notifyRoomParticipants(roomId, {
      type: 'participant:left',
      userId,
      roomId
    }, userId)

    this.logger.info(`User ${userId} left room ${roomId}`)
    return true
  }

  async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
    const participantIds = await this.redis.smembers(`room:${roomId}:participants`)
    const participants: RoomParticipant[] = []

    for (const userId of participantIds) {
      const participantData = await this.redis.hget(`room:${roomId}:participant:${userId}`, userId)
      if (participantData) {
        participants.push(JSON.parse(participantData))
      }
    }

    return participants
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    const userRooms: Room[] = []
    const roomKeys = await this.redis.keys('rooms:*')

    for (const roomKey of roomKeys) {
      const rooms = await this.redis.hgetall(roomKey)
      for (const [roomId, roomData] of Object.entries(rooms)) {
        const room = JSON.parse(roomData)
        const isParticipant = await this.redis.sismember(`room:${roomId}:participants`, userId)
        if (isParticipant || room.createdBy === userId) {
          userRooms.push(room)
        }
      }
    }

    return userRooms
  }

  async updateParticipantRole(roomId: string, userId: string, newRole: string): Promise<boolean> {
    const participantData = await this.redis.hget(`room:${roomId}:participant:${userId}`, userId)
    if (!participantData) return false

    const participant: RoomParticipant = JSON.parse(participantData)
    participant.role = newRole as any

    await this.redis.hset(`room:${roomId}:participant:${userId}`, JSON.stringify(participant))

    // Notify participants
    await this.notifyRoomParticipants(roomId, {
      type: 'participant:role_changed',
      userId,
      newRole,
      roomId
    })

    return true
  }

  async addConnectionToRoom(roomId: string, connectionId: string, userId: string): Promise<void> {
    await this.redis.sadd(`room:${roomId}:connections`, connectionId)
    await this.redis.hset(`room:${roomId}:connection:${connectionId}`, userId)

    // Set expiration
    await this.redis.expire(`room:${roomId}:connections`, 24 * 60 * 60)
  }

  async removeConnectionFromRoom(roomId: string, connectionId: string): Promise<void> {
    await this.redis.srem(`room:${roomId}:connections`, connectionId)
    await this.redis.hdel(`room:${roomId}:connection:${connectionId}`, connectionId)
  }

  async getRoomConnections(roomId: string): Promise<string[]> {
    return await this.redis.smembers(`room:${roomId}:connections`)
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    return await this.redis.sismember(`room:${roomId}:participants`, userId)
  }

  private async notifyRoomParticipants(roomId: string, message: any, excludeUserId?: string): Promise<void> {
    const connections = await this.getRoomConnections(roomId)

    // This would integrate with ConnectionManager
    // For now, publish to Redis
    await this.redis.publish('realtime:room', JSON.stringify({
      roomId,
      message,
      excludeUserId
    }))
  }

  async getRoomStats(roomId: string): Promise<any> {
    const participants = await this.getRoomParticipants(roomId)
    const connections = await this.getRoomConnections(roomId)

    return {
      participantCount: participants.length,
      connectionCount: connections.length,
      participants: participants.map(p => ({
        userId: p.userId,
        role: p.role,
        joinedAt: p.joinedAt
      }))
    }
  }
}
