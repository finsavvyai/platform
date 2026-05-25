/**
 * Tests for SSE stream reader.
 * Validates connection, event parsing, error handling.
 */

import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/mocks/server';
import { executeAgentStream, type SSECallbacks } from '../sse';
import { mockExecuteParams } from '../../test-utils/mocks/fixtures';

const BASE_URL = 'https://api.lunaos.ai';

jest.mock('../../utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue('sse-test-token'),
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeCallbacks(): SSECallbacks & {
  tokens: string[];
  errors: string[];
  doneArgs: Array<{ executionId: string; durationMs: number }>;
  ragArgs: Array<{ sources: number; searchTimeMs: number }>;
} {
  const tokens: string[] = [];
  const errors: string[] = [];
  const doneArgs: Array<{ executionId: string; durationMs: number }> = [];
  const ragArgs: Array<{ sources: number; searchTimeMs: number }> = [];

  return {
    tokens,
    errors,
    doneArgs,
    ragArgs,
    onToken: (text) => tokens.push(text),
    onError: (err) => errors.push(err),
    onDone: (id, dur) => doneArgs.push({ executionId: id, durationMs: dur }),
    onRag: (sources, time) => ragArgs.push({ sources, searchTimeMs: time }),
  };
}

describe('executeAgentStream', () => {
  it('parses token events from SSE stream', async () => {
    const sseBody = 'event: token\ndata: Hello\n\nevent: token\ndata:  World\n\n'
      + 'event: done\ndata: {"executionId":"e1","duration":1500}\n\n';

    server.use(
      http.post(`${BASE_URL}/agents/execute`, () =>
        new HttpResponse(sseBody, {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const cb = makeCallbacks();
    await executeAgentStream(mockExecuteParams, cb);

    expect(cb.tokens).toEqual(['Hello', ' World']);
    expect(cb.doneArgs).toEqual([{ executionId: 'e1', durationMs: 1500 }]);
  });

  it('parses rag events', async () => {
    const sseBody = 'event: rag\ndata: {"sources":3,"searchTimeMs":120}\n\n'
      + 'event: done\ndata: {"executionId":"e2","duration":500}\n\n';

    server.use(
      http.post(`${BASE_URL}/agents/execute`, () =>
        new HttpResponse(sseBody, {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const cb = makeCallbacks();
    await executeAgentStream(mockExecuteParams, cb);

    expect(cb.ragArgs).toEqual([{ sources: 3, searchTimeMs: 120 }]);
  });

  it('calls onError for HTTP error response', async () => {
    server.use(
      http.post(`${BASE_URL}/agents/execute`, () =>
        new HttpResponse('Rate limited', { status: 429 }),
      ),
    );

    const cb = makeCallbacks();
    await executeAgentStream(mockExecuteParams, cb);

    expect(cb.errors).toHaveLength(1);
    expect(cb.errors[0]).toContain('429');
  });

  it('calls onError for SSE error events', async () => {
    const sseBody = 'event: error\ndata: {"error":"Agent not found"}\n\n';

    server.use(
      http.post(`${BASE_URL}/agents/execute`, () =>
        new HttpResponse(sseBody, {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const cb = makeCallbacks();
    await executeAgentStream(mockExecuteParams, cb);

    expect(cb.errors).toEqual(['Agent not found']);
  });

  it('treats bare data lines as token events', async () => {
    const sseBody = 'data: plain text\n\n';

    server.use(
      http.post(`${BASE_URL}/agents/execute`, () =>
        new HttpResponse(sseBody, {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const cb = makeCallbacks();
    await executeAgentStream(mockExecuteParams, cb);

    expect(cb.tokens).toEqual(['plain text']);
  });
});
