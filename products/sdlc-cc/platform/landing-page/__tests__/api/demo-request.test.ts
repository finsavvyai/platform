import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../pages/api/demo-request';

type DemoRequestSuccessPayload = {
  success: true;
  message: string;
  data: {
    id: string;
    status: string;
    nextSteps: string[];
    confirmationEmail: string;
  };
};

type DemoRequestErrorPayload = {
  error: string;
  message?: string;
};

const toPostRequest = (body: object, url = 'https://sdlc.cc/api/demo-request') =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const toGetRequest = (url = 'https://sdlc.cc/api/demo-request') =>
  new Request(url, { method: 'GET' });

describe('/api/demo-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.DEMO_REQUEST_WEBHOOK_URL = 'https://hooks.example.com/demo';
    delete process.env.DEMO_REQUEST_WEBHOOK_TOKEN;
  });

  it('rejects non-POST requests', async () => {
    const res = await handler(toGetRequest() as any);
    expect(res.status).toBe(405);
    const data = await res.json() as DemoRequestErrorPayload;
    expect(data.error).toBe('Method not allowed');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await handler(toPostRequest({}) as any);
    expect(res.status).toBe(400);
    const data = await res.json() as DemoRequestErrorPayload;
    expect(data.error).toBe('Missing required fields: name, email, company');
  });

  it('returns 400 when name is missing', async () => {
    const res = await handler(
      toPostRequest({ email: 'a@b.com', company: 'Co' }) as any
    );
    expect(res.status).toBe(400);
    const data = await res.json() as DemoRequestErrorPayload;
    expect(data.error).toContain('Missing required fields');
  });

  it('accepts valid demo request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 202 })
    );
    const body = {
      name: 'John Doe',
      email: 'john@company.com',
      company: 'Acme Corporation',
      useCase: 'We need secure AI data processing',
      timeline: '1-month',
      message: 'Looking forward to the demo',
    };
    const res = await handler(toPostRequest(body) as any);
    expect(res.status).toBe(200);
    const data = await res.json() as DemoRequestSuccessPayload;
    expect(data.success).toBe(true);
    expect(data.message).toBe('Demo request received successfully');
    expect(data.data.id).toMatch(/^demo_\d+$/);
    expect(data.data.status).toBe('submitted');
    expect(Array.isArray(data.data.nextSteps)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.example.com/demo',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('handles optional message field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 202 })
    );
    const body = {
      name: 'Jane Smith',
      email: 'jane@company.com',
      company: 'Tech Corp',
      useCase: 'We need secure AI processing for healthcare data',
      timeline: '3-months',
    };
    const res = await handler(toPostRequest(body) as any);
    expect(res.status).toBe(200);
    const data = await res.json() as DemoRequestSuccessPayload;
    expect(data.success).toBe(true);
  });

  it('accepts valid timeline values', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const timelines = ['immediate', '1-month', '3-months', '6-months', 'exploring'];
    for (const timeline of timelines) {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 202 }));
      const res = await handler(
        toPostRequest({
          name: 'Test User',
          email: 'test@example.com',
          company: 'Test Corp',
          useCase: 'Valid use case description',
          timeline,
        }) as any
      );
      expect(res.status).toBe(200);
    }
  });

  it('returns 503 when demo intake is not configured', async () => {
    delete process.env.DEMO_REQUEST_WEBHOOK_URL;

    const res = await handler(
      toPostRequest({
        name: 'Config Missing',
        email: 'ops@example.com',
        company: 'Acme',
      }) as any
    );

    expect(res.status).toBe(503);
    const data = await res.json() as DemoRequestErrorPayload;
    expect(data.error).toBe('Demo intake unavailable');
  });

  it('returns 502 when upstream intake delivery fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('bad gateway', { status: 502 })
    );

    const res = await handler(
      toPostRequest({
        name: 'Delivery Failure',
        email: 'ops@example.com',
        company: 'Acme',
      }) as any
    );

    expect(res.status).toBe(502);
    const data = await res.json() as DemoRequestErrorPayload;
    expect(data.error).toBe('Demo intake delivery failed');
  });

  it('returns 500 when body is invalid JSON', async () => {
    const req = new Request('https://sdlc.cc/api/demo-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await handler(req as any);
    expect(res.status).toBe(500);
    const data = await res.json() as DemoRequestErrorPayload;
    expect(data.error).toBe('Internal server error');
  });

  it('logs request data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 202 })
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const body = {
      name: 'Test User',
      email: 'test@example.com',
      company: 'Test Corp',
      useCase: 'Valid use case description',
      timeline: '1-month',
    };
    await handler(toPostRequest(body) as any);
    expect(logSpy).toHaveBeenCalledWith(
      'Demo request received:',
      expect.objectContaining({
        name: 'Test User',
        email: 'test@example.com',
        company: 'Test Corp',
        useCase: 'Valid use case description',
        timeline: '1-month',
      })
    );
    logSpy.mockRestore();
  });
});
