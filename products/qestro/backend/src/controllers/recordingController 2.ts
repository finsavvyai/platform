import { Request, Response } from 'express';
import { RecordingService, RecordingConfig } from '../services/RecordingService.js';
import { logger, logRecordingEvent } from '../utils/logger.js';
import { db } from '../config/database.js';
import { recordingSessions, recordedActions } from '../schema/index.js';
import { eq } from 'drizzle-orm';

const recordingService = new RecordingService();

// Start a new recording session
export const startRecording = async (req: Request, res: Response) => {
  try {
    const { type, platform, metadata, outputDir, recordVideo = true, recordScreenshots = true } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!type || !platform) {
      return res.status(400).json({ error: 'Type and platform are required' });
    }

    // Validate type
    if (!['mobile', 'web'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "mobile" or "web"' });
    }

    const config: RecordingConfig = {
      type,
      platform,
      metadata: metadata || {},
      outputDir,
      recordVideo,
      recordScreenshots,
    };

    // Start recording session
    const session = await recordingService.startRecording(config);
    
    // Save session to database
    await db.insert(recordingSessions).values({
      id: session.id,
      projectId: req.body.projectId, // Optional project association
      userId,
      name: req.body.name,
      type: session.type,
      platform: session.platform,
      status: session.status,
      startTime: session.startTime,
      metadata: session.metadata,
      artifacts: session.artifacts,
    });

    logRecordingEvent(session.id, 'started', { type, platform, userId });

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        type: session.type,
        platform: session.platform,
        status: session.status,
        startTime: session.startTime,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to start recording:', error);
    res.status(500).json({ 
      error: 'Failed to start recording session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Stop a recording session
export const stopRecording = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify session ownership
    const [sessionRecord] = await db
      .select()
      .from(recordingSessions)
      .where(eq(recordingSessions.id, sessionId))
      .limit(1);

    if (!sessionRecord) {
      return res.status(404).json({ error: 'Recording session not found' });
    }

    if (sessionRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this recording session' });
    }

    // Stop recording
    const session = await recordingService.stopRecording(sessionId);
    
    // Update database
    await db
      .update(recordingSessions)
      .set({
        status: session.status,
        endTime: session.endTime,
        duration: session.duration,
        actionsCount: session.actions.length,
        artifacts: session.artifacts,
        updatedAt: new Date(),
      })
      .where(eq(recordingSessions.id, sessionId));

    // Save recorded actions
    if (session.actions.length > 0) {
      const actionsToInsert = session.actions.map((action, index) => ({
        id: action.id,
        sessionId: session.id,
        sequenceNumber: index + 1,
        type: action.type,
        timestamp: new Date(action.timestamp),
        coordinates: action.coordinates || null,
        text: action.text || null,
        element: action.element || null,
        selector: action.selector || null,
        screenshot: action.screenshot || null,
        metadata: action.metadata || {},
      }));

      await db.insert(recordedActions).values(actionsToInsert);
    }

    logRecordingEvent(session.id, 'completed', { 
      duration: session.duration,
      actionsCount: session.actions.length,
      userId 
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        duration: session.duration,
        actionsCount: session.actions.length,
        actions: session.actions,
        artifacts: session.artifacts,
      },
    });
  } catch (error) {
    logger.error('Failed to stop recording:', error);
    res.status(500).json({ 
      error: 'Failed to stop recording session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get recording session status
export const getRecordingStatus = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get session from service (for real-time data)
    const session = recordingService.getSession(sessionId);
    
    if (!session) {
      // Try to get from database
      const [sessionRecord] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, sessionId))
        .limit(1);

      if (!sessionRecord) {
        return res.status(404).json({ error: 'Recording session not found' });
      }

      if (sessionRecord.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to this recording session' });
      }

      return res.json({
        success: true,
        session: {
          id: sessionRecord.id,
          status: sessionRecord.status,
          type: sessionRecord.type,
          platform: sessionRecord.platform,
          startTime: sessionRecord.startTime,
          endTime: sessionRecord.endTime,
          duration: sessionRecord.duration,
          actionsCount: sessionRecord.actionsCount,
          metadata: sessionRecord.metadata,
          artifacts: sessionRecord.artifacts,
        },
      });
    }

    // Verify ownership for active sessions
    const [sessionRecord] = await db
      .select({ userId: recordingSessions.userId })
      .from(recordingSessions)
      .where(eq(recordingSessions.id, sessionId))
      .limit(1);

    if (!sessionRecord || sessionRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this recording session' });
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        type: session.type,
        platform: session.platform,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        actionsCount: session.actions.length,
        actions: session.actions,
        metadata: session.metadata,
        artifacts: session.artifacts,
      },
    });
  } catch (error) {
    logger.error('Failed to get recording status:', error);
    res.status(500).json({ 
      error: 'Failed to get recording session status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Export recording session in different formats
export const exportRecording = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify session ownership
    const [sessionRecord] = await db
      .select()
      .from(recordingSessions)
      .where(eq(recordingSessions.id, sessionId))
      .limit(1);

    if (!sessionRecord) {
      return res.status(404).json({ error: 'Recording session not found' });
    }

    if (sessionRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this recording session' });
    }

    if (sessionRecord.status !== 'completed') {
      return res.status(400).json({ error: 'Recording session is not completed' });
    }

    // Export session
    const exportData = await recordingService.exportSession(
      sessionId, 
      format as 'maestro' | 'workflow-use' | 'json'
    );

    const contentType = format === 'json' ? 'application/json' : 'text/yaml';
    const fileExtension = format === 'json' ? 'json' : 'yaml';
    const filename = `${sessionRecord.type}-test-${sessionId}.${fileExtension}`;

    logRecordingEvent(sessionId, 'exported', { format, userId });

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    res.send(exportData);
  } catch (error) {
    logger.error('Failed to export recording:', error);
    res.status(500).json({ 
      error: 'Failed to export recording session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// List user's recording sessions
export const listRecordingSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      type, 
      projectId 
    } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Build query conditions
    let whereConditions = eq(recordingSessions.userId, userId);
    
    if (status) {
      whereConditions = eq(recordingSessions.status, status as string);
    }
    
    if (type) {
      whereConditions = eq(recordingSessions.type, type as string);
    }
    
    if (projectId) {
      whereConditions = eq(recordingSessions.projectId, projectId as string);
    }

    // Get sessions
    const sessions = await db
      .select()
      .from(recordingSessions)
      .where(whereConditions)
      .limit(Number(limit))
      .offset(offset)
      .orderBy(recordingSessions.createdAt);

    res.json({
      success: true,
      sessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: sessions.length,
      },
    });
  } catch (error) {
    logger.error('Failed to list recording sessions:', error);
    res.status(500).json({ 
      error: 'Failed to list recording sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete a recording session
export const deleteRecordingSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify session ownership
    const [sessionRecord] = await db
      .select()
      .from(recordingSessions)
      .where(eq(recordingSessions.id, sessionId))
      .limit(1);

    if (!sessionRecord) {
      return res.status(404).json({ error: 'Recording session not found' });
    }

    if (sessionRecord.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this recording session' });
    }

    // Delete from database (actions will be cascade deleted)
    await db
      .delete(recordingSessions)
      .where(eq(recordingSessions.id, sessionId));

    logRecordingEvent(sessionId, 'deleted', { userId });

    res.json({
      success: true,
      message: 'Recording session deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete recording session:', error);
    res.status(500).json({ 
      error: 'Failed to delete recording session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// WebSocket event handlers for real-time updates
export const setupRecordingWebSocket = (io: any) => {
  // Listen for recording events
  recordingService.on('recording:started', (session) => {
    io.to(`user:${session.userId}`).emit('recording:started', session);
  });

  recordingService.on('recording:action', ({ session, action }) => {
    io.to(`user:${session.userId}`).emit('recording:action', { sessionId: session.id, action });
  });

  recordingService.on('recording:completed', (session) => {
    io.to(`user:${session.userId}`).emit('recording:completed', session);
  });

  recordingService.on('recording:error', ({ session, error }) => {
    io.to(`user:${session.userId}`).emit('recording:error', { sessionId: session.id, error: error.message });
  });
};

export { recordingService };