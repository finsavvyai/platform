/**
 * Session Manager
 * Manages recording sessions: creation, action recording, and cleanup
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import {
  RecordingSession,
  RecordedAction,
  RecordingOptions,
  SessionMetadata,
} from './types.js';

interface SessionMap {
  [sessionId: string]: RecordingSession;
}

export class SessionManager {
  private sessions: SessionMap = {};
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly SESSION_TIMEOUT = 1800000; // 30 minutes

  /**
   * Start a new recording session
   */
  startSession(
    projectId: string,
    url: string,
    options: RecordingOptions,
    metadata?: SessionMetadata
  ): RecordingSession {
    const sessionId = uuidv4();
    const now = Date.now();

    const session: RecordingSession = {
      id: sessionId,
      projectId,
      url,
      status: 'active',
      actions: [],
      startTime: now,
      options,
      userAgent: metadata?.userAgent,
      viewport: metadata?.screenSize,
    };

    this.sessions[sessionId] = session;

    // Set auto-cleanup timeout
    this.setSessionTimeout(sessionId);

    logger.info('Recording session started', {
      sessionId,
      projectId,
      url,
    });

    return session;
  }

  /**
   * Add action to session
   */
  addAction(sessionId: string, action: RecordedAction): void {
    const session = this.sessions[sessionId];
    if (!session) {
      logger.warn('Session not found', { sessionId });
      return;
    }

    if (session.status !== 'active') {
      logger.warn('Cannot add action to inactive session', { sessionId, status: session.status });
      return;
    }

    session.actions.push(action);

    if (action.metadata?.debug) {
      logger.debug('Action recorded', {
        sessionId,
        actionId: action.id,
        type: action.type,
      });
    }
  }

  /**
   * Pause session
   */
  pauseSession(sessionId: string): RecordingSession | undefined {
    const session = this.sessions[sessionId];
    if (!session) return undefined;

    session.status = 'paused';
    logger.info('Session paused', { sessionId, actionCount: session.actions.length });
    return session;
  }

  /**
   * Resume session
   */
  resumeSession(sessionId: string): RecordingSession | undefined {
    const session = this.sessions[sessionId];
    if (!session) return undefined;

    session.status = 'active';
    logger.info('Session resumed', { sessionId });
    return session;
  }

  /**
   * End session
   */
  endSession(sessionId: string): RecordingSession | undefined {
    const session = this.sessions[sessionId];
    if (!session) return undefined;

    const now = Date.now();
    session.status = 'completed';
    session.endTime = now;
    session.duration = now - session.startTime;

    this.clearSessionTimeout(sessionId);

    logger.info('Recording session ended', {
      sessionId,
      duration: session.duration,
      actionCount: session.actions.length,
    });

    return session;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): RecordingSession | undefined {
    return this.sessions[sessionId];
  }

  /**
   * Get all actions for session
   */
  getActions(sessionId: string): RecordedAction[] {
    const session = this.sessions[sessionId];
    return session?.actions || [];
  }

  /**
   * Delete session (cleanup)
   */
  deleteSession(sessionId: string): boolean {
    if (sessionId in this.sessions) {
      delete this.sessions[sessionId];
      this.clearSessionTimeout(sessionId);
      logger.info('Session deleted', { sessionId });
      return true;
    }
    return false;
  }

  /**
   * Get all active sessions for project
   */
  getProjectSessions(projectId: string): RecordingSession[] {
    return Object.values(this.sessions).filter((s) => s.projectId === projectId);
  }

  /**
   * Clean up expired sessions
   */
  private setSessionTimeout(sessionId: string): void {
    // Clear any existing timeout
    this.clearSessionTimeout(sessionId);

    const timeout = setTimeout(() => {
      const session = this.sessions[sessionId];
      if (session && session.status === 'active') {
        logger.warn('Session auto-cleanup due to inactivity', {
          sessionId,
          duration: Date.now() - session.startTime,
        });
        this.endSession(sessionId);
        // Keep session data for a bit before deleting
        setTimeout(() => {
          this.deleteSession(sessionId);
        }, 300000); // 5 more minutes before full deletion
      }
    }, this.SESSION_TIMEOUT);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  /**
   * Clear session timeout
   */
  private clearSessionTimeout(sessionId: string): void {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  /**
   * Get session stats
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    pausedSessions: number;
  } {
    const sessions = Object.values(this.sessions);
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      completedSessions: sessions.filter((s) => s.status === 'completed').length,
      pausedSessions: sessions.filter((s) => s.status === 'paused').length,
    };
  }
}

export const sessionManager = new SessionManager();
