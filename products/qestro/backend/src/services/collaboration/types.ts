/**
 * Real-time Collaboration Types
 * Defines structures for multiplayer test editing with Operational Transform
 */

/**
 * Represents the position of a cursor in the editor (line, column)
 */
export interface CursorPosition {
  line: number;
  column: number;
  userId: string;
  userName: string;
  color: string;
}

/**
 * Operational Transform edit operation - atomic change to document
 */
export interface EditOperation {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  userId: string;
  version: number;
}

/**
 * Presence information for a participant in a session
 */
export interface Presence {
  userId: string;
  userName: string;
  status: 'editing' | 'viewing' | 'idle';
  lastSeen: Date;
  cursorPosition?: CursorPosition;
}

/**
 * Participant in collaboration session
 */
export interface Participant {
  userId: string;
  userName: string;
  email: string;
  joinedAt: Date;
  presence: Presence;
  color: string;
}

/**
 * Collaboration session for a test
 */
export interface CollaborationSession {
  sessionId: string;
  testId: string;
  projectId: string;
  document: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  participants: Participant[];
  operationHistory: EditOperation[];
  maxParticipants?: number;
  isActive: boolean;
}

/**
 * Conflict resolution strategy for concurrent operations
 */
export interface ConflictResolution {
  strategy: 'ot' | 'crdt' | 'last_write_wins';
  opA: EditOperation;
  opB: EditOperation;
  resolvedOpA: EditOperation;
  resolvedOpB: EditOperation;
}

/**
 * WebSocket message types for real-time collaboration
 */
export interface CollaborationMessage {
  type: 'join' | 'leave' | 'edit' | 'cursor' | 'presence' | 'ack' | 'sync';
  sessionId: string;
  userId?: string;
  payload: unknown;
  timestamp: number;
}

/**
 * Edit message for operational transform
 */
export interface EditMessage extends CollaborationMessage {
  type: 'edit';
  payload: EditOperation;
}

/**
 * Cursor position update message
 */
export interface CursorMessage extends CollaborationMessage {
  type: 'cursor';
  payload: CursorPosition;
}

/**
 * Session sync response with full state
 */
export interface SyncMessage extends CollaborationMessage {
  type: 'sync';
  payload: {
    document: string;
    version: number;
    participants: Participant[];
    operations: EditOperation[];
  };
}

/**
 * Acknowledgment message for operations
 */
export interface AckMessage extends CollaborationMessage {
  type: 'ack';
  payload: {
    operationId: string;
    version: number;
    success: boolean;
    error?: string;
  };
}
