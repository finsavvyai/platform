import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { WinstonLogger } from '@/utils/logger'

export interface CollaborationSession {
  id: string
  documentId: string
  type: 'document' | 'code' | 'whiteboard'
  participants: string[]
  operations: CollaborationOperation[]
  createdAt: Date
  lastActivity: Date
  metadata?: Record<string, any>
}

export interface CollaborationOperation {
  id: string
  type: 'insert' | 'delete' | 'retain' | 'format'
  userId: string
  position: number
  content?: string
  length?: number
  attributes?: Record<string, any>
  timestamp: Date
  version: number
}

export interface ParticipantCursor {
  userId: string
  position: number
  selection?: { start: number; end: number }
  timestamp: Date
}

export class CollaborationEngine {
  private redis: Redis
  private logger: WinstonLogger

  constructor(redis: Redis) {
    this.redis = redis
    this.logger = new WinstonLogger()
  }

  async createSession(documentId: string, type: 'document' | 'code' | 'whiteboard', userId: string): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: uuidv4(),
      documentId,
      type,
      participants: [userId],
      operations: [],
      createdAt: new Date(),
      lastActivity: new Date()
    }

    await this.redis.hset(`sessions:${documentId}`, session.id, JSON.stringify(session))
    await this.redis.expire(`sessions:${documentId}`, 24 * 60 * 60 * 7) // 7 days

    this.logger.info(`Collaboration session created: ${session.id} for document ${documentId}`)

    return session
  }

  async getSession(sessionId: string, documentId: string): Promise<CollaborationSession | null> {
    const sessionData = await this.redis.hget(`sessions:${documentId}`, sessionId)
    if (!sessionData) return null

    const session = JSON.parse(sessionData)
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      lastActivity: new Date(session.lastActivity)
    }
  }

  async joinSession(sessionId: string, documentId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId, documentId)
    if (!session) return false

    if (!session.participants.includes(userId)) {
      session.participants.push(userId)
      session.lastActivity = new Date()

      await this.redis.hset(`sessions:${documentId}`, sessionId, JSON.stringify(session))

      // Notify other participants
      await this.notifySessionParticipants(sessionId, {
        type: 'participant:joined',
        userId,
        sessionId
      }, userId)
    }

    return true
  }

  async leaveSession(sessionId: string, documentId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId, documentId)
    if (!session) return false

    session.participants = session.participants.filter(id => id !== userId)
    session.lastActivity = new Date()

    await this.redis.hset(`sessions:${documentId}`, sessionId, JSON.stringify(session))

    // Notify other participants
    await this.notifySessionParticipants(sessionId, {
      type: 'participant:left',
      userId,
      sessionId
    }, userId)

    // If no participants left, consider removing the session after a timeout
    if (session.participants.length === 0) {
      await this.redis.expire(`sessions:${documentId}`, 3600) // 1 hour
    }

    return true
  }

  async applyOperation(sessionId: string, documentId: string, operation: Omit<CollaborationOperation, 'id' | 'timestamp' | 'version'>): Promise<CollaborationOperation> {
    const session = await this.getSession(sessionId, documentId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get current version
    const currentVersion = session.operations.length

    const collaborationOperation: CollaborationOperation = {
      id: uuidv4(),
      version: currentVersion + 1,
      timestamp: new Date(),
      ...operation
    }

    // Add operation to session
    session.operations.push(collaborationOperation)
    session.lastActivity = new Date()

    // Keep only last 1000 operations in memory
    if (session.operations.length > 1000) {
      session.operations = session.operations.slice(-1000)
    }

    // Store session
    await this.redis.hset(`sessions:${documentId}`, sessionId, JSON.stringify(session))

    // Store operation in history
    await this.redis.lpush(
      `document:${documentId}:operations`,
      JSON.stringify(collaborationOperation)
    )

    // Keep history limited
    await this.redis.ltrim(`document:${documentId}:operations`, 0, 9999)
    await this.redis.expire(`document:${documentId}:operations`, 24 * 60 * 60 * 30) // 30 days

    // Broadcast operation to session participants
    await this.notifySessionParticipants(sessionId, {
      type: 'operation:applied',
      operation: collaborationOperation,
      sessionId
    })

    this.logger.debug(`Operation applied: ${collaborationOperation.id} in session ${sessionId}`)

    return collaborationOperation
  }

  async updateCursor(sessionId: string, documentId: string, userId: string, cursor: Omit<ParticipantCursor, 'userId' | 'timestamp'>): Promise<void> {
    const participantCursor: ParticipantCursor = {
      userId,
      ...cursor,
      timestamp: new Date()
    }

    // Store cursor position
    await this.redis.hset(
      `session:${sessionId}:cursors`,
      userId,
      JSON.stringify(participantCursor)
    )

    await this.redis.expire(`session:${sessionId}:cursors`, 300) // 5 minutes

    // Notify other participants
    await this.notifySessionParticipants(sessionId, {
      type: 'cursor:updated',
      cursor: participantCursor,
      sessionId
    }, userId)
  }

  async getDocumentState(documentId: string): Promise<any> {
    // Get all operations for the document
    const operations = await this.getDocumentOperations(documentId)

    // Apply operations in order to get current state
    let state = { content: '', version: 0 }

    for (const op of operations) {
      state = this.applyOperationToState(state, op)
    }

    return state
  }

  async getActiveSession(documentId: string): Promise<CollaborationSession | null> {
    const sessions = await this.redis.hgetall(`sessions:${documentId}`)

    // Find the most recently active session
    let activeSession: CollaborationSession | null = null
    let lastActivity = new Date(0)

    for (const [sessionId, sessionData] of Object.entries(sessions)) {
      const session = JSON.parse(sessionData)
      const sessionLastActivity = new Date(session.lastActivity)

      if (sessionLastActivity > lastActivity && session.participants.length > 0) {
        lastActivity = sessionLastActivity
        activeSession = {
          ...session,
          createdAt: new Date(session.createdAt),
          lastActivity: sessionLastActivity
        }
      }
    }

    return activeSession
  }

  async getSessionHistory(sessionId: string, documentId: string): Promise<CollaborationOperation[]> {
    const session = await this.getSession(sessionId, documentId)
    if (!session) return []

    return session.operations.sort((a, b) => a.version - b.version)
  }

  async getDocumentOperations(documentId: string, limit: number = 100): Promise<CollaborationOperation[]> {
    const operations = await this.redis.lrange(`document:${documentId}:operations`, 0, limit - 1)
    return operations.map(op => {
      const parsed = JSON.parse(op)
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
      }
    })
  }

  async getSessionCursors(sessionId: string): Promise<ParticipantCursor[]> {
    const cursors = await this.redis.hgetall(`session:${sessionId}:cursors`)
    return Object.values(cursors).map(cursor => {
      const parsed = JSON.parse(cursor)
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
      }
    })
  }

  private applyOperationToState(state: any, operation: CollaborationOperation): any {
    let { content } = state

    switch (operation.type) {
      case 'insert':
        content = content.slice(0, operation.position) +
                 (operation.content || '') +
                 content.slice(operation.position)
        break
      case 'delete':
        content = content.slice(0, operation.position) +
                 content.slice(operation.position + (operation.length || 0))
        break
      case 'retain':
        // No change to content, just move cursor
        break
      case 'format':
        // Apply formatting (would be more complex in real implementation)
        break
    }

    return {
      content,
      version: operation.version
    }
  }

  private async notifySessionParticipants(sessionId: string, message: any, excludeUserId?: string): Promise<void> {
    await this.redis.publish('realtime:session', JSON.stringify({
      sessionId,
      message,
      excludeUserId
    }))
  }

  async getSessionStats(sessionId: string, documentId: string): Promise<any> {
    const session = await this.getSession(sessionId, documentId)
    if (!session) return null

    const cursors = await this.getSessionCursors(sessionId)

    return {
      sessionId,
      documentId,
      participantCount: session.participants.length,
      operationCount: session.operations.length,
      activeCursors: cursors.length,
      lastActivity: session.lastActivity,
      duration: Date.now() - session.createdAt.getTime()
    }
  }

  async getDocumentStats(documentId: string): Promise<any> {
    const sessions = await this.redis.hgetall(`sessions:${documentId}`)
    const totalOperations = await this.redis.llen(`document:${documentId}:operations`)

    let totalParticipants = 0
    let activeSessions = 0

    for (const [sessionId, sessionData] of Object.entries(sessions)) {
      const session = JSON.parse(sessionData)
      if (session.participants.length > 0) {
        activeSessions++
        totalParticipants += session.participants.length
      }
    }

    return {
      documentId,
      totalSessions: Object.keys(sessions).length,
      activeSessions,
      totalParticipants,
      totalOperations,
      totalOperationsToday: await this.getOperationsToday(documentId)
    }
  }

  private async getOperationsToday(documentId: string): Promise<number> {
    const today = new Date().toDateString()
    const operations = await this.getDocumentOperations(documentId, 10000) // Large limit

    return operations.filter(op => op.timestamp.toDateString() === today).length
  }
}
