/**
 * TokenForge Native Bridge — platform-aware loader for hardware key stores.
 *
 * Detects the React Native platform and loads the corresponding native module
 * (Android KeyStore or iOS Secure Enclave). Returns `null` when native modules
 * are unavailable (Expo Go, missing linking, or web).
 */

import { NativeModules, Platform } from "react-native";

/**
 * Contract every native key-store module must satisfy.
 * Values are passed as base64 strings across the JS ↔ native bridge.
 */
export interface NativeKeyStore {
  /** Generate a hardware-backed P-256 keypair. Returns base64 public key. */
  generateKey(): Promise<string>;

  /**
   * Sign `data` with the hardware-backed private key.
   * @param data base64-encoded bytes to sign
   * @returns base64-encoded DER signature
   */
  sign(data: string): Promise<string>;

  /** True if a TokenForge key exists on the device. */
  hasHardwareKey(): Promise<boolean>;

  /**
   * True if the key is backed by dedicated hardware:
   * - Android: StrongBox secure element
   * - iOS: Secure Enclave
   */
  isHardwareBacked(): Promise<boolean>;

  /** Delete the TokenForge key from hardware storage. */
  deleteKey(): Promise<void>;
}

/**
 * Attempt to load the native key-store module for the current platform.
 *
 * Returns `null` when the native module is not linked — this is expected
 * in Expo Go, Jest, and during initial development. The SDK falls back
 * to the software (`elliptic`) path automatically.
 */
export function getNativeKeyStore(): NativeKeyStore | null {
  try {
    if (Platform.OS === "android") {
      const mod = NativeModules.TokenForgeKeyStore as NativeKeyStore | undefined;
      if (mod?.generateKey) return mod;
      return null;
    }

    if (Platform.OS === "ios") {
      const mod = NativeModules.TokenForgeSecureEnclave as NativeKeyStore | undefined;
      if (mod?.generateKey) return mod;
      return null;
    }

    // Unsupported platform (web, windows, etc.)
    return null;
  } catch {
    return null;
  }
}

/**
 * Helper: decode a base64 string to a Uint8Array.
 * Works in React Native's JS environment (uses atob).
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper: encode a Uint8Array to a base64 string.
 * Works in React Native's JS environment (uses btoa).
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
