/**
 * TokenForge React Native SDK — Device-bound ECDSA P-256 session security.
 *
 * Security notes for RN integrators:
 *  1. You MUST polyfill `crypto.getRandomValues()` before importing this
 *     module, for example via `import 'react-native-get-random-values'` at
 *     the top of your entrypoint. Without it this SDK will throw on key
 *     generation rather than fall back to `Math.random()`.
 *
 *  2. Hardware-backed key storage (iOS Secure Enclave / Android KeyStore) is
 *     used automatically when the native modules are linked. This provides
 *     non-extractable keys equivalent to Web Crypto `extractable: false`.
 *
 *  3. When native modules are unavailable (Expo Go, missing linking), the SDK
 *     falls back to `elliptic` + `react-native-keychain` — software-bound
 *     keys. The `isHardwareBacked` flag reflects the active storage tier.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ec as EC } from "elliptic";
import { sha256 } from "@noble/hashes/sha256";

import { getNativeKeyStore, bytesToBase64 } from "./native-bridge";
import type { NativeKeyStore } from "./native-bridge";
import {
  generateId,
  loadOrGenerateSoftwareKey,
  signWithSoftwareKey,
  softwarePublicKeyPem,
} from "./software-keys";

const API_BASE = "https://tokenforge-api.opensyber.cloud";
const BIND_ENDPOINT = "/v1/bind";

interface TokenForgeState {
  isBound: boolean;
  isHardwareBacked: boolean;
  deviceId: string;
  sessionId: string;
  signRequest: (request: RequestInit & { url: string }) => RequestInit;
  getHeaders: () => Record<string, string>;
  bind: () => Promise<void>;
}

interface TokenForgeConfig {
  apiKey: string;
  apiBase?: string;
}

const TokenForgeContext = createContext<TokenForgeState | null>(null);

/** Sign payload using the native hardware key store. */
async function signWithHardwareKey(native: NativeKeyStore, payload: string): Promise<string> {
  const hash = sha256(new TextEncoder().encode(payload));
  return native.sign(bytesToBase64(hash));
}

export function TokenForgeProvider({
  apiKey,
  apiBase = API_BASE,
  children,
}: TokenForgeConfig & { children: React.ReactNode }) {
  const [isBound, setIsBound] = useState(false);
  const [isHardwareBacked, setIsHardwareBacked] = useState(false);
  const deviceId = useRef(generateId()).current;
  const sessionId = useRef(generateId()).current;
  const softwareKeyRef = useRef<EC.KeyPair | null>(null);
  const nativeRef = useRef<NativeKeyStore | null>(null);
  const publicKeyB64Ref = useRef<string | null>(null);

  useEffect(() => {
    const native = getNativeKeyStore();
    if (native) {
      nativeRef.current = native;
      native.hasHardwareKey().then(async (exists) => {
        if (!exists) {
          const pubKey = await native.generateKey();
          publicKeyB64Ref.current = pubKey;
        }
        const hwBacked = await native.isHardwareBacked();
        setIsHardwareBacked(hwBacked);
      });
    } else {
      loadOrGenerateSoftwareKey().then((k) => { softwareKeyRef.current = k; });
    }
  }, []);

  const signPayload = async (payload: string): Promise<string> => {
    if (nativeRef.current) {
      return signWithHardwareKey(nativeRef.current, payload);
    }
    if (!softwareKeyRef.current) throw new Error("TokenForge key not ready");
    return signWithSoftwareKey(softwareKeyRef.current, payload);
  };

  const getHeaders = (): Record<string, string> => {
    if (nativeRef.current) {
      throw new Error(
        "getHeaders() is not supported with hardware-backed keys. " +
          "Use signRequest() or bind() instead — native signing is async.",
      );
    }
    if (!softwareKeyRef.current) throw new Error("TokenForge key not ready");
    const nonce = generateId();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${sessionId}:${nonce}:${timestamp}`;
    return {
      "X-TF-Signature": signWithSoftwareKey(softwareKeyRef.current, payload),
      "X-TF-Nonce": nonce,
      "X-TF-Timestamp": timestamp,
      "X-TF-Device-ID": deviceId,
      Authorization: `Bearer ${apiKey}`,
    };
  };

  const signRequest = (req: RequestInit & { url: string }): RequestInit => {
    const headers = getHeaders();
    return { ...req, headers: { ...(req.headers as Record<string, string>), ...headers } };
  };

  const bind = async (): Promise<void> => {
    const publicKey = nativeRef.current && publicKeyB64Ref.current
      ? publicKeyB64Ref.current
      : softwareKeyRef.current
        ? softwarePublicKeyPem(softwareKeyRef.current)
        : (() => { throw new Error("TokenForge key not ready"); })();

    const nonce = generateId();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${sessionId}:${nonce}:${timestamp}`;
    const signature = await signPayload(payload);

    const body = JSON.stringify({ deviceId, sessionId, publicKey, hardwareBacked: isHardwareBacked });
    const headers: Record<string, string> = {
      "X-TF-Signature": signature,
      "X-TF-Nonce": nonce,
      "X-TF-Timestamp": timestamp,
      "X-TF-Device-ID": deviceId,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const resp = await fetch(`${apiBase}${BIND_ENDPOINT}`, { method: "POST", headers, body });
    if (!resp.ok) throw new Error(`Bind failed: ${resp.status}`);
    setIsBound(true);
  };

  const value: TokenForgeState = {
    isBound, isHardwareBacked, deviceId, sessionId, signRequest, getHeaders, bind,
  };
  return React.createElement(TokenForgeContext.Provider, { value }, children);
}

export function useTokenForge(): TokenForgeState {
  const ctx = useContext(TokenForgeContext);
  if (!ctx) throw new Error("useTokenForge must be used within <TokenForgeProvider>");
  return ctx;
}

export function createFetchInterceptor(getHeaders: () => Record<string, string>) {
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = { ...(init?.headers as Record<string, string>), ...getHeaders() };
    return originalFetch(input, { ...init, headers });
  };
}

export type { TokenForgeState, TokenForgeConfig };
export type { NativeKeyStore } from "./native-bridge";
