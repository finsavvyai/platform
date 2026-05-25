/**
 * Real-time Collaboration Server
 * WebSocket-based multiplayer test editor with Operational Transform
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { SessionManager } from './SessionManager.js';
import {
  generateParticipantColor,
  findParticipant,
  removeParticipant,
  getActiveParticipants as getActive,
  isSessionFull,
  createParticipant,
} from './CollaborationUtils.js';
import type { CollaborationSession, Participant, EditOperation, CursorPosition } from './types.js';

export class CollaborationServer extends EventEmitter {
  private sessionManager = new SessionManager();
  private userSessions = new Map<string, Set<string>>();
  private readonly MAX_PARTICIPANTS = 50;

  async createSession(testId: string, projectId: string, userId: string, userName: string): Promise<CollaborationSession> {
    const sessionId = `${testId}-${Date.now()}`;
    const session = this.sessionManager.createSession(sessionId, testId, projectId, this.MAX_PARTICIPANTS);
    logger.info(`Session created: sessionId=${sessionId}, testId=${testId}`);
    this.emit('session:created', { sessionId, testId });
    return session;
  }

  async joinSession(sessionId: string, userId: string, userName: string, email: string): Promise<Participant> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.isActive) throw new Error(`Session is inactive: ${sessionId}`);
    if (isSessionFull(session.participants, this.MAX_PARTICIPANTS)) {
      throw new Error(`Session is full: ${sessionId}`);
    }

    const existing = findParticipant(session.participants, userId);
    if (existing) return existing;

    const participant = createParticipant(
      userId,
      userName,
      email,
      generateParticipantColor(session.participants.length)
    );

    session.participants.push(participant);
    session.updatedAt = new Date();

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    logger.info(`User joined: userId=${userId}, sessionId=${sessionId}`);
    this.emit('participant:joined', { sessionId, participant });
    return participant;
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const participant = findParticipant(session.participants, userId);
    if (!participant) return;

    session.participants = removeParticipant(session.participants, userId);
    session.updatedAt = new Date();

    const userSessions = this.userSessions.get(userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) this.userSessions.delete(userId);
    }

    if (session.participants.length === 0) this.sessionManager.closeSession(sessionId);

    logger.info(`User left: userId=${userId}, sessionId=${sessionId}`);
    this.emit('participant:left', { sessionId, participant });
  }

  async broadcastEdit(sessionId: string, operation: EditOperation) {
    const ack = this.sessionManager.applyEdit(sessionId, operation);
    if (ack.payload.success) {
      this.emit('edit:applied', { sessionId, operation, version: ack.payload.version });
    }
    return ack;
  }

  async broadcastCursor(sessionId: string, cursor: CursorPosition): Promise<void> {
    this.sessionManager.updateCursor(sessionId, cursor);
    logger.debug(`Cursor updated: userId=${cursor.userId}, sessionId=${sessionId}`);
    this.emit('cursor:updated', { sessionId, cursor });
  }

  async updatePresence(sessionId: string, userId: string, status: 'editing' | 'viewing' | 'idle'): Promise<void> {
    this.sessionManager.updatePresence(sessionId, userId, status);
    this.emit('presence:updated', { sessionId, userId, status });
  }

  getActiveParticipants(sessionId: string): Participant[] {
    const session = this.sessionManager.getSession(sessionId);
    return session ? getActive(session.participants) : [];
  }

  getSessionState(sessionId: string) {
    return this.sessionManager.getState(sessionId);
  }

  clear(): void {
    this.sessionManager.clear();
    this.userSessions.clear();
    logger.info('Collaboration cleared');
  }

  getStats() {
    const sessions = Array.from((this.sessionManager as any).sessions?.values?.() ?? []);
    return {
      activeSessions: sessions.filter((s: any) => s.isActive).length,
      totalParticipants: sessions.reduce((sum: number, s: any) => sum + s.participants.length, 0),
      totalOperations: sessions.reduce((sum: number, s: any) => sum + s.operationHistory.length, 0),
    };
  }
}

export const collaborationServer = new CollaborationServer();
