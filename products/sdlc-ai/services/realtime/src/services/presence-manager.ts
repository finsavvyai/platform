import Redis from 'ioredis'
import { WinstonLogger } from '@/utils/logger'

export interface Presence {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline'
  activity?: string
  lastSeen: Date
  metadata?: Record<string, any>
}

export interface RoomPresence {
  roomId: string
  users: Presence[]
  typingUsers: string[]
  lastActivity: Date
}

export class PresenceManager {
  private redis: Redis
  private logger: WinstonLogger

  constructor(redis: Redis) {
    this.redis = redis
    this.logger = new WinstonLogger()
  }

  async updatePresence(userId: string, status: Presence['status'], activity?: string, metadata?: Record<string, any>): Promise<void> {
    const presence: Presence = {
      userId,
      status,
      activity,
      lastSeen: new Date(),
      metadata
    }

    await this.redis.hset(`presence:${userId}`, JSON.stringify(presence))
    await this.redis.expire(`presence:${userId}`, 300) // 5 minutes

    // Broadcast presence update
    await this.broadcastPresenceUpdate(presence)
  }

  async getPresence(userId: string): Promise<Presence | null> {
    const presenceData = await this.redis.hget(`presence:${userId}`, 'data')
    if (!presenceData) return null

    const presence = JSON.parse(presenceData)
    return {
      ...presence,
      lastSeen: new Date(presence.lastSeen)
    }
  }

  async getBatchPresence(userIds: string[]): Promise<Presence[]> {
    const presences: Presence[] = []

    for (const userId of userIds) {
      const presence = await this.getPresence(userId)
      if (presence) {
        presences.push(presence)
      }
    }

    return presences
  }

  async updateTypingStatus(roomId: string, userId: string, isTyping: boolean): Promise<void> {
    const typingKey = `room:${roomId}:typing`

    if (isTyping) {
      await this.redis.sadd(typingKey, userId)
      await this.redis.expire(typingKey, 10) // 10 seconds timeout
    } else {
      await this.redis.srem(typingKey, userId)
    }

    // Broadcast typing status to room
    await this.broadcastTypingStatus(roomId, userId, isTyping)
  }

  async getRoomTypingUsers(roomId: string): Promise<string[]> {
    return await this.redis.smembers(`room:${roomId}:typing`)
  }

  async getRoomPresence(roomId: string): Promise<RoomPresence> {
    // Get all users in the room
    const roomUsers = await this.redis.smembers(`room:${roomId}:users`)
    const typingUsers = await this.getRoomTypingUsers(roomId)

    const users: Presence[] = []
    for (const userId of roomUsers) {
      const presence = await this.getPresence(userId)
      if (presence) {
        users.push(presence)
      }
    }

    return {
      roomId,
      users,
      typingUsers,
      lastActivity: new Date()
    }
  }

  async setUserInRoom(roomId: string, userId: string): Promise<void> {
    await this.redis.sadd(`room:${roomId}:users`, userId)
    await this.redis.expire(`room:${roomId}:users`, 24 * 60 * 60) // 24 hours
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    await this.redis.srem(`room:${roomId}:users`, userId)
  }

  async getUserRooms(userId: string): Promise<string[]> {
    const roomKeys = await this.redis.keys(`room:*:users`)
    const userRooms: string[] = []

    for (const roomKey of roomKeys) {
      const isMember = await this.redis.sismember(roomKey, userId)
      if (isMember) {
        const roomId = roomKey.replace('room:', '').replace(':users', '')
        userRooms.push(roomId)
      }
    }

    return userRooms
  }

  async getOnlineUsers(tenantId?: string): Promise<Presence[]> {
    const pattern = tenantId ? `presence:${tenantId}:*` : 'presence:*'
    const keys = await this.redis.keys(pattern)
    const onlineUsers: Presence[] = []

    for (const key of keys) {
      const presenceData = await this.redis.hget(key, 'data')
      if (presenceData) {
        const presence = JSON.parse(presenceData)
        if (presence.status !== 'offline') {
          onlineUsers.push({
            ...presence,
            lastSeen: new Date(presence.lastSeen)
          })
        }
      }
    }

    return onlineUsers
  }

  async cleanupOfflineUsers(): Promise<number> {
    const keys = await this.redis.keys('presence:*')
    let cleanedCount = 0

    for (const key of keys) {
      const presenceData = await this.redis.hget(key, 'data')
      if (presenceData) {
        const presence = JSON.parse(presenceData)
        const lastSeen = new Date(presence.lastSeen)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        if (lastSeen < fiveMinutesAgo && presence.status !== 'offline') {
          // Mark as offline
          await this.updatePresence(presence.userId, 'offline')
          cleanedCount++
        }
      }
    }

    return cleanedCount
  }

  async getPresenceStats(tenantId?: string): Promise<any> {
    const onlineUsers = await this.getOnlineUsers(tenantId)
    const statusCounts = onlineUsers.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalOnline: onlineUsers.length,
      statusBreakdown: statusCounts,
      activeRooms: await this.getActiveRoomsCount(),
      typingUsers: await this.getTypingUsersCount()
    }
  }

  private async broadcastPresenceUpdate(presence: Presence): Promise<void> {
    const update = {
      type: 'presence:updated',
      presence: {
        userId: presence.userId,
        status: presence.status,
        activity: presence.activity,
        lastSeen: presence.lastSeen.toISOString(),
        metadata: presence.metadata
      }
    }

    await this.redis.publish('realtime:presence', JSON.stringify(update))
  }

  private async broadcastTypingStatus(roomId: string, userId: string, isTyping: boolean): Promise<void> {
    const update = {
      type: 'typing:updated',
      roomId,
      userId,
      isTyping
    }

    await this.redis.publish(`room:${roomId}:typing`, JSON.stringify(update))
  }

  private async getActiveRoomsCount(): Promise<number> {
    const roomKeys = await this.redis.keys('room:*:users')
    let activeCount = 0

    for (const roomKey of roomKeys) {
      const userCount = await this.redis.scard(roomKey)
      if (userCount > 0) {
        activeCount++
      }
    }

    return activeCount
  }

  private async getTypingUsersCount(): Promise<number> {
    const typingKeys = await this.redis.keys('room:*:typing')
    let typingCount = 0

    for (const typingKey of typingKeys) {
      const count = await this.redis.scard(typingKey)
      typingCount += count
    }

    return typingCount
  }

  async setUserActivity(userId: string, activity: string, metadata?: Record<string, any>): Promise<void> {
    const currentPresence = await this.getPresence(userId)
    if (currentPresence) {
      await this.updatePresence(userId, currentPresence.status, activity, {
        ...currentPresence.metadata,
        ...metadata
      })
    }
  }

  async setCustomStatus(userId: string, status: string, expiresAt?: Date): Promise<void> {
    const currentPresence = await this.getPresence(userId)
    if (currentPresence) {
      const customStatus = {
        status,
        setAt: new Date().toISOString(),
        expiresAt: expiresAt?.toISOString()
      }

      await this.updatePresence(userId, currentPresence.status, currentPresence.activity, {
        ...currentPresence.metadata,
        customStatus
      })
    }
  }

  async searchUsers(query: string, tenantId?: string): Promise<Presence[]> {
    const onlineUsers = await this.getOnlineUsers(tenantId)

    return onlineUsers.filter(user =>
      user.metadata?.displayName?.toLowerCase().includes(query.toLowerCase()) ||
      user.metadata?.email?.toLowerCase().includes(query.toLowerCase())
    )
  }

  async startHeartbeat(userId: string): Promise<void> {
    // This would be called periodically to keep user marked as online
    await this.updatePresence(userId, 'online', 'Active')
  }

  async stopHeartbeat(userId: string): Promise<void> {
    // Mark user as away when heartbeat stops
    await this.updatePresence(userId, 'away', 'Away')
  }
}
