export interface MinimalHeaders {
  get(name: string): string | null;
}

export interface MinimalRequest {
  readonly raw?: Request;
  header(name: string): string | undefined;
  url?: string;
}

export interface MinimalContext {
  req: MinimalRequest;
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  json<T>(value: T, status?: number): Response;
  status?(code: number): void;
}

export type MiddlewareNext = () => Promise<void>;

export type MiddlewareHandler<C extends MinimalContext = MinimalContext> = (
  ctx: C,
  next: MiddlewareNext,
) => Promise<Response | void>;

export const extractBearer = (header: string | undefined): string | undefined => {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return undefined;
  const token = trimmed.slice(7).trim();
  // Reject empty/whitespace-only tokens and tokens with internal whitespace —
  // a well-formed bearer token is a single opaque string. The empty-length
  // arm is provably unreachable today (the outer `trim()` guarantees a
  // non-whitespace tail), but is retained as defence-in-depth against future
  // refactors that drop the outer trim.
  /* v8 ignore next */
  if (token.length === 0) return undefined;
  if (/\s/.test(token)) return undefined;
  return token;
};
