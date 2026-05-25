// Biometric unlock wrapper. Skips gracefully on web, when hardware/enrolment
// is missing (e.g. a simulator without a matching face configured), and when
// the native module isn't linked yet (stale build without a rebuild).

import { Platform } from 'react-native';

export type BiometricResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'not_enrolled' | 'failed' | 'cancelled' };

// Dynamically resolve the native module so stale app binaries (built before
// expo-local-authentication was added) don't crash the JS bundle on load.
function loadModule(): typeof import('expo-local-authentication') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const LA = loadModule();
  if (!LA) return false;
  try {
    const hasHardware = await LA.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LA.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function authenticate(
  reason = 'Unlock PushCI'
): Promise<BiometricResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'unavailable' };
  const LA = loadModule();
  if (!LA) return { ok: false, reason: 'unavailable' };

  try {
    const hasHardware = await LA.hasHardwareAsync();
    if (!hasHardware) return { ok: false, reason: 'unavailable' };

    const enrolled = await LA.isEnrolledAsync();
    if (!enrolled) return { ok: false, reason: 'not_enrolled' };

    const result = await LA.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use OAuth instead',
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
    });

    if (result.success) return { ok: true };
    if (result.error === 'user_cancel' || result.error === 'system_cancel') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
