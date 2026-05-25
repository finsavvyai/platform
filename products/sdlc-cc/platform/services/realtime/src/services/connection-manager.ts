import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import type { WebSocket } from 'ws'
import { WinstonLogger } from '@/utils/logger'

export interface Connection {
  connection: WebSocket
  user: {
    id: string
    email: string
    tenantId: string
    role: string
  }
  connectedAt: Date
  lastActivity: Date
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map()
  private userConnections: Map<string, Set<string>> = new Map()
  private redis: Redis
  private logger: WinstonLogger

  constructor(redis: Redis) {
    this.redis = redis
    this.logger = new WinstonLogger()

    // Setup Redis pub/sub for cross-server communication
    this.redis.subscribe('realtime:broadcast')
    this.redis.subscribe('realtime:direct')
    this.redis.subscribe('realtime:room')

    this.redis.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message)
    })
  }

  async addConnection(connectionId: string, connection: Connection): Promise<void> {
    this.connections.set(connectionId, connection)

    // Track user connections
    if (!this.userConnections.has(connection.user.id)) {
      this.userConnections.set(connection.user.id, new Set())
    }
    this.userConnections.get(connection.user.id)!.add(connectionId)

    // Store connection info in Redis for cross-server access
    await this.redis.hset(
      `connections:${connection.user.tenantId}`,
      connectionId,
      JSON.stringify({
        userId: connection.user.id,
        email: connection.user.email,
        connectedAt: connection.connectedAt.toISOString(),
        serverId: process.env.SERVER_ID || 'server-1'
      })
    )

    // Set expiration
    await this.redis.expire(`connections:${connection.user.tenantId}`, 3600)

    this.logger.info(`Connection added: ${connectionId} for user ${connection.user.email}`)

    // Notify other systems about new connection
    await this.publishEvent('user:connected', {
      userId: connection.user.id,
      tenantId: connection.user.tenantId,
      connectionId,
      timestamp: new Date().toISOString()
    })
  }

  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    this.connections.delete(connectionId)

    // Remove from user connections
    const userConns = this.userConnections.get(connection.user.id)
    if (userConns) {
      userConns.delete(connectionId)
      if (userConns.size === 0) {
        this.userConnections.delete(connection.user.id)
      }
    }

    // Remove from Redis
    await this.redis.hdel(`connections:${connection.user.tenantId}`, connectionId)

    this.logger.info(`Connection removed: ${connectionId} for user ${connection.user.email}`)

    // Notify other systems
    await this.publishEvent('user:disconnected', {
      userId: connection.user.id,
      tenantId: connection.user.tenantId,
      connectionId,
      timestamp: new Date().toISOString()
    })
  }

  async getConnection(connectionId: string): Promise<Connection | null> {
    return this.connections.get(connectionId) || null
  }

  async getUserConnections(userId: string): Promise<string[]> {
    const connections = this.userConnections.get(userId)
    return connections ? Array.from(connections) : []
  }

  async getTenantConnections(tenantId: string): Promise<any[]> {
    const connections = await this.redis.hgetall(`connections:${tenantId}`)
    return Object.values(connections).map(conn => JSON.parse(conn))
  }

  async sendToConnection(connectionId: string, message: unknown): Promise<boolean> {
    const connection = this.connections.get(connectionId)
    if (!connection) return false

    try {
      connection.connection.send(JSON.stringify(message))
      connection.lastActivity = new Date()
      return true
    } catch (error) {
      this.logger.error(`Failed to send to connection ${connectionId}:`, {
        error: error instanceof Error ? error.message : String(error)
      })
      await this.removeConnection(connectionId)
      return false
    }
  }

  async sendToUser(userId: string, message: unknown): Promise<number> {
    const connectionIds = await this.getUserConnections(userId)
    let sentCount = 0

    for (const connectionId of connectionIds) {
      if (await this.sendToConnection(connectionId, message)) {
        sentCount++
      }
    }

    return sentCount
  }

  async sendToTenant(tenantId: string, message: unknown): Promise<number> {
    const connections = await this.getTenantConnections(tenantId)
    let sentCount = 0

    for (const connInfo of connections) {
      if (await this.sendToUser(connInfo.userId, message)) {
        sentCount++
      }
    }

    return sentCount
  }

  async broadcastEvent(event: unknown): Promise<void> {
    // Publish to Redis for cross-server broadcasting
    await this.redis.publish('realtime:broadcast', JSON.stringify(event))
  }

  async sendToRoom(roomId: string, message: unknown, excludeUserId?: string): Promise<void> {
    await this.redis.publish('realtime:room', JSON.stringify({
      roomId,
      message,
      excludeUserId
    }))
  }

  async directMessage(userId: string, message: unknown): Promise<void> {
    await this.redis.publish('realtime:direct', JSON.stringify({
      userId,
      message
    }))
  }

  private async handleRedisMessage(channel: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message)

      switch (channel) {
        case 'realtime:broadcast':
          await this.handleBroadcast(data)
          break
        case 'realtime:direct':
          await this.handleDirectMessage(data)
          break
        case 'realtime:room':
          await this.handleRoomMessage(data)
          break
      }
    } catch (error) {
      this.logger.error(`Failed to handle Redis message from ${channel}:`, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private async handleBroadcast(event: unknown): Promise<void> {
    for (const [connId] of this.connections) {
      await this.sendToConnection(connId, event)
    }
  }

  private async handleDirectMessage(data: unknown): Promise<void> {
    const { userId, message } = data as { userId: string; message: unknown }
    await this.sendToUser(userId, message)
  }

  private async handleRoomMessage(data: unknown): Promise<void> {
    // This would integrate with RoomManager
    // For now, we'll implement basic room broadcasting
    const { roomId, excludeUserId, message } = data as {
      roomId: string
      excludeUserId?: string
      message: unknown
    }
    const roomConnections = await this.redis.smembers(`room:${roomId}:connections`)

    for (const connectionId of roomConnections) {
      const connection = this.connections.get(connectionId)
      if (connection && connection.user.id !== excludeUserId) {
        await this.sendToConnection(connectionId, message)
      }
    }
  }

  private async publishEvent(type: string, data: unknown): Promise<void> {
    const event = {
      id: uuidv4(),
      type,
      data,
      timestamp: new Date().toISOString(),
      serverId: process.env.SERVER_ID || 'server-1'
    }

    await this.redis.publish('realtime:events', JSON.stringify(event))
  }

  async getConnectionStats(): Promise<any> {
    const totalConnections = this.connections.size
    const totalUsers = this.userConnections.size

    const connectionsByTenant = new Map<string, number>()

    for (const [_connectionId, connection] of this.connections) {
      const tenantId = connection.user.tenantId
      connectionsByTenant.set(tenantId, (connectionsByTenant.get(tenantId) || 0) + 1)
    }

    return {
      totalConnections,
      totalUsers,
      connectionsByTenant: Object.fromEntries(connectionsByTenant),
      serverId: process.env.SERVER_ID || 'server-1'
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ConnectionManager...')

    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.connection.close(1001, 'Server shutting down')
      } catch (error) {
        this.logger.error(`Error closing connection ${connectionId}:`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    this.connections.clear()
    this.userConnections.clear()

    this.logger.info('ConnectionManager shutdown complete')
  }
}
