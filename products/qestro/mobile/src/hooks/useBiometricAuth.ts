import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

interface BiometricAuthResult {
  isBiometricAvailable: boolean;
  biometricType: string | null;
  authenticate: () => Promise<boolean>;
}

export function useBiometricAuth(): BiometricAuthResult {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometrics();
  }, []);

  async function checkBiometrics() {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricAvailable(compatible && enrolled);

    if (compatible) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Touch ID');
      }
    }
  }

  async function authenticate(): Promise<boolean> {
    if (!isBiometricAvailable) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to Qestro',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  }

  return { isBiometricAvailable, biometricType, authenticate };
}
