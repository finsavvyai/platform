import { renderHook, act } from '@testing-library/react-native';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';

const mockHasHardware = jest.fn();
const mockIsEnrolled = jest.fn();
const mockSupportedTypes = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: () => mockHasHardware(),
  isEnrolledAsync: () => mockIsEnrolled(),
  supportedAuthenticationTypesAsync: () => mockSupportedTypes(),
  authenticateAsync: (opts: unknown) => mockAuthenticate(opts),
  AuthenticationType: {
    FACIAL_RECOGNITION: 1,
    FINGERPRINT: 2,
  },
}));

beforeEach(() => {
  mockHasHardware.mockReset();
  mockIsEnrolled.mockReset();
  mockSupportedTypes.mockReset();
  mockAuthenticate.mockReset();
});

describe('useBiometricAuth', () => {
  it('should detect biometric availability', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockSupportedTypes.mockResolvedValue([1]);

    const { result } = renderHook(() => useBiometricAuth());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isBiometricAvailable).toBe(true);
    expect(result.current.biometricType).toBe('Face ID');
  });

  it('should handle no biometric hardware', async () => {
    mockHasHardware.mockResolvedValue(false);
    mockIsEnrolled.mockResolvedValue(false);
    mockSupportedTypes.mockResolvedValue([]);

    const { result } = renderHook(() => useBiometricAuth());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isBiometricAvailable).toBe(false);
  });

  it('should authenticate successfully', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockSupportedTypes.mockResolvedValue([2]);
    mockAuthenticate.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useBiometricAuth());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    let success = false;
    await act(async () => {
      success = await result.current.authenticate();
    });

    expect(success).toBe(true);
  });

  it('should handle authentication failure', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockSupportedTypes.mockResolvedValue([1]);
    mockAuthenticate.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useBiometricAuth());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    let success = true;
    await act(async () => {
      success = await result.current.authenticate();
    });

    expect(success).toBe(false);
  });
});
