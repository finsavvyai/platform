// ─── TokenForge Shared Types ───

/** Configuration for the TokenForge client SDK */
export interface TokenForgeConfig {
  /** Base URL of the TokenForge-protected API */
  apiBase: string;
  /** How to get the current session ID (from your auth provider) */
  getSessionId: () => string | null;
  /** Called when server demands step-up authentication */
  onStepUpRequired?: (reason: string) => void;
  /** Called when session is revoked by server */
  onSessionRevoked?: () => void;
  /** Called on binding success */
  onDeviceBound?: (deviceId: string) => void;
  /** Custom header names */
  headers?: {
    signature?: string;
    nonce?: string;
    timestamp?: string;
    deviceId?: string;
  };
  /** Enable automatic fetch interception (default: true) */
  autoIntercept?: boolean;
  /** Paths to skip (no signing needed) */
  skipPaths?: string[];
}

/** DBSC (Device Bound Session Credentials) configuration. */
export interface DbscConfig {
  /** Enable DBSC bound-cookie verification in the pipeline. */
  enabled: boolean;
  /** Cookie name (default: '__Secure-tf-bound'). */
  cookieName?: string;
  /** Cookie rotation interval in seconds (default: 300). */
  rotationInterval?: number;
}

/** Configuration for the TokenForge server middleware */
export interface TokenForgeServerOptions {
  storage: TokenForgeStorageRef;
  trustThresholds: {
    /** Score >= this: request proceeds (default: 80) */
    allow: number;
    /** Score >= this: step-up required (default: 40) */
    stepUp: number;
  };
  /** Session max age in seconds (default: 86400 = 24h) */
  sessionMaxAge: number;
  /** Nonce expiry in seconds (default: 60) */
  nonceExpiry: number;
  /** Paths that skip TokenForge verification */
  skipPaths?: string[];
  /** Paths requiring elevated trust (>90) */
  sensitiveOps?: string[];
  /** DBSC bound-cookie settings (disabled by default). */
  dbsc?: DbscConfig;
  /** Called on security events */
  onSecurityEvent?: (event: SecurityEvent) => Promise<void>;
  /** Email delivery callback for OTP step-up */
  sendEmail?: (to: string, otp: string) => Promise<void>;
  /** Get IP address from request (framework-specific) */
  getIpAddress?: (req: unknown) => string;
  /** Get country code from request (framework-specific) */
  getCountryCode?: (req: unknown) => string;
  /** Get user agent from request (framework-specific) */
  getUserAgent?: (req: unknown) => string;
  /** Retrieve stored WebAuthn public key (SPKI) for passkey verification */
  getPasskeyPublicKey?: (userId: string, credentialId: string) => Promise<ArrayBuffer | null>;
  /** Retrieve TOTP shared secret for a user */
  getTotpSecret?: (userId: string) => Promise<string | null>;
}

/**
 * Storage reference — import from '@opensyber/tokenforge/server/storage'.
 * This avoids a circular dep between types.ts and the storage interface.
 */
export interface TokenForgeStorageRef {
  getSession(sessionId: string, deviceId: string): Promise<DeviceSession | null>;
  createSession(session: DeviceSession): Promise<void>;
  updateTrustScore(deviceId: string, trustScore: number): Promise<void>;
  updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void>;
  revokeSession(deviceId: string, reason: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
  listUserSessions(userId: string, limit: number): Promise<DeviceSession[]>;
  restoreTrust(deviceId: string, userId: string): Promise<void>;
  hasNonce(nonce: string): Promise<boolean>;
  storeNonce(nonce: string, ttlSeconds: number): Promise<void>;
  logEvent(event: SecurityEvent & { id: string }): Promise<void>;
  listEvents(userId: string, limit: number, offset: number): Promise<(SecurityEvent & { id: string; created_at: string })[]>;
  createChallenge(challenge: unknown): Promise<void>;
  getChallenge(challengeId: string, userId: string): Promise<unknown>;
  updateChallengeStatus(challengeId: string, status: string, completedAt?: string): Promise<void>;
  countRecentChallenges(userId: string, windowMinutes: number): Promise<number>;
  getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null>;
  setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void>;
  storeOtp(challengeId: string, code: string, ttlSeconds: number): Promise<void>;
  getOtp(challengeId: string): Promise<string | null>;
  deleteOtp(challengeId: string): Promise<void>;
}

/** A security event logged by the middleware */
export interface SecurityEvent {
  sessionId: string;
  userId: string;
  eventType: SecurityEventType;
  trustScoreBefore: number;
  trustScoreAfter: number;
  ipAddress: string;
  countryCode: string;
  userAgent: string;
  metadata: Record<string, unknown>;
}

/** All possible security event types */
export type SecurityEventType =
  | 'DEVICE_BOUND'
  | 'SIGNATURE_INVALID'
  | 'IP_CHANGE'
  | 'GEO_ANOMALY'
  | 'TRUST_DROP'
  | 'TRUST_SCORE_CHANGE'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'
  | 'STEP_UP_TRIGGERED'
  | 'STEP_UP_COMPLETED'
  | 'STEP_UP_FAILED'
  | 'NONCE_REPLAY'
  | 'DEVICE_MISMATCH'
  | 'DEVICE_NOT_FOUND'
  | 'TIMESTAMP_SKEW'
  | 'DBSC_COOKIE_MISSING'
  | 'DBSC_COOKIE_INVALID';

/** Signals used by the trust score engine */
export interface TrustSignals {
  signatureValid: boolean;
  ipAddress: string;
  originalIp: string;
  countryCode: string;
  originalCountry: string;
  userAgent: string;
  originalFingerprint: string;
  requestTimestamp: number;
  sessionCreatedAt: number;
  /** Activity histogram for time-of-day anomaly detection (optional). */
  activityHistogram?: { buckets: number[]; totalRequests: number };
}

/** Breakdown of trust score components */
export interface ScoreBreakdown {
  signatureScore: number;
  ipScore: number;
  geoScore: number;
  fingerprintScore: number;
  velocityScore: number;
  timeScore: number;
  nonceScore: number;
  /** Negative number — subtracted from total when AitM anomalies present. */
  aitmDelta?: number;
  total: number;
  reasons: string[];
}

/** Device session stored in D1 */
export interface DeviceSession {
  id: string;
  session_id: string;
  user_id: string;
  public_key: string;
  device_fingerprint: string | null;
  ip_address: string | null;
  country_code: string | null;
  trust_score: number;
  bound_at: string;
  last_verified_at: string;
  expires_at: string;
  revoked: number;
  revoked_reason: string | null;
  created_at: string;
  /** SHA-256 hash of the DBSC bound cookie (if DBSC enabled). */
  bound_cookie_hash?: string | null;
  /** ISO timestamp when the bound cookie expires. */
  bound_cookie_expires_at?: string | null;
}

/** Default header names */
export const TF_HEADERS = {
  SIGNATURE: 'X-TF-Signature',
  NONCE: 'X-TF-Nonce',
  TIMESTAMP: 'X-TF-Timestamp',
  DEVICE_ID: 'X-TF-Device-ID',
} as const;
