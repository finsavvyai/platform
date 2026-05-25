/**
 * Tests for the workflow runner — API call and SSE processing.
 */

import { jest } from '@jest/globals';
import { executeWorkflow, getExecutionStatus } from '../lib/workflow-runner';
import type { PipelineJSON } from '../types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockPipeline(): PipelineJSON {
  return {
    version: '1.0.0',
    name: 'Test Pipeline',
    description: '',
    nodes: [{
      id: 'n1', type: 'workflow-node',
      position: { x: 0, y: 0 },
      data: {
        typeId: 'chat-agent', label: 'Test', category: 'agent',
        icon: '', color: '#007AFF', config: {},
        inputs: [], outputs: [],
      },
    }],
    edges: [],
    metadata: { created: '', modified: '', author: '' },
  };
}

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = events.map((e) => `data: ${e}\n\n`).join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('workflow-runner', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  test('executeWorkflow sends correct POST request', async () => {
    const stream = createSSEStream(['[DONE]']);
    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const pipeline = mockPipeline();
    await executeWorkflow(pipeline);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lunaos.ai/chains/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  test('executeWorkflow throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Bad'),
    });

    const pipeline = mockPipeline();
    await expect(executeWorkflow(pipeline)).rejects.toThrow('Execution failed');
  });

  test('executeWorkflow processes SSE node events', async () => {
    const events = [
      JSON.stringify({ event: 'chain_start', executionId: 'exec-1' }),
      JSON.stringify({ event: 'node_start', nodeId: 'n1' }),
      JSON.stringify({ event: 'node_complete', nodeId: 'n1', output: { text: 'done' }, duration: 120 }),
      '[DONE]',
    ];
    const stream = createSSEStream(events);
    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const onNodeStart = jest.fn();
    const onNodeComplete = jest.fn();
    const result = await executeWorkflow(mockPipeline(), {
      onNodeStart,
      onNodeComplete,
    });

    expect(onNodeStart).toHaveBeenCalledWith('n1');
    expect(onNodeComplete).toHaveBeenCalledWith('n1', { text: 'done' });
    expect(result.executionId).toBe('exec-1');
    expect(result.status).toBe('completed');
  });

  test('executeWorkflow includes auth token when set', async () => {
    localStorage.setItem('lunaos_token', 'test-token-123');
    const stream = createSSEStream(['[DONE]']);
    mockFetch.mockResolvedValue({ ok: true, body: stream });

    await executeWorkflow(mockPipeline());

    const callHeaders = mockFetch.mock.calls[0]?.[1]?.headers;
    expect(callHeaders?.Authorization).toBe('Bearer test-token-123');
  });

  test('getExecutionStatus fetches status by id', async () => {
    const mockResult = {
      executionId: 'exec-1', status: 'completed',
      nodeResults: {}, startedAt: '', completedAt: '',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await getExecutionStatus('exec-1');
    expect(result.executionId).toBe('exec-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lunaos.ai/chains/exec-1/status',
      expect.anything()
    );
  });
});
