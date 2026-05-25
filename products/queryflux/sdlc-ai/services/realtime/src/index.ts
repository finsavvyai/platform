import Fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import Redis from 'ioredis'
import { WinstonLogger } from '@/utils/logger'
import { ConnectionManager } from '@/services/connection-manager'
import { RoomManager } from '@/services/room-manager'
import { MessageHandler } from '@/services/message-handler'
import { CollaborationEngine } from '@/services/collaboration-engine'
import { PresenceManager } from '@/services/presence-manager'
import { config } from '@/config/config'

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string
    email: string
    tenantId: string
    role: string
  }
}

async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: new WinstonLogger()
  })

  // Initialize Redis for pub/sub and state management
  const redis = new Redis(config.redis.url, {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  })

  // Initialize managers
  const connectionManager = new ConnectionManager(redis)
  const roomManager = new RoomManager(redis)
  const messageHandler = new MessageHandler(redis)
  const collaborationEngine = new CollaborationEngine(redis)
  const presenceManager = new PresenceManager(redis)

  // Register plugins
  await server.register(cors, {
    origin: config.cors.allowedOrigins,
    credentials: true
  })

  await server.register(websocket)

  // Authentication middleware
  const authenticate = async (request: AuthenticatedRequest, reply: any) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      const decoded = jwt.verify(token, config.auth.jwtSecret) as any
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenantId,
        role: decoded.role
      }
    } catch (error) {
      return reply.status(401).send({ error: 'Invalid token' })
    }
  }

  // WebSocket connection handler
  server.get('/ws', { websocket: true }, async (connection, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      connection.socket.close(1008, 'Authentication required')
      return
    }

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any
      const user = {
        id: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenantId,
        role: decoded.role
      }

      const connectionId = uuidv4()

      // Register connection
      await connectionManager.addConnection(connectionId, {
        connection,
        user,
        connectedAt: new Date(),
        lastActivity: new Date()
      })

      // Setup WebSocket message handlers
      connection.socket.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          await messageHandler.handleMessage(connectionId, message, user)
        } catch (error) {
          server.log.error('Error handling WebSocket message:', error)
          connection.socket.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }))
        }
      })

      connection.socket.on('close', async () => {
        await connectionManager.removeConnection(connectionId)
        await presenceManager.updatePresence(user.id, 'offline')
      })

      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        connectionId,
        timestamp: new Date().toISOString()
      }))

      // Update presence
      await presenceManager.updatePresence(user.id, 'online')

    } catch (error) {
      server.log.error('WebSocket authentication error:', error)
      connection.socket.close(1008, 'Invalid token')
    }
  })

  // REST API Routes
  server.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  })

  server.get('/api/rooms', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const rooms = await roomManager.getUserRooms(request.user!.id)
    return { rooms }
  })

  server.post('/api/rooms', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const { name, type, metadata } = request.body as any
    const room = await roomManager.createRoom({
      name,
      type: type || 'collaboration',
      createdBy: request.user!.id,
      tenantId: request.user!.tenantId,
      metadata
    })
    return room
  })

  server.post('/api/rooms/:roomId/join', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const { roomId } = request.params as any
    const result = await roomManager.joinRoom(roomId, request.user!.id)
    return result
  })

  server.post('/api/rooms/:roomId/leave', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const { roomId } = request.params as any
    const result = await roomManager.leaveRoom(roomId, request.user!.id)
    return result
  })

  server.get('/api/rooms/:roomId/presence', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const { roomId } = request.params as any
    const presence = await presenceManager.getRoomPresence(roomId)
    return { presence }
  })

  server.get('/api/collaboration/:sessionId/history', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const { sessionId } = request.params as any
    const history = await collaborationEngine.getSessionHistory(sessionId)
    return { history }
  })

  // Real-time events endpoint
  server.post('/api/events', { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const { type, data, target } = request.body as any

    const event = {
      id: uuidv4(),
      type,
      data,
      target,
      userId: request.user!.id,
      tenantId: request.user!.tenantId,
      timestamp: new Date().toISOString()
    }

    // Publish event to relevant connections
    await connectionManager.broadcastEvent(event)

    return { eventId: event.id }
  })

  // Graceful shutdown
  const gracefulShutdown = async () => {
    server.log.info('Shutting down gracefully...')

    await connectionManager.shutdown()
    await redis.disconnect()
    await server.close()

    process.exit(0)
  }

  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)

  return server
}

// Start server
async function start() {
  try {
    const server = await createServer()
    await server.listen({
      port: config.server.port,
      host: config.server.host
    })

    console.log(`🚀 SDLC.ai Real-time Service running on ${config.server.host}:${config.server.port}`)
    console.log(`📡 WebSocket endpoint: ws://${config.server.host}:${config.server.port}/ws`)
    console.log(`🔗 Health check: http://${config.server.host}:${config.server.port}/health`)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start()
}

export { createServer }
