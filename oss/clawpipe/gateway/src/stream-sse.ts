/** SSE wrapper — adds id: counters, heartbeats, and Last-Event-ID resume.
 *
 * Upstream provider streams arrive as raw SSE (OpenAI/Anthropic/Groq/etc).
 * We re-emit them with our own `id:` counter so clients can reconnect with
 * `Last-Event-ID: <n>` and skip past chunks they already have. Heartbeats
 * (`:hb\n\n`) keep idle connections alive through proxies.
 */

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

export const HEARTBEAT_MS = 15_000;
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/** Parse Last-Event-ID header to a non-negative integer. Returns -1 on absent
 *  or malformed input so the caller can treat any event id as "after". */
export function parseLastEventId(header: string | null): number {
  if (!header) return -1;
  const n = Number.parseInt(header, 10);
  return Number.isFinite(n) && n >= 0 ? n : -1;
}

/** Split an SSE buffer into complete events. Returns [events, leftover]. */
export function splitEvents(buffer: string): { events: string[]; leftover: string } {
  const parts = buffer.split('\n\n');
  const leftover = parts.pop() ?? '';
  return { events: parts.filter((p) => p.length > 0), leftover };
}

/** Wrap an upstream stream with id: counter + heartbeats + Last-Event-ID skip. */
export function wrapStream(
  upstream: ReadableStream<Uint8Array>,
  startAfterId: number = -1,
): ReadableStream<Uint8Array> {
  let nextId = 0;
  let lastActivity = Date.now();
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      heartbeat = setInterval(() => {
        if (Date.now() - lastActivity >= HEARTBEAT_MS) {
          controller.enqueue(TEXT_ENCODER.encode(':hb\n\n'));
          lastActivity = Date.now();
        }
      }, HEARTBEAT_MS);

      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += TEXT_DECODER.decode(value, { stream: true });
          const { events, leftover } = splitEvents(buf);
          buf = leftover;
          for (const evt of events) {
            const id = nextId++;
            if (id <= startAfterId) continue;
            const enriched = `id: ${id}\n${evt}\n\n`;
            controller.enqueue(TEXT_ENCODER.encode(enriched));
            lastActivity = Date.now();
          }
        }
        if (buf.trim().length > 0) {
          const id = nextId++;
          if (id > startAfterId) {
            controller.enqueue(TEXT_ENCODER.encode(`id: ${id}\n${buf}\n\n`));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        if (heartbeat) clearInterval(heartbeat);
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    },
  });
}
