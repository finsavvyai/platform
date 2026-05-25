// Session management policy — closes ENTERPRISE_CAPABILITIES.md §2.1
// "Session management (TTL, re-auth on sensitive ops)".
//
// Configurable via environment. Defaults are conservative enough for
// SOC 2 CC6.1 evidence. Two dimensions:
//
//   - sessionTtlSeconds: max time a session token is valid since issue.
//   - reauthWindowSeconds: sensitive endpoints (delete-account, rotate-
//     token, change-billing) require the session was re-authenticated
//     within this window. If not, return 401 with reason "reauth_required"
//     so the UI can drive an extra MFA or password prompt.
//
// The policy is pure logic — enforcement lives where sessions are issued
// and where a route is marked sensitive. Keeping it pure keeps it testable
// without a D1 mock.

export interface SessionPolicy {
  sessionTtlSeconds: number;
  reauthWindowSeconds: number;
  idleTimeoutSeconds: number;
}

export interface SessionState {
  issuedAt: number;
  lastAuthAt: number;
  lastSeenAt: number;
}

export type SessionVerdict =
  | { ok: true }
  | { ok: false; reason: "expired" | "idle_timeout" | "reauth_required" };

export const DEFAULT_POLICY: SessionPolicy = {
  sessionTtlSeconds: 8 * 60 * 60,
  reauthWindowSeconds: 15 * 60,
  idleTimeoutSeconds: 60 * 60,
};

export function policyFromEnv(env: Record<string, string | undefined>): SessionPolicy {
  const parse = (v: string | undefined, d: number) => {
    if (!v) return d;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    sessionTtlSeconds: parse(env.PUSHCI_SESSION_TTL_SECONDS, DEFAULT_POLICY.sessionTtlSeconds),
    reauthWindowSeconds: parse(env.PUSHCI_REAUTH_WINDOW_SECONDS, DEFAULT_POLICY.reauthWindowSeconds),
    idleTimeoutSeconds: parse(env.PUSHCI_IDLE_TIMEOUT_SECONDS, DEFAULT_POLICY.idleTimeoutSeconds),
  };
}

export function evaluateSession(
  state: SessionState,
  policy: SessionPolicy,
  now: number,
  options: { sensitive?: boolean } = {},
): SessionVerdict {
  const ageSec = (now - state.issuedAt) / 1000;
  if (ageSec >= policy.sessionTtlSeconds) return { ok: false, reason: "expired" };

  const idleSec = (now - state.lastSeenAt) / 1000;
  if (idleSec >= policy.idleTimeoutSeconds) {
    return { ok: false, reason: "idle_timeout" };
  }

  if (options.sensitive) {
    const reauthAgeSec = (now - state.lastAuthAt) / 1000;
    if (reauthAgeSec >= policy.reauthWindowSeconds) {
      return { ok: false, reason: "reauth_required" };
    }
  }

  return { ok: true };
}

export function touchSession(state: SessionState, now: number): SessionState {
  return { ...state, lastSeenAt: now };
}
