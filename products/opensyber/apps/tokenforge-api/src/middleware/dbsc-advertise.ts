/**
 * DBSC advertisement middleware (Sprint 37, Task 3).
 *
 * The W3C Device-Bound Session Credentials draft says a server signals
 * its DBSC support by attaching a `Sec-Session-Registration` header on
 * responses where the client is not yet bound. Browsers that implement
 * DBSC (Chrome 146+) read the header, fetch a challenge, sign with a
 * platform-bound key, and POST the result to the advertised path —
 * binding the session to the device automatically.
 *
 * The middleware here is intentionally cheap: it does not call the
 * challenge store. It just tells the client where to ask for a
 * challenge — `/v1/dbsc/challenge` by default. The actual challenge
 * issuer remains POST /v1/dbsc/challenge, which already returns the
 * fully-formed `Sec-Session-Registration: (alg);path=...;challenge=...`
 * header for the bind step.
 *
 * Spec: https://w3c.github.io/webappsec-dbsc/#sec-session-registration
 */

import type { MiddlewareHandler } from 'hono';

/** Cookie name set by the DBSC register endpoint when binding succeeds. */
const DEFAULT_COOKIE_NAME = '__Secure-tf-bound';

/** Path to fetch a fresh challenge from. */
const DEFAULT_CHALLENGE_PATH = '/v1/dbsc/challenge';

/** Algorithms supported by the TokenForge bind ceremony. */
const DEFAULT_ALGS: readonly string[] = ['ES256'];

export interface DbscAdvertiseOptions {
  /** Cookie name to inspect on the request (default `__Secure-tf-bound`). */
  cookieName?: string;
  /** Path to advertise for fresh challenges (default `/v1/dbsc/challenge`). */
  challengePath?: string;
  /** Allowed signing algorithms (default `['ES256']`). */
  algorithms?: readonly string[];
  /**
   * Optional path filter — only advertise on responses whose request
   * path matches at least one entry. Glob-prefix style: trailing `*`
   * matches the prefix. Empty means advertise on every response.
   */
  paths?: readonly string[];
}

/**
 * Build the static header value `(ES256);path="/v1/dbsc/challenge"` per
 * the DBSC `Sec-Session-Registration` syntax. Multiple algs are emitted
 * as a list `(ES256 RS256);…`.
 */
export function buildAdvertisementHeader(
  algorithms: readonly string[] = DEFAULT_ALGS,
  challengePath: string = DEFAULT_CHALLENGE_PATH,
): string {
  const list = algorithms.length === 0 ? 'ES256' : algorithms.join(' ');
  return `(${list});path="${challengePath}"`;
}

function hasBoundCookie(cookieHeader: string | undefined, cookieName: string): boolean {
  if (!cookieHeader) return false;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (name === cookieName) return true;
  }
  return false;
}

function pathMatches(reqPath: string, patterns: readonly string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  for (const p of patterns) {
    if (p.endsWith('*')) {
      if (reqPath.startsWith(p.slice(0, -1))) return true;
    } else if (reqPath === p) return true;
  }
  return false;
}

/**
 * Hono middleware. Adds `Sec-Session-Registration` on responses to
 * unbound clients. Idempotent: if downstream already set the header,
 * the existing value wins.
 */
export function dbscAdvertise(
  options: DbscAdvertiseOptions = {},
): MiddlewareHandler {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const challengePath = options.challengePath ?? DEFAULT_CHALLENGE_PATH;
  const algs = options.algorithms ?? DEFAULT_ALGS;
  const paths = options.paths;
  const headerValue = buildAdvertisementHeader(algs, challengePath);

  return async (c, next) => {
    await next();

    if (!pathMatches(c.req.path, paths)) return;
    if (hasBoundCookie(c.req.header('cookie'), cookieName)) return;
    if (c.res.headers.has('Sec-Session-Registration')) return;

    c.res.headers.set('Sec-Session-Registration', headerValue);
  };
}
