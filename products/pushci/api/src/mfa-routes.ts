// MFA (TOTP) enrollment + challenge routes. Closes enterprise gap #1
// (FIDO2/WebAuthn MFA) with TOTP as the first factor. WebAuthn is a
// follow-up on the same shape — the API contract below intentionally
// leaves room for `factor: "webauthn"` alongside `"totp"`.
//
// Table requirements (migration 2026-04-22_mfa_and_audit_chain.sql):
//   mfa_enrollments(user_id TEXT PK, secret TEXT, created_at INTEGER,
//                   confirmed_at INTEGER, backup_codes_json TEXT)
//   mfa_attempts(user_id TEXT PK, failed_count INTEGER, expires_at INTEGER)
//
// Auth: every route calls getAuthUser() and keys storage by `user.sub`
// (the JWT subject), matching the rest of api/src/. The global
// requireAuth middleware on /api/mfa/* still runs first and rejects
// un-authenticated requests before they reach these handlers.

import { Hono } from "hono";
import type { Env } from "./types";
import { getAuthUser } from "./team-auth";
import {
  buildOtpauthUri,
  generateTotpSecret,
  verifyTotp,
  TotpLockedOutError,
  type TotpRateLimiter,
} from "./security/totp";

const ISSUER = "PushCI";

function d1RateLimiter(env: Env): TotpRateLimiter {
  return {
    async getFailedAttempts(userId) {
      const row = await env.DB.prepare(
        "SELECT failed_count, expires_at FROM mfa_attempts WHERE user_id=?",
      ).bind(userId).first<{ failed_count: number; expires_at: number }>();
      if (!row) return 0;
      if (row.expires_at < Math.floor(Date.now() / 1000)) return 0;
      return row.failed_count;
    },
    async recordFailedAttempt(userId, windowSeconds) {
      const expires = Math.floor(Date.now() / 1000) + windowSeconds;
      await env.DB.prepare(
        `INSERT INTO mfa_attempts(user_id, failed_count, expires_at)
         VALUES(?, 1, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           failed_count = failed_count + 1,
           expires_at = excluded.expires_at`,
      ).bind(userId, expires).run();
    },
    async resetFailedAttempts(userId) {
      await env.DB.prepare("DELETE FROM mfa_attempts WHERE user_id=?")
        .bind(userId).run();
    },
  };
}

async function loadSecret(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT secret FROM mfa_enrollments WHERE user_id=? AND confirmed_at IS NOT NULL",
  ).bind(userId).first<{ secret: string }>();
  return row?.secret ?? null;
}

export const mfaRoutes = new Hono<{ Bindings: Env }>();

/** GET /api/mfa/status → { enrolled, factors } */
mfaRoutes.get("/status", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const secret = await loadSecret(c.env, user.sub);
  return c.json({
    enrolled: secret !== null,
    factors: secret ? ["totp"] : [],
  });
});

/** POST /api/mfa/enroll → starts enrollment, returns secret + otpauth URI
 *  (caller renders a QR). Must confirm with /verify before the factor is
 *  activated. Overwrites any pending (unconfirmed) enrollment. */
mfaRoutes.post("/enroll", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const accountLabel = user.login ?? user.sub;

  const secret = generateTotpSecret();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO mfa_enrollments(user_id, secret, created_at, confirmed_at, backup_codes_json)
     VALUES(?, ?, ?, NULL, NULL)
     ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,
       created_at=excluded.created_at, confirmed_at=NULL, backup_codes_json=NULL`,
  ).bind(user.sub, secret, now).run();

  return c.json({
    secret,
    otpauth: buildOtpauthUri(ISSUER, accountLabel, secret),
    issuer: ISSUER,
    account: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
});

/** POST /api/mfa/confirm { code } → confirms enrollment and issues
 *  10 one-shot backup codes. The codes are the ONLY way to regain
 *  access if the authenticator is lost; we return them plaintext
 *  exactly once, then store hashes only. */
mfaRoutes.post("/confirm", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const { code } = await c.req.json<{ code?: string }>();
  if (!code) return c.json({ error: "code_required" }, 400);

  const row = await c.env.DB.prepare(
    "SELECT secret FROM mfa_enrollments WHERE user_id=?",
  ).bind(user.sub).first<{ secret: string }>();
  if (!row) return c.json({ error: "enrollment_not_started" }, 400);

  const ok = await verifyTotp(code, user.sub, {
    getTotpSecret: async () => row.secret,
  });
  if (!ok) return c.json({ error: "invalid_code" }, 400);

  const backup = Array.from({ length: 10 }, () => generateBackupCode());
  const hashes = await Promise.all(backup.map(sha256Hex));
  await c.env.DB.prepare(
    "UPDATE mfa_enrollments SET confirmed_at=?, backup_codes_json=? WHERE user_id=?",
  ).bind(Math.floor(Date.now() / 1000), JSON.stringify(hashes), user.sub).run();

  return c.json({ confirmed: true, backupCodes: backup });
});

/** POST /api/mfa/verify { code } → verifies a code during a step-up
 *  challenge. Uses the D1-backed rate limiter. */
mfaRoutes.post("/verify", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const { code } = await c.req.json<{ code?: string }>();
  if (!code) return c.json({ error: "code_required" }, 400);

  try {
    const ok = await verifyTotp(code, user.sub, {
      getTotpSecret: (id) => loadSecret(c.env, id),
      rateLimiter: d1RateLimiter(c.env),
    });
    return c.json({ verified: ok });
  } catch (e) {
    if (e instanceof TotpLockedOutError) {
      return c.json(
        { error: "locked_out", retryAfter: e.retryAfterSeconds },
        429,
      );
    }
    throw e;
  }
});

/** POST /api/mfa/disable → removes the enrollment. Requires a current
 *  valid code to prevent a hijacked session from nuking the factor. */
mfaRoutes.post("/disable", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const { code } = await c.req.json<{ code?: string }>();
  if (!code) return c.json({ error: "code_required" }, 400);

  const ok = await verifyTotp(code, user.sub, {
    getTotpSecret: (id) => loadSecret(c.env, id),
  });
  if (!ok) return c.json({ error: "invalid_code" }, 400);

  await c.env.DB.prepare("DELETE FROM mfa_enrollments WHERE user_id=?")
    .bind(user.sub).run();
  return c.json({ disabled: true });
});

function generateBackupCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
