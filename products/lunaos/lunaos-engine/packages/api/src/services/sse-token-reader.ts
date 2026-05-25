/**
 * SSE Token Reader — reads LLM streaming response and emits tokens via SSE.
 */

import { parseSSEToken } from './llm-caller';

interface SSEStream {
  writeSSE(data: { event: string; data: string }): Promise<void>;
}

/**
 * Read an LLM streaming response body, parse SSE tokens,
 * and forward them to the client stream.
 * Returns the concatenated full output string.
 */
export async function readAndStreamTokens(
  response: Response,
  provider: string,
  stream: SSEStream,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let fullOutput = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ') || line.slice(6).trim() === '[DONE]') continue;
      const token = parseSSEToken(line.slice(6).trim(), provider);
      if (token) {
        fullOutput += token;
        await stream.writeSSE({ event: 'token', data: token });
      }
    }
  }

  return fullOutput;
}
