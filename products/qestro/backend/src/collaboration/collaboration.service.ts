/**
 * Real-time Collaboration Service
 * Handles WebSocket connections, live test execution, team collaboration features
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/DatabaseService';

interface AuthenticatedSocket extends Socket {
  userId: string;
  teamId?: string;
  userRole: string;
  currentRoom?: string;
}


interface CollaborationRoom {
  id: string;
  type: 'project' | 'test_case' | 'test_run' | 'team';
  participants: Map<string, UserParticipant>;
  state: CollaborationState;
  createdAt: Date;
  lastActivity: Date;
}

interface UserParticipant {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  cursor?: {
    line: number;
    column: number;
    testId?: string;
  };
  status: 'active' | 'idle' | 'away';
  lastSeen: Date;
}

interface CollaborationState {
  sharedTestData?: any;
  activeTestRun?: {
    id: string;
    status: string;
    progress: number;
    currentStep: number;
    totalSteps: number;
    startTime: Date;
  };
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
    position?: {
      testId: string;
      stepIndex: number;
    };
  }>;
  version: number;
}

interface RealTimeEvent {
  type: 'cursor_move' | 'test_edit' | 'test_run_start' | 'test_run_progress' | 'test_run_complete' | 'comment_added' | 'user_join' | 'user_leave' | 'typing_start' | 'typing_stop';
  userId: string;
  roomId: string;
  data: any;
  timestamp: Date;
}

export class CollaborationService {
  private readonly io: SocketIOServer;
  private readonly db: DatabaseService;
  private readonly rooms: Map<string, CollaborationRoom> = new Map();
  private readonly userSockets: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    this.db = DatabaseService.getInstance();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "https://qestro.app",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupSocketHandlers();
    this.startCleanupInterval();
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await this.getUserById(decoded.userId);

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        next();

      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId}`);

      // Track user socket
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId)!.add(socket.id);

      // Handle joining rooms
      socket.on('join_room', async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      // Handle leaving rooms
      socket.on('leave_room', async (data) => {
        await this.handleLeaveRoom(socket, data);
      });

      // Handle cursor movements
      socket.on('cursor_move', (data) => {
        this.handleCursorMove(socket, data);
      });

      // Handle test editing
      socket.on('test_edit', (data) => {
        this.handleTestEdit(socket, data);
      });

      // Handle test run events
      socket.on('test_run_start', async (data) => {
        await this.handleTestRunStart(socket, data);
      });

      socket.on('test_run_step', (data) => {
        this.handleTestRunStep(socket, data);
      });

      // Handle comments
      socket.on('add_comment', async (data) => {
        await this.handleAddComment(socket, data);
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Join user's personal room for notifications
      socket.join(`user:${socket.userId}`);
    });
  }

  /**
   * Handle user joining a collaboration room
   */
  private async handleJoinRoom(socket: AuthenticatedSocket, data: {
    roomId: string;
    roomType: 'project' | 'test_case' | 'test_run' | 'team';
    resourceId?: string;
  }): Promise<void> {
    try {
      const { roomId, roomType, resourceId } = data;

      // Verify user has permission to access this room
      const hasPermission = await this.verifyRoomPermission(socket.userId, roomType, resourceId);
      if (!hasPermission) {
        socket.emit('error', { message: 'Permission denied' });
        return;
      }

      // Get or create room
      let room = this.rooms.get(roomId);
      if (!room) {
        room = await this.createRoom(roomId, roomType, resourceId);
        this.rooms.set(roomId, room);
      }

      // Get user details
      const user = await this.getUserById(socket.userId);
      if (!user) return;

      // Add participant to room
      const participant: UserParticipant = {
        id: socket.userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        avatar: user.avatarUrl,
        role: user.role,
        status: 'active',
        lastSeen: new Date()
      };

      room.participants.set(socket.userId, participant);
      room.lastActivity = new Date();

      // Join socket room
      socket.join(roomId);
      socket.currentRoom = roomId;

      // Broadcast user join to other participants
      socket.to(roomId).emit('user_joined', {
        user: participant,
        timestamp: new Date()
      });

      // Send current room state to joining user
      socket.emit('room_state', {
        room: {
          id: room.id,
          type: room.type,
          participants: Array.from(room.participants.values()),
          state: room.state
        },
        timestamp: new Date()
      });

      console.log(`User ${socket.userId} joined room ${roomId}`);

    } catch (error) {
      console.error('Handle join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle user leaving a collaboration room
   */
  private async handleLeaveRoom(socket: AuthenticatedSocket, data: { roomId: string }): Promise<void> {
    try {
      const { roomId } = data;
      const room = this.rooms.get(roomId);

      if (room) {
        // Remove participant from room
        room.participants.delete(socket.userId);
        room.lastActivity = new Date();

        // Leave socket room
        socket.leave(roomId);
        delete socket.currentRoom;

        // Broadcast user leave to other participants
        socket.to(roomId).emit('user_left', {
          userId: socket.userId,
          timestamp: new Date()
        });

        // Clean up empty rooms
        if (room.participants.size === 0) {
          setTimeout(() => {
            if (this.rooms.get(roomId)?.participants.size === 0) {
              this.rooms.delete(roomId);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }

        console.log(`User ${socket.userId} left room ${roomId}`);
      }

    } catch (error) {
      console.error('Handle leave room error:', error);
    }
  }

  /**
   * Handle cursor movement events
   */
  private handleCursorMove(socket: AuthenticatedSocket, data: {
    roomId: string;
    position: { line: number; column: number; testId?: string };
  }): void {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      const participant = room.participants.get(socket.userId);
      if (!participant) return;

      // Update participant cursor
      participant.cursor = data.position;
      participant.status = 'active';
      participant.lastSeen = new Date();

      room.lastActivity = new Date();

      // Broadcast cursor move to other participants (with throttling)
      socket.to(data.roomId).emit('cursor_move', {
        userId: socket.userId,
        position: data.position,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Handle cursor move error:', error);
    }
  }

  /**
   * Handle test editing events
   */
  private handleTestEdit(socket: AuthenticatedSocket, data: {
    roomId: string;
    testId: string;
    operation: 'insert' | 'delete' | 'update' | 'move';
    content: any;
    position?: number;
  }): void {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      // Update room state
      room.state.version++;
      room.lastActivity = new Date();

      // Broadcast edit to other participants
      socket.to(data.roomId).emit('test_edit', {
        userId: socket.userId,
        testId: data.testId,
        operation: data.operation,
        content: data.content,
        position: data.position,
        version: room.state.version,
        timestamp: new Date()
      });

      // Update participant status
      const participant = room.participants.get(socket.userId);
      if (participant) {
        participant.status = 'active';
        participant.lastSeen = new Date();
      }

    } catch (error) {
      console.error('Handle test edit error:', error);
    }
  }

  /**
   * Handle test run start
   */
  private async handleTestRunStart(socket: AuthenticatedSocket, data: {
    roomId: string;
    testId: string;
    testConfig: any;
  }): Promise<void> {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      // Create test run record
      const testRunResult = await this.db.query(
        `INSERT INTO test_runs (test_case_id, project_id, status, triggered_by, triggered_by_type, metadata)
         SELECT $1, project_id, 'pending', $2, 'user', $3
         FROM test_cases WHERE id = $1
         RETURNING id`,
        [data.testId, socket.userId, JSON.stringify(data.testConfig)]
      );

      const testRunId = testRunResult.rows[0].id;

      // Update room state
      room.state.activeTestRun = {
        id: testRunId,
        status: 'pending',
        progress: 0,
        currentStep: 0,
        totalSteps: 0,
        startTime: new Date()
      };
      room.lastActivity = new Date();

      // Broadcast test run start
      this.io.to(data.roomId).emit('test_run_start', {
        testRunId,
        testId: data.testId,
        config: data.testConfig,
        startedBy: socket.userId,
        timestamp: new Date()
      });

      // Trigger actual test execution (this would integrate with your test engine)
      this.executeTestRun(testRunId, data.testId, data.testConfig, data.roomId);

    } catch (error) {
      console.error('Handle test run start error:', error);
      socket.emit('error', { message: 'Failed to start test run' });
    }
  }

  /**
   * Handle test run progress updates
   */
  private handleTestRunStep(socket: AuthenticatedSocket, data: {
    roomId: string;
    testRunId: string;
    stepIndex: number;
    stepData: any;
    status: string;
  }): void {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      // Update room state
      if (room.state.activeTestRun?.id === data.testRunId) {
        room.state.activeTestRun.currentStep = data.stepIndex;
        room.state.activeTestRun.status = data.status;

        // Calculate progress (simplified)
        if (data.stepData.totalSteps) {
          room.state.activeTestRun.totalSteps = data.stepData.totalSteps;
          room.state.activeTestRun.progress = (data.stepIndex / data.stepData.totalSteps) * 100;
        }
      }

      room.lastActivity = new Date();

      // Broadcast progress to all participants
      this.io.to(data.roomId).emit('test_run_step', {
        testRunId: data.testRunId,
        stepIndex: data.stepIndex,
        stepData: data.stepData,
        status: data.status,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Handle test run step error:', error);
    }
  }

  /**
   * Handle adding comments
   */
  private async handleAddComment(socket: AuthenticatedSocket, data: {
    roomId: string;
    content: string;
    position?: {
      testId: string;
      stepIndex: number;
    };
  }): Promise<void> {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      const user = await this.getUserById(socket.userId);
      if (!user) return;

      const comment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: socket.userId,
        userName: `${user.firstName} ${user.lastName}`,
        content: data.content,
        position: data.position,
        timestamp: new Date()
      };

      // Add comment to room state
      room.state.comments.push(comment);
      room.lastActivity = new Date();

      // Broadcast comment to all participants
      this.io.to(data.roomId).emit('comment_added', comment);

      // Store comment in database (optional - for persistence)
      await this.db.query(
        `INSERT INTO test_comments (id, test_case_id, user_id, content, position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          comment.id,
          data.position?.testId,
          socket.userId,
          data.content,
          JSON.stringify(data.position),
          comment.timestamp
        ]
      ).catch(() => {
        // Ignore errors - comments are primarily real-time
      });

    } catch (error) {
      console.error('Handle add comment error:', error);
    }
  }

  /**
   * Handle typing indicators
   */
  private handleTypingStart(socket: AuthenticatedSocket, data: { roomId: string; testId?: string }): void {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      const participant = room.participants.get(socket.userId);
      if (!participant) return;

      participant.status = 'active';
      participant.lastSeen = new Date();

      socket.to(data.roomId).emit('typing_start', {
        userId: socket.userId,
        userName: participant.name,
        testId: data.testId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Handle typing start error:', error);
    }
  }

  private handleTypingStop(socket: AuthenticatedSocket, data: { roomId: string }): void {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) return;

      socket.to(data.roomId).emit('typing_stop', {
        userId: socket.userId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Handle typing stop error:', error);
    }
  }

  /**
   * Handle user disconnection
   */
  private handleDisconnect(socket: AuthenticatedSocket): void {
    try {
      console.log(`User disconnected: ${socket.userId}`);

      // Remove socket from user tracking
      const userSockets = this.userSockets.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(socket.userId);
        }
      }

      // Remove user from all rooms
      for (const [roomId, room] of this.rooms) {
        if (room.participants.has(socket.userId)) {
          room.participants.delete(socket.userId);
          room.lastActivity = new Date();

          // Notify other participants
          socket.to(roomId).emit('user_left', {
            userId: socket.userId,
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      console.error('Handle disconnect error:', error);
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(userId: string, notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    try {
      this.io.to(`user:${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  /**
   * Send notification to team
   */
  async sendNotificationToTeam(teamId: string, notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    excludeUser?: string;
  }): Promise<void> {
    try {
      // Get all team members
      const membersResult = await this.db.query(
        'SELECT user_id FROM team_members WHERE team_id = $1 AND is_active = true',
        [teamId]
      );

      for (const member of membersResult.rows) {
        if (member.user_id !== notification.excludeUser) {
          await this.sendNotificationToUser(member.user_id, notification);
        }
      }

    } catch (error) {
      console.error('Send team notification error:', error);
    }
  }

  /**
   * Broadcast system-wide announcement
   */
  async broadcastAnnouncement(announcement: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'maintenance';
    targetUsers?: string[];
  }): Promise<void> {
    try {
      // Map 'maintenance' to 'warning' for notification compatibility
      const notificationType: 'info' | 'success' | 'warning' | 'error' =
        announcement.type === 'maintenance' ? 'warning' : (announcement.type || 'info') as 'info' | 'warning';

      if (announcement.targetUsers) {
        // Send to specific users
        for (const userId of announcement.targetUsers) {
          await this.sendNotificationToUser(userId, {
            type: notificationType,
            title: announcement.title,
            message: announcement.message
          });
        }
      } else {
        // Send to all connected users
        this.io.emit('announcement', {
          type: announcement.type || 'info',
          title: announcement.title,
          message: announcement.message,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Broadcast announcement error:', error);
    }
  }

  // Private helper methods

  private async verifyRoomPermission(userId: string, roomType: string, resourceId?: string): Promise<boolean> {
    try {
      if (!resourceId) return true;

      switch (roomType) {
        case 'project':
          const projectResult = await this.db.query(
            `SELECT 1 FROM projects p
             JOIN team_members tm ON p.team_id = tm.team_id
             WHERE p.id = $1 AND tm.user_id = $2 AND tm.is_active = true`,
            [resourceId, userId]
          );
          return projectResult.rows.length > 0;

        case 'team':
          const teamResult = await this.db.query(
            `SELECT 1 FROM team_members
             WHERE team_id = $1 AND user_id = $2 AND is_active = true`,
            [resourceId, userId]
          );
          return teamResult.rows.length > 0;

        case 'test_case':
          const testCaseResult = await this.db.query(
            `SELECT 1 FROM test_cases tc
             JOIN projects p ON tc.project_id = p.id
             JOIN team_members tm ON p.team_id = tm.team_id
             WHERE tc.id = $1 AND tm.user_id = $2 AND tm.is_active = true`,
            [resourceId, userId]
          );
          return testCaseResult.rows.length > 0;

        default:
          return true;
      }

    } catch (error) {
      console.error('Verify room permission error:', error);
      return false;
    }
  }

  private async createRoom(roomId: string, roomType: string, resourceId?: string): Promise<CollaborationRoom> {
    return {
      id: roomId,
      type: roomType as any,
      participants: new Map(),
      state: {
        comments: [],
        version: 1
      },
      createdAt: new Date(),
      lastActivity: new Date()
    };
  }

  private async getUserById(userId: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT id, email, first_name, last_name, avatar_url, role
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) return null;

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        role: user.role
      };

    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }

  private async executeTestRun(testRunId: string, testId: string, config: any, roomId: string): Promise<void> {
    try {
      // This would integrate with your actual test execution engine
      // For now, we'll simulate progress updates

      // Update test run status to running
      await this.db.query(
        'UPDATE test_runs SET status = $1, started_at = NOW() WHERE id = $2',
        ['running', testRunId]
      );

      // Simulate test execution with progress updates
      const totalSteps = 5;
      for (let step = 0; step <= totalSteps; step++) {
        setTimeout(() => {
          const status = step === totalSteps ? 'completed' : 'running';

          this.io.to(roomId).emit('test_run_step', {
            testRunId,
            stepIndex: step,
            stepData: {
              stepName: `Step ${step + 1}`,
              description: `Executing test step ${step + 1}`,
              totalSteps
            },
            status,
            timestamp: new Date()
          });

          // Update database
          if (step === totalSteps) {
            this.db.query(
              `UPDATE test_runs
               SET status = $1, completed_at = NOW(), duration_ms = $2
               WHERE id = $3`,
              [status, 30000, testRunId] // 30 seconds duration
            );
          }
        }, step * 2000); // 2 seconds per step
      }

    } catch (error) {
      console.error('Execute test run error:', error);

      // Update test run as failed
      await this.db.query(
        'UPDATE test_runs SET status = $1, error_message = $2, completed_at = NOW() WHERE id = $3',
        ['failed', error.message, testRunId]
      );

      this.io.to(roomId).emit('test_run_error', {
        testRunId,
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  private startCleanupInterval(): void {
    // Clean up inactive rooms and participants every 5 minutes
    setInterval(() => {
      const now = new Date();
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [roomId, room] of this.rooms) {
        let hasActiveParticipants = false;

        // Check participants
        for (const [userId, participant] of room.participants) {
          if (now.getTime() - participant.lastSeen.getTime() < inactiveThreshold) {
            hasActiveParticipants = true;
          } else {
            // Remove inactive participant
            room.participants.delete(userId);
            this.io.to(roomId).emit('user_left', {
              userId,
              timestamp: now
            });
          }
        }

        // Remove room if no active participants
        if (!hasActiveParticipants && room.participants.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Get collaboration statistics
   */
  async getCollaborationStats(): Promise<{
    activeRooms: number;
    totalParticipants: number;
    activeUsers: number;
    popularRoomTypes: Array<{ type: string; count: number }>;
  }> {
    const activeRooms = this.rooms.size;
    const totalParticipants = Array.from(this.rooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);
    const activeUsers = this.userSockets.size;

    const roomTypeCounts = new Map<string, number>();
    for (const room of this.rooms.values()) {
      roomTypeCounts.set(room.type, (roomTypeCounts.get(room.type) || 0) + 1);
    }

    const popularRoomTypes = Array.from(roomTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      activeRooms,
      totalParticipants,
      activeUsers,
      popularRoomTypes
    };
  }
}

export default CollaborationService;
