import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/demo-request';

describe('/api/demo-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-POST requests', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Method not allowed');
  });

  it('validates required fields', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: '', // Invalid - too short
        email: 'invalid-email', // Invalid format
        company: '', // Invalid - too short
        useCase: 'short', // Invalid - too short
        timeline: 'invalid-timeline', // Invalid option
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Validation error');
    expect(data.details).toBeDefined();
  });

  it('accepts valid demo request', async () => {
    const validRequest = {
      name: 'John Doe',
      email: 'john@company.com',
      company: 'Acme Corporation',
      useCase: 'We need secure AI data processing for our financial services application',
      timeline: '1-month',
      message: 'Looking forward to the demo',
    };

    const { req, res } = createMocks({
      method: 'POST',
      body: validRequest,
      headers: {
        'user-agent': 'test-agent',
      },
    });

    // Mock the connection remoteAddress
    req.connection = { remoteAddress: '127.0.0.1' };

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());

    expect(data.success).toBe(true);
    expect(data.message).toBe('Demo request received successfully');
    expect(data.data.id).toMatch(/^demo_\d+$/);
    expect(data.data.status).toBe('pending');
    expect(data.data.nextSteps).toBeDefined();
    expect(Array.isArray(data.data.nextSteps)).toBe(true);
  });

  it('handles optional message field', async () => {
    const validRequest = {
      name: 'Jane Smith',
      email: 'jane@company.com',
      company: 'Tech Corp',
      useCase: 'We need secure AI processing for healthcare data',
      timeline: '3-months',
      // message is optional and not provided
    };

    const { req, res } = createMocks({
      method: 'POST',
      body: validRequest,
    });

    req.connection = { remoteAddress: '127.0.0.1' };

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
  });

  it('validates timeline enum values', async () => {
    const validTimelines = ['immediate', '1-month', '3-months', '6-months', 'exploring'];

    for (const timeline of validTimelines) {
      const validRequest = {
        name: 'Test User',
        email: 'test@example.com',
        company: 'Test Corp',
        useCase: 'Valid use case description that meets minimum requirements',
        timeline: timeline,
      };

      const { req, res } = createMocks({
        method: 'POST',
        body: validRequest,
      });

      req.connection = { remoteAddress: '127.0.0.1' };

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    }
  });

  it('rejects invalid timeline values', async () => {
    const invalidRequest = {
      name: 'Test User',
      email: 'test@example.com',
      company: 'Test Corp',
      useCase: 'Valid use case description that meets minimum requirements',
      timeline: 'invalid-timeline-value',
    };

    const { req, res } = createMocks({
      method: 'POST',
      body: invalidRequest,
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Validation error');
  });

  it('validates minimum length requirements', async () => {
    const testCases = [
      { field: 'name', value: 'A', expectedError: true },
      { field: 'name', value: 'Valid Name', expectedError: false },
      { field: 'company', value: 'B', expectedError: true },
      { field: 'company', value: 'Valid Company', expectedError: false },
      { field: 'useCase', value: 'Short', expectedError: true },
      { field: 'useCase', value: 'Valid use case description that meets requirements', expectedError: false },
    ];

    for (const testCase of testCases) {
      const requestBody = {
        name: 'Valid Name',
        email: 'test@example.com',
        company: 'Valid Company',
        useCase: 'Valid use case description that meets requirements',
        timeline: '1-month',
        [testCase.field]: testCase.value,
      };

      const { req, res } = createMocks({
        method: 'POST',
        body: requestBody,
      });

      await handler(req, res);

      if (testCase.expectedError) {
        expect(res._getStatusCode()).toBe(400);
      } else {
        expect(res._getStatusCode()).toBe(200);
      }
    }
  });

  it('handles server errors gracefully', async () => {
    // Mock a server error by making the handler throw an exception
    const originalHandler = handler;
    const errorHandler = async (req: any, res: any) => {
      throw new Error('Database connection failed');
    };

    const validRequest = {
      name: 'Test User',
      email: 'test@example.com',
      company: 'Test Corp',
      useCase: 'Valid use case description that meets requirements',
      timeline: '1-month',
    };

    const { req, res } = createMocks({
      method: 'POST',
      body: validRequest,
    });

    await errorHandler(req, res);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Internal server error');
    expect(data.message).toBe('Failed to process demo request');
  });

  it('logs request data for debugging', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const validRequest = {
      name: 'Test User',
      email: 'test@example.com',
      company: 'Test Corp',
      useCase: 'Valid use case description',
      timeline: '1-month',
    };

    const { req, res } = createMocks({
      method: 'POST',
      body: validRequest,
      headers: {
        'user-agent': 'test-browser',
      },
    });

    req.connection = { remoteAddress: '192.168.1.1' };

    await handler(req, res);

    expect(consoleSpy).toHaveBeenCalledWith('Demo request received:', expect.objectContaining({
      name: 'Test User',
      email: 'test@example.com',
      company: 'Test Corp',
      useCase: 'Valid use case description',
      timeline: '1-month',
      userAgent: 'test-browser',
      ip: '192.168.1.1',
      timestamp: expect.any(String),
    }));

    consoleSpy.mockRestore();
  });
});