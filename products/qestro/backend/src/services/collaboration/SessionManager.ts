/**
 * Session Manager - Handles session lifecycle and state
 */

import { logger } from '../../utils/logger.js';
import { OperationalTransform } from './OperationalTransform.js';
import type {
  CollaborationSession,
  EditOperation,
  CursorPosition,
  AckMessage,
  SyncMessage,
} from './types.js';

export class SessionManager {
  private sessions = new Map<string, CollaborationSession>();
  private operationBuffer = new Map<string, EditOperation[]>();
  private readonly SESSION_TIMEOUT = 1000 * 60 * 30;

  /**
   * Create a new session
   */
  createSession(sessionId: string, testId: string, projectId: string, maxParticipants: number): CollaborationSession {
    const session: CollaborationSession = {
      sessionId,
      testId,
      projectId,
      document: '',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [],
      operationHistory: [],
      maxParticipants,
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.operationBuffer.set(sessionId, []);
    return session;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Apply edit operation
   */
  applyEdit(sessionId: string, operation: EditOperation): AckMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        type: 'ack',
        sessionId,
        timestamp: Date.now(),
        payload: {
          operationId: `${operation.userId}-${operation.timestamp}`,
          version: 0,
          success: false,
          error: 'Session not found',
        },
      };
    }

    try {
      session.document = OperationalTransform.apply(session.document, operation);
      session.operationHistory.push(operation);
      session.version += 1;
      session.updatedAt = new Date();

      logger.debug(`Edit applied: sessionId=${sessionId}, version=${session.version}`);

      return {
        type: 'ack',
        sessionId,
        timestamp: Date.now(),
        payload: {
          operationId: `${operation.userId}-${operation.timestamp}`,
          version: session.version,
          success: true,
        },
      };
    } catch (error) {
      logger.error(`Edit failed: sessionId=${sessionId}, error=${error}`);
      return {
        type: 'ack',
        sessionId,
        timestamp: Date.now(),
        payload: {
          operationId: `${operation.userId}-${operation.timestamp}`,
          version: session.version,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Update cursor
   */
  updateCursor(sessionId: string, cursor: CursorPosition): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === cursor.userId);
    if (participant) {
      participant.presence.cursorPosition = cursor;
      participant.presence.lastSeen = new Date();
      session.updatedAt = new Date();
    }
  }

  /**
   * Update presence
   */
  updatePresence(sessionId: string, userId: string, status: 'editing' | 'viewing' | 'idle'): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (participant) {
      participant.presence.status = status;
      participant.presence.lastSeen = new Date();
      session.updatedAt = new Date();
    }
  }

  /**
   * Get session state
   */
  getState(sessionId: string): SyncMessage['payload'] | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      document: session.document,
      version: session.version,
      participants: session.participants,
      operations: session.operationHistory.slice(-100),
    };
  }

  /**
   * Close session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      setTimeout(() => {
        this.sessions.delete(sessionId);
        this.operationBuffer.delete(sessionId);
      }, this.SESSION_TIMEOUT);
    }
  }

  /**
   * Clear all
   */
  clear(): void {
    this.sessions.clear();
    this.operationBuffer.clear();
  }
}
