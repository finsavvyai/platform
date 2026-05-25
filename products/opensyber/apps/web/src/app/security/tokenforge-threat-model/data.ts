/** TokenForge threat model data — attacks, assumptions, standards, and key storage. */

export interface StoppedAttack {
  attack: string;
  how: string;
  confidence: 'High' | 'Medium';
}

export interface UnstoppedAttack {
  attack: string;
  why: string;
  mitigation: string;
}

export interface StandardAlignment {
  standard: string;
  status: string;
  details: string;
}

export interface KeyStoragePlatform {
  platform: string;
  storage: string;
  hardwareBacked: string;
}

export const stoppedAttacks: StoppedAttack[] = [
  {
    attack: 'AitM session replay',
    how: 'ECDSA P-256 per-request signature; stolen cookie fails on attacker’s device',
    confidence: 'High',
  },
  {
    attack: 'Token theft via XSS (cookie-only)',
    how: 'Device-bound signature required alongside session cookie',
    confidence: 'High',
  },
  {
    attack: 'Session hijacking via network sniffing',
    how: 'Signature verification fails without private key',
    confidence: 'High',
  },
  {
    attack: 'Automated credential replay bots',
    how: 'Nonce + timestamp + device fingerprint required per request',
    confidence: 'High',
  },
  {
    attack: 'Lateral movement with stolen sessions',
    how: 'Trust score engine detects IP/geo/UA drift from binding baseline',
    confidence: 'Medium',
  },
  {
    attack: 'AitM proxy detection',
    how: '8 heuristic signals (origin mismatch, latency floor, UA drift, timezone, locale, resolution)',
    confidence: 'Medium',
  },
];

export const unstoppedAttacks: UnstoppedAttack[] = [
  {
    attack: 'Malware on legitimate device',
    why: 'Attacker rides along on device’s signing capability',
    mitigation: 'WebAuthn path with user gesture; app attestation (roadmap)',
  },
  {
    attack: 'XSS-triggered signed requests (ECDSA path)',
    why: 'Signing not gated by user gesture in browser ECDSA path',
    mitigation: 'Use WebAuthn path for sensitive operations',
  },
  {
    attack: 'Social engineering / phishing of credentials',
    why: 'User still enters credentials on attacker’s page',
    mitigation: 'Out of scope — authentication layer, not session layer',
  },
  {
    attack: 'Clickjacking on signing operation',
    why: 'ECDSA signing is transparent; no user confirmation',
    mitigation: 'WebAuthn path requires user verification',
  },
  {
    attack: 'Server-side compromise',
    why: 'If the server is compromised, session storage is exposed',
    mitigation: 'Standard server hardening; not a client-binding concern',
  },
];

export const assumptions: string[] = [
  'TLS is intact between client and server',
  'Integrator calls verifyRequest() on all protected routes',
  'Clock skew between client and server < 60 seconds',
  'Storage backend (D1/Redis/Postgres) is available per-request',
  'Browser’s Web Crypto implementation is correct and non-extractable keys are truly non-extractable',
  'For hardware-bound keys (WebAuthn, Android KeyStore): the hardware attestation chain is valid',
];

export const standards: StandardAlignment[] = [
  {
    standard: 'WebAuthn / FIDO2',
    status: 'Compliant',
    details: 'Real attestation + assertion flows with ES256 and EdDSA',
  },
  {
    standard: 'DPoP (RFC 9449)',
    status: 'Aligned',
    details: 'Per-request proof-of-possession; body signing ships in v2',
  },
  {
    standard: 'DBSC (Device Bound Session Credentials)',
    status: 'Primitives built',
    details: 'Challenge-response + bound-cookie implemented; pipeline integration in progress',
  },
  {
    standard: 'Token Binding (RFC 8471)',
    status: 'Not implemented',
    details: 'Deprecated standard; superseded by DBSC',
  },
];

export const keyStorage: KeyStoragePlatform[] = [
  {
    platform: 'Browser (ECDSA)',
    storage: 'Web Crypto + IndexedDB',
    hardwareBacked: 'No (software-bound, extractable:false)',
  },
  {
    platform: 'Browser (WebAuthn)',
    storage: 'Authenticator hardware',
    hardwareBacked: 'Yes (YubiKey, Touch ID, Windows Hello)',
  },
  {
    platform: 'Android (Kotlin SDK)',
    storage: 'Android KeyStore',
    hardwareBacked: 'Yes (TEE/StrongBox)',
  },
  {
    platform: 'iOS (Swift SDK)',
    storage: 'iOS Keychain',
    hardwareBacked: 'No (Secure Enclave upgrade planned)',
  },
  {
    platform: 'React Native',
    storage: 'react-native-keychain',
    hardwareBacked: 'No (hardware bridge planned)',
  },
  {
    platform: 'Go / Python / MCP',
    storage: 'PEM file / in-memory',
    hardwareBacked: 'No (server-side SDKs)',
  },
];

export const integrationCode = `import { tokenForge } from '@opensyber/tokenforge/hono';

app.use('/api/*', tokenForge({
  storage: new D1Storage(env.DB),
  trustThresholds: { allow: 80, stepUp: 40 },
}));`;
