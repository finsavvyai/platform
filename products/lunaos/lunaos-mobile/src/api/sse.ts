/**
 * SSE stream reader for agent execution.
 * Parses multi-line server-sent events from /agents/execute.
 *
 * Hono streamSSE format:
 *   event: token\ndata: Hello\n\n
 *   event: done\ndata: {"executionId":"..."}\n\n
 */

import { apiStream } from './client';
import { logger } from '../utils/logger';
import type { ExecuteParams } from '../types/api';

export interface SSECallbacks {
  onToken: (text: string) => void;
  onRag?: (sources: number, searchTimeMs: number) => void;
  onDone: (executionId: string, durationMs: number) => void;
  onError: (error: string) => void;
}

export async function executeAgentStream(
  params: ExecuteParams,
  callbacks: SSECallbacks,
): Promise<void> {
  const response = await apiStream('/agents/execute', params);

  if (!response.ok) {
    const body = await response.text();
    callbacks.onError(`HTTP ${response.status}: ${body}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const block of events) {
        processSSEBlock(block.trim(), callbacks);
      }
    }

    if (buffer.trim()) {
      processSSEBlock(buffer.trim(), callbacks);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream error';
    logger.error('SSE', message);
    callbacks.onError(message);
  } finally {
    reader.releaseLock();
  }
}

function processSSEBlock(block: string, callbacks: SSECallbacks): void {
  if (!block) return;

  let eventType = '';
  let data = '';

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }
  }

  if (!data) return;

  if (eventType === 'token' || eventType === '') {
    callbacks.onToken(data);
    return;
  }

  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null) return;

    const obj = parsed as Record<string, unknown>;

    if (eventType === 'done') {
      callbacks.onDone(
        String(obj['executionId'] ?? ''),
        Number(obj['duration'] ?? 0),
      );
    } else if (eventType === 'rag' && callbacks.onRag) {
      callbacks.onRag(
        Number(obj['sources'] ?? 0),
        Number(obj['searchTimeMs'] ?? 0),
      );
    } else if (eventType === 'error') {
      callbacks.onError(String(obj['error'] ?? 'Unknown error'));
    }
  } catch {
    // Non-JSON data line, treat as token
    callbacks.onToken(data);
  }
}
