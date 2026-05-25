/**
 * Collaboration Server Tests
 * Tests for multiplayer test editing and WebSocket coordination
 */

import { CollaborationServer } from '../CollaborationServer.js';
import { OperationalTransform } from '../OperationalTransform.js';
import type { EditOperation } from '../types.js';

describe('CollaborationServer', () => {
  let server: CollaborationServer;

  beforeEach(() => {
    server = new CollaborationServer();
  });

  afterEach(() => {
    server.clear();
  });

  describe('Session Management', () => {
    it('should create a new session', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');

      expect(session.sessionId).toBeDefined();
      expect(session.testId).toBe('test-1');
      expect(session.projectId).toBe('project-1');
      expect(session.participants).toHaveLength(0);
      expect(session.isActive).toBe(true);
    });

    it('should allow users to join a session', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      const participant = await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');

      expect(participant.userId).toBe('user-2');
      expect(participant.userName).toBe('Bob');
      expect(participant.color).toBeDefined();
    });

    it('should track participants', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');
      await server.joinSession(session.sessionId, 'user-3', 'Charlie', 'charlie@example.com');

      const participants = server.getActiveParticipants(session.sessionId);
      expect(participants).toHaveLength(2);
    });

    it('should allow users to leave a session', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');

      await server.leaveSession(session.sessionId, 'user-2');

      const participants = server.getActiveParticipants(session.sessionId);
      expect(participants).toHaveLength(0);
    });

    it('should prevent duplicate participants', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');
      const participant2 = await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');

      expect(participant2.userId).toBe('user-2');
    });
  });

  describe('Edit Operations', () => {
    it('should apply insert operation', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');

      const op: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'hello',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const ack = await server.broadcastEdit(session.sessionId, op);

      expect(ack.payload.success).toBe(true);
      expect(ack.payload.version).toBe(2);
    });

    it('should apply delete operation', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');

      const insertOp: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'hello',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      await server.broadcastEdit(session.sessionId, insertOp);

      const deleteOp: EditOperation = {
        type: 'delete',
        position: 0,
        length: 2,
        timestamp: Date.now(),
        userId: 'user-1',
        version: 2,
      };

      const ack = await server.broadcastEdit(session.sessionId, deleteOp);

      expect(ack.payload.success).toBe(true);
    });

    it('should transform concurrent operations', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');

      const op1: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'a',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const op2: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'b',
        timestamp: Date.now(),
        userId: 'user-2',
        version: 1,
      };

      const transformed = server.transformOperation(session.sessionId, op2);

      expect(transformed.position).toBe(1);
    });
  });

  describe('Cursor Tracking', () => {
    it('should broadcast cursor positions', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');

      await server.broadcastCursor(session.sessionId, {
        line: 5,
        column: 10,
        userId: 'user-2',
        userName: 'Bob',
        color: '#FF0000',
      });

      const state = server.getSessionState(session.sessionId);
      const participant = state?.participants.find(p => p.userId === 'user-2');

      expect(participant?.presence.cursorPosition?.line).toBe(5);
      expect(participant?.presence.cursorPosition?.column).toBe(10);
    });
  });

  describe('Presence Tracking', () => {
    it('should update presence status', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');

      await server.updatePresence(session.sessionId, 'user-2', 'editing');

      const state = server.getSessionState(session.sessionId);
      const participant = state?.participants.find(p => p.userId === 'user-2');

      expect(participant?.presence.status).toBe('editing');
    });

    it('should filter idle participants', async () => {
      const session = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.joinSession(session.sessionId, 'user-2', 'Bob', 'bob@example.com');
      await server.updatePresence(session.sessionId, 'user-2', 'idle');

      const active = server.getActiveParticipants(session.sessionId);

      expect(active).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should track session statistics', async () => {
      await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      await server.createSession('test-2', 'project-1', 'user-1', 'Alice');

      const stats = server.getStats();

      expect(stats.activeSessions).toBe(2);
    });

    it('should count total participants', async () => {
      const session1 = await server.createSession('test-1', 'project-1', 'user-1', 'Alice');
      const session2 = await server.createSession('test-2', 'project-1', 'user-1', 'Alice');

      await server.joinSession(session1.sessionId, 'user-2', 'Bob', 'bob@example.com');
      await server.joinSession(session2.sessionId, 'user-3', 'Charlie', 'charlie@example.com');

      const stats = server.getStats();

      expect(stats.totalParticipants).toBe(2);
    });
  });
});

describe('OperationalTransform', () => {
  describe('Apply Operations', () => {
    it('should apply insert operation', () => {
      const doc = 'hello';
      const op: EditOperation = {
        type: 'insert',
        position: 2,
        content: 'XX',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const result = OperationalTransform.apply(doc, op);
      expect(result).toBe('heXXllo');
    });

    it('should apply delete operation', () => {
      const doc = 'hello';
      const op: EditOperation = {
        type: 'delete',
        position: 1,
        length: 3,
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const result = OperationalTransform.apply(doc, op);
      expect(result).toBe('ho');
    });

    it('should apply replace operation', () => {
      const doc = 'hello';
      const op: EditOperation = {
        type: 'replace',
        position: 1,
        length: 3,
        content: 'XX',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const result = OperationalTransform.apply(doc, op);
      expect(result).toBe('hXXo');
    });
  });

  describe('Transform Operations', () => {
    it('should transform insert against insert', () => {
      const opA: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'a',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const opB: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'b',
        timestamp: Date.now(),
        userId: 'user-2',
        version: 1,
      };

      const transformed = OperationalTransform.transform(opA, opB);

      expect(transformed.position).toBe(1);
    });

    it('should transform delete against insert', () => {
      const opA: EditOperation = {
        type: 'insert',
        position: 5,
        content: 'xxx',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const opB: EditOperation = {
        type: 'delete',
        position: 0,
        length: 2,
        timestamp: Date.now(),
        userId: 'user-2',
        version: 1,
      };

      const transformed = OperationalTransform.transform(opA, opB);

      expect(transformed.position).toBe(0);
      expect(transformed.length).toBe(2);
    });
  });

  describe('Compose Operations', () => {
    it('should compose consecutive inserts', () => {
      const opA: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'hello',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const opB: EditOperation = {
        type: 'insert',
        position: 5,
        content: ' world',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 2,
      };

      const composed = OperationalTransform.compose(opA, opB);

      expect(composed.type).toBe('insert');
      expect(composed.content).toBe('hello world');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve concurrent operations', () => {
      const opA: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'a',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      const opB: EditOperation = {
        type: 'insert',
        position: 0,
        content: 'b',
        timestamp: Date.now(),
        userId: 'user-2',
        version: 1,
      };

      const resolution = OperationalTransform.resolveConflict(opA, opB);

      expect(resolution.strategy).toBe('ot');
      expect(resolution.resolvedOpA).toBeDefined();
      expect(resolution.resolvedOpB).toBeDefined();
    });
  });
});
