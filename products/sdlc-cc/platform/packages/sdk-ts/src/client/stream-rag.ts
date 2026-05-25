// RAG streaming support for the Browser SDLC Client

import type { AuthClient } from '../auth';
import type { RAGQuery, RAGQueryUpdate, SDLCConfig, RequestConfig } from '../types';

export interface StreamCapable {
  config: SDLCConfig;
  stream<T>(config: RequestConfig): AsyncGenerator<T, void, unknown>;
}

/**
 * Stream a RAG query using EventSource (SSE) or fallback streaming.
 */
export async function* streamRAGQuery(
  auth: AuthClient,
  client: StreamCapable,
  query: RAGQuery
): AsyncGenerator<RAGQueryUpdate, void, unknown> {
  const token = await auth.ensureValidToken();
  if (!token) throw new Error('Authentication required');

  if (typeof EventSource !== 'undefined') {
    const eventSource = new EventSource(
      `${client.config.baseURL}/rag/query/stream?${new URLSearchParams({
        query: JSON.stringify(query),
        token: auth.getAccessToken() || ''
      })}`
    );

    try {
      while (true) {
        const event = await new Promise<RAGQueryUpdate>((resolve, reject) => {
          eventSource.onmessage = (e) => {
            try {
              resolve(JSON.parse(e.data));
            } catch (err) {
              reject(err);
            }
          };
          eventSource.onerror = () => reject(new Error('Stream error'));
        });
        yield event;
        if (event.status === 'completed' || event.status === 'failed') break;
      }
    } finally {
      eventSource.close();
    }
  } else {
    yield* client.stream<RAGQueryUpdate>({
      url: '/rag/query',
      method: 'POST',
      data: { ...query, streaming: true },
      headers: { 'Authorization': `Bearer ${auth.getAccessToken()}` }
    });
  }
}
