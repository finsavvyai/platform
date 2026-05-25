/**
 * Tests for the agents API module.
 * Validates list, executions endpoints.
 */

import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/mocks/server';
import { listAgents, listExecutions } from '../agents';
import { mockAgentListResponse, mockExecutionsResponse } from '../../test-utils/mocks/fixtures';

const BASE_URL = 'https://api.lunaos.ai';

jest.mock('../../utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue('test-token'),
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('listAgents', () => {
  it('fetches agent list from /agents/list', async () => {
    server.use(
      http.get(`${BASE_URL}/agents/list`, () =>
        HttpResponse.json(mockAgentListResponse),
      ),
    );

    const result = await listAgents();
    expect(result.agents).toHaveLength(mockAgentListResponse.agents.length);
    expect(result.total).toBe(mockAgentListResponse.total);
  });

  it('does not require auth (skipAuth: true)', async () => {
    let capturedAuth: string | null = null;

    server.use(
      http.get(`${BASE_URL}/agents/list`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json(mockAgentListResponse);
      }),
    );

    await listAgents();
    // skipAuth means no token lookup, so no header set
    expect(capturedAuth).toBeNull();
  });

  it('throws on server error', async () => {
    server.use(
      http.get(`${BASE_URL}/agents/list`, () =>
        HttpResponse.json({ error: 'Internal error' }, { status: 500 }),
      ),
    );

    await expect(listAgents()).rejects.toThrow('Internal error');
  });
});

describe('listExecutions', () => {
  it('fetches executions with default limit and offset', async () => {
    let capturedUrl = '';

    server.use(
      http.get(`${BASE_URL}/agents/executions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockExecutionsResponse);
      }),
    );

    const result = await listExecutions();
    expect(result.executions).toHaveLength(mockExecutionsResponse.executions.length);
    expect(capturedUrl).toContain('limit=20');
    expect(capturedUrl).toContain('offset=0');
  });

  it('passes custom limit and offset', async () => {
    let capturedUrl = '';

    server.use(
      http.get(`${BASE_URL}/agents/executions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ executions: [], count: 0 });
      }),
    );

    await listExecutions(10, 5);
    expect(capturedUrl).toContain('limit=10');
    expect(capturedUrl).toContain('offset=5');
  });
});
