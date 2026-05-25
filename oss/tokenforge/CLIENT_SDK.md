# TokenForge Client SDK

## Implementation Specification

---

## 1. OVERVIEW

The TokenForge Client SDK is a lightweight, framework-agnostic TypeScript library that runs in the browser. It handles:

1. Generating non-extractable ECDSA keypairs via Web Crypto API
2. Storing keys securely in IndexedDB
3. Signing challenge-response proofs on every authenticated request
4. Intercepting fetch/XHR to automatically attach signatures
5. Handling step-up auth prompts from the server
6. Re-binding keys on new device/browser

---

## 2. CLIENT SDK API

```typescript
// @tokenforge/client — main entry point

interface TokenForgeConfig {
  // Base URL of the TokenForge-protected API
  apiBase: string;
  
  // How to get the current session ID (from your auth provider)
  getSessionId: () => string | null;
  
  // Called when server demands step-up authentication
  onStepUpRequired?: (reason: string) => void;
  
  // Called when session is revoked by server
  onSessionRevoked?: () => void;
  
  // Called on binding success (first request after login)
  onDeviceBound?: (deviceId: string) => void;
  
  // Custom header names (defaults shown)
  headers?: {
    signature?: string;   // default: 'X-TF-Signature'
    nonce?: string;       // default: 'X-TF-Nonce'
    timestamp?: string;   // default: 'X-TF-Timestamp'
    deviceId?: string;    // default: 'X-TF-Device-ID'
  };
  
  // Enable automatic fetch interception (default: true)
  autoIntercept?: boolean;
  
  // Paths to skip (no signing needed)
  skipPaths?: string[];
}

class TokenForge {
  constructor(config: TokenForgeConfig);
  
  // Initialize — call after user authenticates
  // Generates keypair if needed, binds to session
  async init(): Promise<void>;
  
  // Manually sign a request (if autoIntercept is false)
  async signRequest(request: Request): Promise<Request>;
  
  // Get current device ID
  getDeviceId(): string | null;
  
  // Check if current session is bound
  isBound(): boolean;
  
  // Clear keys (on logout)
  async clearKeys(): Promise<void>;
  
  // Force re-bind (after step-up auth completes)
  async rebind(): Promise<void>;
}

// Factory function
export function createTokenForge(config: TokenForgeConfig): TokenForge;
```

---

## 3. KEY GENERATION & STORAGE

```typescript
// internal/crypto.ts

const DB_NAME = 'tokenforge';
const STORE_NAME = 'device_keys';
const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };

interface StoredDevice {
  deviceId: string;
  keyPair: CryptoKeyPair;   // non-extractable
  createdAt: number;
  sessionId: string;
}

/**
 * Generate a new ECDSA P-256 keypair.
 * The private key is NON-EXTRACTABLE — it can never be read,
 * only used for signing operations within the browser's crypto engine.
 */
async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    KEY_ALGORITHM,
    false,  // NON-EXTRACTABLE — this is the entire security model
    ['sign', 'verify']
  );
}

/**
 * Export public key as JWK for sending to server during binding.
 * Only the PUBLIC key is exportable. Private key stays locked.
 */
async function exportPublicKey(keyPair: CryptoKeyPair): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', keyPair.publicKey);
}

/**
 * Store keypair in IndexedDB.
 * IndexedDB can store CryptoKey objects directly (structured clone).
 * The non-extractable property is preserved across storage.
 */
async function storeDeviceKey(device: StoredDevice): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.put(device, 'current');
  await tx.done;
}

/**
 * Retrieve stored keypair from IndexedDB.
 * Returns the CryptoKey handle — still non-extractable.
 */
async function getDeviceKey(): Promise<StoredDevice | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return await store.get('current') || null;
}

/**
 * Clear all stored keys (on logout or re-bind).
 */
async function clearDeviceKeys(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.clear();
  await tx.done;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

---

## 4. SIGNING PROTOCOL

```typescript
// internal/signer.ts

/**
 * Sign a challenge payload with the device-bound private key.
 * 
 * Payload format: `${sessionId}:${nonce}:${timestamp}`
 * 
 * The signature proves:
 * 1. The request comes from the device that originally bound to this session
 * 2. The request is fresh (timestamp + nonce prevent replay)
 * 3. The session ID hasn't been tampered with
 */
async function signChallenge(
  privateKey: CryptoKey,
  sessionId: string,
  nonce: string,
  timestamp: number
): Promise<string> {
  const payload = `${sessionId}:${nonce}:${timestamp}`;
  const encoded = new TextEncoder().encode(payload);
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    encoded
  );
  
  // Convert ArrayBuffer to base64url for HTTP header transport
  return arrayBufferToBase64Url(signature);
}

/**
 * Generate a client-side nonce.
 * Server will verify this hasn't been used before.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return arrayBufferToBase64Url(bytes.buffer);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

---

## 5. FETCH INTERCEPTOR

```typescript
// internal/interceptor.ts

/**
 * Monkey-patch global fetch to automatically sign all requests
 * to the protected API. This is transparent to application code.
 * 
 * Application code continues to use fetch() normally:
 *   const res = await fetch('/api/instances');
 * 
 * The interceptor adds the TokenForge headers automatically.
 */
function installFetchInterceptor(
  config: TokenForgeConfig,
  getSigningMaterial: () => Promise<{
    privateKey: CryptoKey;
    sessionId: string;
    deviceId: string;
  } | null>
) {
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // Skip non-API requests and excluded paths
    if (!shouldIntercept(url, config)) {
      return originalFetch.call(window, input, init);
    }
    
    const material = await getSigningMaterial();
    if (!material) {
      // Not bound yet — pass through (binding endpoint handles this)
      return originalFetch.call(window, input, init);
    }
    
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signChallenge(
      material.privateKey,
      material.sessionId,
      nonce,
      timestamp
    );
    
    const headers = new Headers(init?.headers);
    headers.set(config.headers?.signature || 'X-TF-Signature', signature);
    headers.set(config.headers?.nonce || 'X-TF-Nonce', nonce);
    headers.set(config.headers?.timestamp || 'X-TF-Timestamp', timestamp.toString());
    headers.set(config.headers?.deviceId || 'X-TF-Device-ID', material.deviceId);
    
    const response = await originalFetch.call(window, input, { ...init, headers });
    
    // Handle server-side step-up requirement
    if (response.status === 403) {
      const body = await response.clone().json().catch(() => null);
      if (body?.action === 'step_up_required') {
        config.onStepUpRequired?.(body.reason || 'trust_score_low');
      }
    }
    
    // Handle session revocation
    if (response.status === 401) {
      const body = await response.clone().json().catch(() => null);
      if (body?.action === 'session_revoked') {
        config.onSessionRevoked?.();
      }
    }
    
    return response;
  };
}
```

---

## 6. DEVICE BINDING FLOW

```typescript
// internal/binding.ts

/**
 * Complete binding flow — called once after authentication.
 * 
 * 1. Check if we already have a valid key for this session
 * 2. If not, generate new keypair
 * 3. Send public key to server to bind to session
 * 4. Server stores public key and returns device ID
 * 5. Store keypair + device ID locally
 */
async function bindDevice(
  apiBase: string,
  sessionId: string
): Promise<{ deviceId: string; keyPair: CryptoKeyPair }> {
  // Check for existing binding
  const existing = await getDeviceKey();
  if (existing && existing.sessionId === sessionId) {
    return { deviceId: existing.deviceId, keyPair: existing.keyPair };
  }
  
  // Generate new keypair
  const keyPair = await generateDeviceKeyPair();
  const publicKeyJwk = await exportPublicKey(keyPair);
  
  // Send public key to server
  const response = await fetch(`${apiBase}/api/tf/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // send auth cookies
    body: JSON.stringify({
      publicKey: publicKeyJwk,
      sessionId: sessionId,
      // Device metadata for trust scoring
      metadata: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        colorDepth: screen.colorDepth,
      }
    }),
  });
  
  if (!response.ok) {
    throw new Error(`TokenForge binding failed: ${response.status}`);
  }
  
  const { deviceId } = await response.json();
  
  // Store locally
  await storeDeviceKey({
    deviceId,
    keyPair,
    createdAt: Date.now(),
    sessionId,
  });
  
  return { deviceId, keyPair };
}
```

---

## 7. REACT INTEGRATION (for ClawShield dashboard)

```tsx
// @tokenforge/react — convenience hooks

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createTokenForge, type TokenForge } from '@tokenforge/client';
import { useAuth } from '@clerk/nextjs'; // or any auth provider

interface TokenForgeContextValue {
  isReady: boolean;
  isBound: boolean;
  deviceId: string | null;
  trustScore: number | null;
}

const TokenForgeContext = createContext<TokenForgeContextValue>({
  isReady: false,
  isBound: false,
  deviceId: null,
  trustScore: null,
});

export function TokenForgeProvider({ children }: { children: ReactNode }) {
  const { sessionId, isSignedIn } = useAuth();
  const [state, setState] = useState<TokenForgeContextValue>({
    isReady: false,
    isBound: false,
    deviceId: null,
    trustScore: null,
  });
  
  useEffect(() => {
    if (!isSignedIn || !sessionId) return;
    
    const tf = createTokenForge({
      apiBase: process.env.NEXT_PUBLIC_API_URL!,
      getSessionId: () => sessionId,
      onStepUpRequired: (reason) => {
        // Show step-up modal
        window.dispatchEvent(new CustomEvent('tf:step-up', { detail: reason }));
      },
      onSessionRevoked: () => {
        // Force logout
        window.location.href = '/sign-in?reason=session_revoked';
      },
      onDeviceBound: (deviceId) => {
        setState(s => ({ ...s, isBound: true, deviceId }));
      },
    });
    
    tf.init().then(() => {
      setState(s => ({ ...s, isReady: true }));
    });
    
    return () => { tf.clearKeys(); };
  }, [sessionId, isSignedIn]);
  
  return (
    <TokenForgeContext.Provider value={state}>
      {children}
    </TokenForgeContext.Provider>
  );
}

export function useTokenForge() {
  return useContext(TokenForgeContext);
}

// Usage in ClawShield:
// 
// // app/layout.tsx
// <ClerkProvider>
//   <TokenForgeProvider>
//     {children}
//   </TokenForgeProvider>
// </ClerkProvider>
//
// // Any component:
// const { isBound, deviceId, trustScore } = useTokenForge();
```

---

## 8. BROWSER COMPATIBILITY

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Crypto API (ECDSA) | ✅ 37+ | ✅ 34+ | ✅ 11+ | ✅ 79+ |
| Non-extractable keys | ✅ | ✅ | ✅ | ✅ |
| IndexedDB + CryptoKey storage | ✅ | ✅ | ✅ 14.1+ | ✅ |
| Structured clone of CryptoKey | ✅ | ✅ | ⚠️ 15+ | ✅ |

**Fallback:** If Web Crypto or IndexedDB is unavailable (very old browsers), TokenForge gracefully degrades to fingerprint-only mode (no cryptographic binding, just anomaly detection).

---

## 9. SECURITY CONSIDERATIONS

### XSS Resistance
- Private keys are non-extractable — XSS cannot read them
- An XSS attacker could call `crypto.subtle.sign()` but would need to maintain persistent JavaScript execution on the page, which is much harder than stealing a cookie string
- Combined with CSP headers and HttpOnly cookies, the attack surface is minimal

### Key Rotation
- Keys should be rotated every 30 days
- Server tracks key age and triggers re-binding during normal request flow
- Old public keys are archived for audit trail

### Multi-Tab Behavior
- IndexedDB is shared across tabs for same origin
- All tabs use the same keypair — no conflicts
- Signing is async but non-blocking

### Incognito/Private Mode
- IndexedDB may be cleared on window close in some browsers
- TokenForge detects this and re-binds on next session
- Trust score notes the re-bind event but doesn't penalize it heavily

### Mobile Browsers
- Full Web Crypto support on modern mobile browsers
- Keys persisted in app-scoped IndexedDB
- Works in PWA mode
