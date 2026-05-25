/**
 * Shared GET/HEAD handler for /api/recordings/:runId.
 * Streams from R2 with Range support so `<video>` can seek.
 * Auth is resolved by the caller (header or ?token=).
 */
import type { Context } from 'hono';

const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function r2KeyFor(runId: string): string {
  return `runs/${runId}/recording.webm`;
}

export function isValidRunId(runId: string): boolean {
  return RUN_ID_PATTERN.test(runId);
}

export async function serveRecording(
  c: Context<any>,
  method: 'GET' | 'HEAD',
): Promise<Response> {
  const runId = c.req.param('runId');
  if (!isValidRunId(runId)) {
    return c.json({ success: false, error: 'Invalid run id' }, 400);
  }

  const key = r2KeyFor(runId);
  const range = c.req.header('Range');
  const bucket = (c.env as { RECORDINGS: R2Bucket }).RECORDINGS;

  try {
    if (method === 'HEAD' || !range) {
      const obj = method === 'HEAD'
        ? await bucket.head(key)
        : await bucket.get(key);
      if (!obj) return c.json({ success: false, error: 'Not found' }, 404);
      const type = obj.httpMetadata?.contentType || 'video/webm';
      const headers = new Headers({
        'Content-Type': type,
        'Content-Length': String(obj.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=300',
      });
      if (method === 'HEAD') return new Response(null, { status: 200, headers });
      return new Response((obj as R2ObjectBody).body, { status: 200, headers });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return c.json({ success: false, error: 'Bad range' }, 416);
    const head = await bucket.head(key);
    if (!head) return c.json({ success: false, error: 'Not found' }, 404);
    const total = head.size;
    const start = match[1] ? Math.min(parseInt(match[1], 10), total - 1) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
    if (start > end) return c.json({ success: false, error: 'Bad range' }, 416);

    const obj = await bucket.get(key, {
      range: { offset: start, length: end - start + 1 },
    });
    if (!obj) return c.json({ success: false, error: 'Not found' }, 404);
    return new Response((obj as R2ObjectBody).body, {
      status: 206,
      headers: new Headers({
        'Content-Type': head.httpMetadata?.contentType || 'video/webm',
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
      }),
    });
  } catch (err) {
    console.error('[recordings] read failed:', err);
    return c.json({ success: false, error: 'Storage read failed' }, 500);
  }
}
