import { Request, Response } from 'express';
import { webRecordingService } from '../services/WebRecordingService.js';
import { testExportService } from '../services/TestExportService.js';
import { RecordingStartRequest, RecordingStopRequest, RecordingExportRequest } from '../types/recording.js';
import { logger } from '../utils/logger.js';

export class WebRecordingController {
  
  async startRecording(req: Request, res: Response): Promise<void> {
    try {
      const { type, config, projectId, name }: RecordingStartRequest = req.body;
      
      if (type !== 'web') {
        res.status(400).json({ error: 'Invalid recording type for web recording endpoint' });
        return;
      }

      // Generate session ID
      const sessionId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Start cloud recording
      const session = await webRecordingService.startCloudRecording(sessionId, config as any);
      
      logger.info(`Web recording started: ${sessionId} for project ${projectId}`);
      
      res.status(200).json({
        success: true,
        sessionId: session.id,
        status: session.status,
        config: session.config,
        message: 'Web recording started successfully'
      });
    } catch (error) {
      logger.error(`Failed to start web recording: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to start recording',
        details: error.message
      });
    }
  }

  async stopRecording(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId }: RecordingStopRequest = req.body;
      
      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const session = await webRecordingService.stopCloudRecording(sessionId);
      
      logger.info(`Web recording stopped: ${sessionId}, ${session.actions.length} actions recorded`);
      
      res.status(200).json({
        success: true,
        sessionId: session.id,
        status: session.status,
        duration: session.duration,
        actionCount: session.actions.length,
        actions: session.actions,
        message: 'Recording stopped successfully'
      });
    } catch (error) {
      logger.error(`Failed to stop web recording: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to stop recording',
        details: error.message
      });
    }
  }

  async getRecordingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const session = await webRecordingService.getRecordingSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Recording session not found' });
        return;
      }

      res.status(200).json({
        success: true,
        session: {
          id: session.id,
          type: session.type,
          platform: session.platform,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          actionCount: session.actions.length,
          config: session.config
        }
      });
    } catch (error) {
      logger.error(`Failed to get recording status: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get recording status',
        details: error.message
      });
    }
  }

  async getRecordingActions(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { limit, offset } = req.query;
      
      const session = await webRecordingService.getRecordingSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Recording session not found' });
        return;
      }

      let actions = session.actions;
      
      // Apply pagination if requested
      if (offset !== undefined || limit !== undefined) {
        const startIndex = parseInt(offset as string) || 0;
        const endIndex = limit ? startIndex + parseInt(limit as string) : undefined;
        actions = actions.slice(startIndex, endIndex);
      }

      res.status(200).json({
        success: true,
        sessionId: session.id,
        totalActions: session.actions.length,
        actions: actions,
        pagination: {
          offset: parseInt(offset as string) || 0,
          limit: limit ? parseInt(limit as string) : session.actions.length,
          total: session.actions.length
        }
      });
    } catch (error) {
      logger.error(`Failed to get recording actions: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get recording actions',
        details: error.message
      });
    }
  }

  async exportRecording(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, format, options }: RecordingExportRequest = req.body;
      
      if (!sessionId || !format) {
        res.status(400).json({ error: 'Session ID and format are required' });
        return;
      }

      const session = await webRecordingService.getRecordingSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Recording session not found' });
        return;
      }

      if (session.status !== 'completed') {
        res.status(400).json({ error: 'Recording must be completed before export' });
        return;
      }

      const exportOptions = {
        format,
        url: session.config.url,
        viewport: session.config.viewport,
        name: options?.name || `Recording_${sessionId}`,
        waitStrategy: options?.waitStrategy || 'smart',
        includeAssertions: options?.includeAssertions || false
      };

      const exportedCode = testExportService.exportRecording(session, exportOptions as any);
      
      // Set appropriate content type based on format
      const contentTypes = {
        puppeteer: 'application/javascript',
        playwright: 'application/javascript',
        cypress: 'application/javascript',
        selenium: 'application/javascript',
        yaml: 'application/x-yaml',
        'workflow-use': 'application/x-yaml'
      };

      const fileExtensions = {
        puppeteer: 'js',
        playwright: 'js',
        cypress: 'js',
        selenium: 'js',
        yaml: 'yaml',
        'workflow-use': 'yaml'
      };

      const contentType = contentTypes[format] || 'text/plain';
      const fileExtension = fileExtensions[format] || 'txt';
      const filename = `${exportOptions.name}.${fileExtension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      logger.info(`Exported recording ${sessionId} to ${format} format`);
      
      res.status(200).send(exportedCode);
    } catch (error) {
      logger.error(`Failed to export recording: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to export recording',
        details: error.message
      });
    }
  }

  async getRecordingScreenshot(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const screenshot = await webRecordingService.getBrowserScreenshot(sessionId);
      
      if (!screenshot) {
        res.status(404).json({ error: 'Screenshot not available' });
        return;
      }

      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(screenshot);
    } catch (error) {
      logger.error(`Failed to get screenshot: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get screenshot',
        details: error.message
      });
    }
  }

  async listActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const activeSessions = await webRecordingService.listActiveSessions();
      
      res.status(200).json({
        success: true,
        activeSessions: activeSessions,
        count: activeSessions.length
      });
    } catch (error) {
      logger.error(`Failed to list active sessions: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to list active sessions',
        details: error.message
      });
    }
  }

  async executeAction(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { action } = req.body;
      
      if (!action) {
        res.status(400).json({ error: 'Action is required' });
        return;
      }

      await webRecordingService.executeAction(sessionId, action);
      
      res.status(200).json({
        success: true,
        message: 'Action executed successfully'
      });
    } catch (error) {
      logger.error(`Failed to execute action: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to execute action',
        details: error.message
      });
    }
  }

  // WebSocket event handlers for real-time updates
  setupWebSocketHandlers(io: any): void {
    webRecordingService.on('recording:started', (data) => {
      io.to(`session_${data.sessionId}`).emit('recording:started', data);
    });

    webRecordingService.on('recording:action', (data) => {
      io.to(`session_${data.sessionId}`).emit('recording:action', data);
    });

    webRecordingService.on('recording:completed', (data) => {
      io.to(`session_${data.sessionId}`).emit('recording:completed', data);
    });

    webRecordingService.on('recording:event', (data) => {
      io.to(`session_${data.sessionId}`).emit('recording:event', data);
    });
  }
}

export const webRecordingController = new WebRecordingController();