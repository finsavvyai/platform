/**
 * Kasm Workspaces Developer API client.
 *
 * Real endpoints (https://kasmweb.com/docs/latest/developers/developer_api.html):
 *   POST {base}/api/public/request_kasm     — start a new Kasm session
 *   POST {base}/api/public/get_kasm_status  — poll an existing session
 *   POST {base}/api/public/destroy_kasm     — terminate a session
 *   POST {base}/api/public/get_kasms        — list active sessions for the API key
 *
 * Auth: every request body MUST include `{api_key, api_key_secret, ...}` per
 * Kasm spec. There is no header-based auth on the public API.
 *
 * Without real Kasm credentials the constructor still succeeds (so DI/tests
 * can run), but every network call FAILS LOUDLY with KasmApiError as soon as
 * the server returns 4xx or the fetch rejects. There are no silent stubs.
 */

import { z } from 'zod';

const TimeoutDefault = 15_000;

export interface KasmCredentials {
  /** Base URL of the Kasm deployment, e.g. `https://kasm.example.com`. */
  apiUrl: string;
  /** Developer API key id (rotated via Kasm admin UI). */
  apiKey: string;
  /** Developer API key secret. */
  apiKeySecret: string;
}

export interface KasmRequestKasmInput {
  /** Kasm internal user id (usually the workspace user UUID). */
  userId: string;
  /** Kasm image id to launch. */
  imageId: string;
  /** Optional client-supplied session label (passes through to Kasm). */
  clientLabel?: string;
  /** Optional URL to auto-load inside the rendered browser. */
  goUrl?: string;
}

export class KasmApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body: string,
  ) {
    super(`Kasm ${endpoint} returned ${status}: ${body.slice(0, 256)}`);
    this.name = 'KasmApiError';
  }
}

export class KasmTimeoutError extends Error {
  constructor(public readonly endpoint: string, public readonly ms: number) {
    super(`Kasm ${endpoint} timed out after ${ms}ms`);
    this.name = 'KasmTimeoutError';
  }
}

const RequestKasmResponseSchema = z.object({
  kasm_id: z.string(),
  session_token: z.string().optional(),
  username: z.string().optional(),
  status: z.string().optional(),
  kasm_url: z.string().optional(),
});

const KasmRecordSchema = z.object({
  kasm_id: z.string(),
  user_id: z.string().optional(),
  image_id: z.string().optional(),
  operational_status: z.string().optional(),
  start_date: z.string().optional(),
});

const StatusResponseSchema = z.object({
  kasm: KasmRecordSchema.optional(),
  operational_status: z.string().optional(),
  current_time: z.string().optional(),
});

const DestroyResponseSchema = z.object({
  // Kasm returns an empty object on success; an error_message on failure.
  error_message: z.string().optional(),
});

const ListResponseSchema = z.object({
  kasms: z.array(KasmRecordSchema),
});

export type KasmRequestKasmResponse = z.infer<typeof RequestKasmResponseSchema>;
export type KasmStatusResponse = z.infer<typeof StatusResponseSchema>;
export type KasmDestroyResponse = z.infer<typeof DestroyResponseSchema>;
export type KasmListResponse = z.infer<typeof ListResponseSchema>;
export type KasmRecord = z.infer<typeof KasmRecordSchema>;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class KasmClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    private readonly creds: KasmCredentials,
    opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
  ) {
    if (!creds.apiUrl) throw new Error('KasmClient: apiUrl required');
    if (!creds.apiKey) throw new Error('KasmClient: apiKey required');
    if (!creds.apiKeySecret) throw new Error('KasmClient: apiKeySecret required');
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.timeoutMs = opts.timeoutMs ?? TimeoutDefault;
  }

  private async post<T>(path: string, body: Record<string, unknown>, schema: z.ZodSchema<T>): Promise<T> {
    const url = `${this.creds.apiUrl.replace(/\/$/, '')}${path}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: this.creds.apiKey,
          api_key_secret: this.creds.apiKeySecret,
          ...body,
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new KasmTimeoutError(path, this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new KasmApiError(resp.status, path, txt);
    }
    const json = (await resp.json()) as unknown;
    return schema.parse(json);
  }

  async requestKasm(input: KasmRequestKasmInput): Promise<KasmRequestKasmResponse> {
    return this.post(
      '/api/public/request_kasm',
      {
        user_id: input.userId,
        image_id: input.imageId,
        ...(input.clientLabel ? { client_language: input.clientLabel } : {}),
        ...(input.goUrl ? { kasm_url: input.goUrl } : {}),
      },
      RequestKasmResponseSchema,
    );
  }

  async getKasmStatus(kasmId: string, userId: string): Promise<KasmStatusResponse> {
    return this.post(
      '/api/public/get_kasm_status',
      { kasm_id: kasmId, user_id: userId },
      StatusResponseSchema,
    );
  }

  async destroyKasm(kasmId: string, userId: string): Promise<KasmDestroyResponse> {
    return this.post(
      '/api/public/destroy_kasm',
      { kasm_id: kasmId, user_id: userId },
      DestroyResponseSchema,
    );
  }

  async listKasms(): Promise<KasmListResponse> {
    return this.post('/api/public/get_kasms', {}, ListResponseSchema);
  }
}
