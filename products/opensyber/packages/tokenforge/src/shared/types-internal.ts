// ─── TokenForge Internal Types ───
// Types used by client internals, not part of the public API surface.

/** Step-up challenge stored in D1 */
export interface StepUpChallenge {
  id: string;
  session_id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'completed' | 'expired' | 'failed';
  method: 'totp' | 'email_otp' | 'passkey' | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

/** Device metadata collected during binding */
export interface DeviceMetadata {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  colorDepth: number;
}

/** Stored device key in IndexedDB */
export interface StoredDevice {
  deviceId: string;
  keyPair: CryptoKeyPair;
  createdAt: number;
  sessionId: string;
}

/** Binding request sent to server */
export interface BindRequest {
  publicKey: JsonWebKey;
  sessionId: string;
  metadata: DeviceMetadata;
}

/** Binding response from server */
export interface BindResponse {
  deviceId: string;
  expiresAt: string;
}

/** Trust score response from server */
export interface TrustScoreResponse {
  trustScore: number;
  isBound: boolean;
  deviceId: string | null;
}

/** Step-up initiation request */
export interface StepUpInitiateRequest {
  method: 'totp' | 'email_otp' | 'passkey';
}

/** Step-up initiation response */
export interface StepUpInitiateResponse {
  challengeId: string;
  method: string;
  expiresAt: string;
}

/** Step-up completion request */
export interface StepUpCompleteRequest {
  challengeId: string;
  code: string;
}

/** Step-up completion response */
export interface StepUpCompleteResponse {
  verified: boolean;
  trustScore: number;
}
