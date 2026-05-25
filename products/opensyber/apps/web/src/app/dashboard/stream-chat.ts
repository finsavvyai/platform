export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** True while tokens are still arriving; used to append deltas in-place. */
  streaming?: boolean;
}

/**
 * POST the conversation to the streaming SSE endpoint and invoke
 * `onDelta` for each text chunk as it arrives. Returns `true` on a
 * successful stream that produced at least one chunk, `false` if the
 * server rejected the stream (caller falls back to the non-stream
 * endpoint), and throws for network-level failures so callers can
 * render an error.
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
): Promise<boolean> {
  const res = await fetch('/api/proxy/ai/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) return false;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawAny = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload) as { delta?: string };
        if (parsed.delta) {
          onDelta(parsed.delta);
          sawAny = true;
        }
      } catch {
        // Skip malformed SSE frames rather than aborting the whole stream.
      }
    }
  }
  return sawAny;
}
