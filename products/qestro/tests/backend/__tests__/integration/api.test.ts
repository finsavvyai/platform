import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createServer } from '../../index.js';

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
  getSubscription: jest.fn(),
  createSubscription: jest.fn(),
};

const mockAIService = {
  generateTestCode: jest.fn(),
  analyzeCode: jest.fn(),
};

jest.mock('../../services/RecordingService.js', () => ({
  RecordingService: jest.fn(() => mockRecordingService),
}));

jest.mock('../../services/SubscriptionService.js', () => ({
  SubscriptionService: jest.fn(() => mockSubscriptionService),
}));

jest.mock('../../services/AIService.js', () => ({
  AIService: jest.fn(() => mockAIService),
}));

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = await createServer();
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/recordings')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should accept valid JWT tokens', async () => {
      const validToken = 'valid.jwt.token';
      mockSubscriptionService.validateSubscriptionAccess.mockResolvedValue(true);
      mockRecordingService.listSessions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/recordings')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid JWT tokens', async () => {
      const invalidToken = 'invalid.token';

      const response = await request(app)
        .get('/api/recordings')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token'
      });
    });
  });

  describe('Recording API', () => {
    describe('POST /api/recordings/start', () => {
      it('should start a recording session', async () => {
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
          .set('Authorization', 'Bearer valid.token')
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

      it('should validate request body', async () => {
        const response = await request(app)
          .post('/api/recordings/start')
          .set('Authorization', 'Bearer valid.token')
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

      it('should check subscription access', async () => {
        mockSubscriptionService.validateSubscriptionAccess.mockResolvedValue(false);

        const response = await request(app)
          .post('/api/recordings/start')
          .set('Authorization', 'Bearer valid.token')
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
    });

    describe('POST /api/recordings/:sessionId/stop', () => {
      it('should stop a recording session', async () => {
        const mockSession = {
          id: 'session_123',
          status: 'completed',
          endTime: new Date(),
          actions: []
        };

        mockRecordingService.stopRecording.mockResolvedValue(mockSession);

        const response = await request(app)
          .post('/api/recordings/session_123/stop')
          .set('Authorization', 'Bearer valid.token')
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
          .set('Authorization', 'Bearer valid.token')
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
          .set('Authorization', 'Bearer valid.token')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockSession
        });
      });

      it('should return 404 for non-existent session', async () => {
        mockRecordingService.getSession.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/recordings/session_123')
          .set('Authorization', 'Bearer valid.token')
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
          .get('/api/recordings?page=1&limit=10')
          .set('Authorization', 'Bearer valid.token')
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
      });

      it('should handle pagination parameters', async () => {
        mockRecordingService.listSessions.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/recordings?page=2&limit=5')
          .set('Authorization', 'Bearer valid.token')
          .expect(200);

        expect(mockRecordingService.listSessions).toHaveBeenCalledWith(
          expect.any(String),
          { page: 2, limit: 5 }
        );
      });
    });
  });

  describe('Subscription API', () => {
    describe('POST /api/subscriptions/create', () => {
      it('should create a new subscription', async () => {
        const mockSubscription = {
          id: 'sub_123',
          status: 'active',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123'
        };

        mockSubscriptionService.createSubscription.mockResolvedValue(mockSubscription);

        const response = await request(app)
          .post('/api/subscriptions/create')
          .set('Authorization', 'Bearer valid.token')
          .send({
            planId: 'pro',
            paymentMethodId: 'pm_123'
          })
          .expect(201);

        expect(response.body).toEqual({
          success: true,
          data: mockSubscription
        });
      });

      it('should handle subscription creation errors', async () => {
        mockSubscriptionService.createSubscription.mockRejectedValue(new Error('Payment failed'));

        const response = await request(app)
          .post('/api/subscriptions/create')
          .set('Authorization', 'Bearer valid.token')
          .send({
            planId: 'pro',
            paymentMethodId: 'pm_123'
          })
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          error: 'Failed to create subscription'
        });
      });
    });

    describe('GET /api/subscriptions/plans', () => {
      it('should return available subscription plans', async () => {
        const mockPlans = [
          { id: 'free', name: 'Free', price: 0, features: ['Feature 1'] },
          { id: 'pro', name: 'Pro', price: 29, features: ['Feature 1', 'Feature 2'] }
        ];

        mockSubscriptionService.getSubscriptionPlans.mockResolvedValue(mockPlans);

        const response = await request(app)
          .get('/api/subscriptions/plans')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockPlans
        });
      });
    });
  });

  describe('AI API', () => {
    describe('POST /api/ai/generate-test', () => {
      it('should generate test code', async () => {
        const mockTestCode = `
          describe('Test Scenario', () => {
            it('should work', () => {
              expect(true).toBe(true);
            });
          });
        `;

        mockAIService.generateTestCode.mockResolvedValue(mockTestCode);

        const response = await request(app)
          .post('/api/ai/generate-test')
          .set('Authorization', 'Bearer valid.token')
          .send({
            description: 'Test user login flow',
            platform: 'web',
            framework: 'jest',
            language: 'typescript'
          })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: { code: mockTestCode }
        });
      });

      it('should handle AI service errors', async () => {
        mockAIService.generateTestCode.mockRejectedValue(new Error('AI service unavailable'));

        const response = await request(app)
          .post('/api/ai/generate-test')
          .set('Authorization', 'Bearer valid.token')
          .send({
            description: 'Test scenario',
            platform: 'web',
            framework: 'jest',
            language: 'typescript'
          })
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          error: 'Failed to generate test code'
        });
      });
    });

    describe('POST /api/ai/analyze-code', () => {
      it('should analyze code and provide insights', async () => {
        const mockAnalysis = {
          complexity: 'medium',
          issues: ['Missing error handling'],
          suggestions: ['Add try-catch blocks']
        };

        mockAIService.analyzeCode.mockResolvedValue(mockAnalysis);

        const response = await request(app)
          .post('/api/ai/analyze-code')
          .set('Authorization', 'Bearer valid.token')
          .send({
            code: 'function test() { return true; }',
            language: 'typescript'
          })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockAnalysis
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Endpoint not found'
      });
    });

    it('should handle 500 errors', async () => {
      // Mock a service to throw an error
      mockRecordingService.listSessions.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/recordings')
        .set('Authorization', 'Bearer valid.token')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', 'Bearer valid.token')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: expect.stringContaining('validation')
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests per minute', async () => {
      // Make multiple requests quickly
      const requests = Array(100).fill(null).map(() =>
        request(app)
          .get('/api/recordings')
          .set('Authorization', 'Bearer valid.token')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/api/recordings')
        .set('Origin', 'https://questro.com')
        .expect(401); // 401 because no auth, but CORS should be handled

      expect(response.headers['access-control-allow-origin']).toBe('https://questro.com');
    });

    it('should reject requests from disallowed origins', async () => {
      const response = await request(app)
        .get('/api/recordings')
        .set('Origin', 'https://malicious-site.com')
        .expect(401);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});

