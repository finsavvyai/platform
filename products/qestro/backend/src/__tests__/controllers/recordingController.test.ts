import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { recordingController } from '../../controllers/recordingController.js';

// Mock services
const mockRecordingService = {
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(),
  deleteSession: jest.fn(),
};

const mockSubscriptionService = {
  validateSubscriptionAccess: jest.fn(),
};

jest.mock('../../services/RecordingService.js', () => ({
  RecordingService: jest.fn(() => mockRecordingService),
}));

jest.mock('../../services/SubscriptionService.js', () => ({
  SubscriptionService: jest.fn(() => mockSubscriptionService),
}));

// Mock middleware
const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 'user_123', email: 'test@example.com' };
  next();
});

const mockValidationMiddleware = jest.fn((req, res, next) => next());

describe('RecordingController', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Apply middleware
    app.use(mockAuthMiddleware);
    app.use(mockValidationMiddleware);
    
    // Register routes
    app.post('/api/recordings/start', recordingController.startRecording);
    app.post('/api/recordings/:sessionId/stop', recordingController.stopRecording);
    app.get('/api/recordings/:sessionId', recordingController.getSession);
    app.get('/api/recordings', recordingController.listSessions);
    app.delete('/api/recordings/:sessionId', recordingController.deleteSession);
  });

  describe('POST /api/recordings/start', () => {
    it('should start a recording session successfully', async () => {
      const mockSession = {
        id: 'session_123',
        type: 'mobile',
        platform: 'ios',
        status: 'recording',
        startTime: new Date(),
        metadata: { deviceName: 'iPhone 15 Pro' }
      };

      mockSubscriptionService.validateSubscriptionAccess.mockResolvedValue(true);
      mockRecordingService.startRecording.mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/recordings/start')
        .send({
          type: 'mobile',
          platform: 'ios',
          metadata: {
            deviceName: 'iPhone 15 Pro',
            appId: 'com.test.app'
          }
        })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockSession
      });
      expect(mockRecordingService.startRecording).toHaveBeenCalledWith({
        type: 'mobile',
        platform: 'ios',
        metadata: {
          deviceName: 'iPhone 15 Pro',
          appId: 'com.test.app'
        }
      });
    });

    it('should return 403 when subscription access is denied', async () => {
      mockSubscriptionService.validateSubscriptionAccess.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/recordings/start')
        .send({
          type: 'mobile',
          platform: 'ios',
          metadata: {}
        })
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Subscription required for recording feature'
      });
    });

    it('should return 400 for invalid request data', async () => {
      const response = await request(app)
        .post('/api/recordings/start')
        .send({
          type: 'invalid',
          platform: 'unknown'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('Invalid')
      });
    });

    it('should handle service errors', async () => {
      mockSubscriptionService.validateSubscriptionAccess.mockResolvedValue(true);
      mockRecordingService.startRecording.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/recordings/start')
        .send({
          type: 'mobile',
          platform: 'ios',
          metadata: {}
        })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to start recording'
      });
    });
  });

  describe('POST /api/recordings/:sessionId/stop', () => {
    it('should stop a recording session successfully', async () => {
      const mockSession = {
        id: 'session_123',
        status: 'completed',
        endTime: new Date(),
        actions: [
          { type: 'click', selector: '#button', timestamp: Date.now() }
        ]
      };

      mockRecordingService.stopRecording.mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/recordings/session_123/stop')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSession
      });
      expect(mockRecordingService.stopRecording).toHaveBeenCalledWith('session_123');
    });

    it('should handle session not found', async () => {
      mockRecordingService.stopRecording.mockRejectedValue(new Error('Session not found'));

      const response = await request(app)
        .post('/api/recordings/session_123/stop')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Session not found'
      });
    });
  });

  describe('GET /api/recordings/:sessionId', () => {
    it('should retrieve a recording session', async () => {
      const mockSession = {
        id: 'session_123',
        type: 'mobile',
        platform: 'ios',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        actions: []
      };

      mockRecordingService.getSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/recordings/session_123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSession
      });
      expect(mockRecordingService.getSession).toHaveBeenCalledWith('session_123');
    });

    it('should return 404 for non-existent session', async () => {
      mockRecordingService.getSession.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/recordings/session_123')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Session not found'
      });
    });
  });

  describe('GET /api/recordings', () => {
    it('should list user recording sessions', async () => {
      const mockSessions = [
        {
          id: 'session_1',
          type: 'mobile',
          platform: 'ios',
          status: 'completed',
          startTime: new Date()
        },
        {
          id: 'session_2',
          type: 'web',
          platform: 'chrome',
          status: 'recording',
          startTime: new Date()
        }
      ];

      mockRecordingService.listSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/recordings')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSessions,
        pagination: {
          page: 1,
          limit: 10,
          total: 2
        }
      });
      expect(mockRecordingService.listSessions).toHaveBeenCalledWith('user_123', {
        page: 1,
        limit: 10
      });
    });

    it('should handle empty sessions list', async () => {
      mockRecordingService.listSessions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/recordings')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0
        }
      });
    });
  });

  describe('DELETE /api/recordings/:sessionId', () => {
    it('should delete a recording session', async () => {
      mockRecordingService.deleteSession.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/recordings/session_123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Session deleted successfully'
      });
      expect(mockRecordingService.deleteSession).toHaveBeenCalledWith('session_123');
    });

    it('should handle deletion errors', async () => {
      mockRecordingService.deleteSession.mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app)
        .delete('/api/recordings/session_123')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to delete session'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle authentication errors', async () => {
      // Override auth middleware to simulate error
      app.use('/api/recordings/error', (req, res, next) => {
        const error = new Error('Authentication failed');
        error.status = 401;
        next(error);
      });

      const response = await request(app)
        .get('/api/recordings/error')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication failed'
      });
    });

    it('should handle validation errors', async () => {
      // Override validation middleware to simulate error
      app.use('/api/recordings/validation-error', (req, res, next) => {
        const error = new Error('Validation failed');
        error.status = 400;
        next(error);
      });

      const response = await request(app)
        .post('/api/recordings/validation-error')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed'
      });
    });
  });
});


