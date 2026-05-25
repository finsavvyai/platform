/**
 * Test-run recordings — MVP video capture + playback.
 *
 * Routes:
 *   POST /api/recordings/:runId/upload
 *       Auth: Bearer JWT (Authorization header)
 *       Body: raw bytes OR multipart/form-data (first "file" part)
 *       Effect: writes bytes to R2 at `runs/{runId}/recording.webm`
 *               and upserts a `test_run_recordings` row.
 *
 *   GET /api/recordings/:runId
 *       Auth: Bearer JWT in Authorization header OR `?token=` query
 *             (the query form exists because HTMLVideoElement cannot
 *              send custom headers — MVP; upgrade to signed R2 URLs later).
 *       Behaviour: streams bytes with Content-Type + Content-Length
 *                  + Accept-Ranges: bytes. Honours Range: requests so
 *                  `<video>` can seek. See ./recordings.serve.ts.
 *
 *   HEAD /api/recordings/:runId
 *       Same auth. Headers only — used by <video> to probe size.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { verifyJWT } from '../auth/jwt';
import { isValidRunId, r2KeyFor, serveRecording } from './recordings.serve';

type Env = {
  Bindings: {
    DB: D1Database;
    RECORDINGS: R2Bucket;
    ENVIRONMENT: string;
    JWT_SECRET: string;
  };
  Variables: { userId: string };
};

const recordingsRoute = new Hono<Env>();
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024; // 512MB MVP cap

async function authedUser(c: Context<Env>): Promise<string | null> {
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = await verifyJWT(header.slice(7), c.env.JWT_SECRET);
      return (payload.userId as string) ?? null;
    } catch { /* fall through to query */ }
  }
  const token = c.req.query('token');
  if (!token) return null;
  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

// POST /:runId/upload — accepts raw body or multipart.
recordingsRoute.post('/:runId/upload', async (c) => {
  const userId = await authedUser(c);
  if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const runId = c.req.param('runId');
  if (!isValidRunId(runId)) {
    return c.json({ success: false, error: 'Invalid run id' }, 400);
  }

  const ctype = c.req.header('Content-Type') || '';
  let bytes: ArrayBuffer;
  let contentType = 'video/webm';
  try {
    if (ctype.startsWith('multipart/form-data')) {
      const form = await c.req.formData();
      const file = form.get('file');
      if (!(file instanceof Blob)) {
        return c.json({ success: false, error: 'Missing "file" part' }, 400);
      }
      bytes = await file.arrayBuffer();
      if (file.type) contentType = file.type;
    } else {
      bytes = await c.req.arrayBuffer();
      if (ctype) contentType = ctype;
    }
  } catch {
    return c.json({ success: false, error: 'Could not parse body' }, 400);
  }

  if (bytes.byteLength === 0) {
    return c.json({ success: false, error: 'Empty upload' }, 400);
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ success: false, error: 'Upload too large' }, 413);
  }

  const key = r2KeyFor(runId);
  try {
    await c.env.RECORDINGS.put(key, bytes, { httpMetadata: { contentType } });
  } catch (err) {
    console.error('[recordings] R2 put failed:', err);
    return c.json({ success: false, error: 'Storage write failed' }, 500);
  }

  const db = drizzle(c.env.DB);
  try {
    await db.delete(schema.testRunRecordings)
      .where(eq(schema.testRunRecordings.runId, runId));
    await db.insert(schema.testRunRecordings).values({
      runId,
      r2Key: key,
      sizeBytes: bytes.byteLength,
      durationMs: 0,
      contentType,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[recordings] metadata persist failed:', err);
    // Non-fatal: playback reads R2 directly by key.
  }

  return c.json({
    success: true,
    data: {
      runId,
      sizeBytes: bytes.byteLength,
      contentType,
      url: `/api/recordings/${runId}`,
    },
  }, 201);
});

async function gate(c: Context<Env>, method: 'GET' | 'HEAD') {
  const userId = await authedUser(c);
  if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401);
  return serveRecording(c, method);
}

recordingsRoute.get('/:runId', (c) => gate(c, 'GET'));
recordingsRoute.on('HEAD', '/:runId', (c) => gate(c, 'HEAD'));

export default recordingsRoute;
