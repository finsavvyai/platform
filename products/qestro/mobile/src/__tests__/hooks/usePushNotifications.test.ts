import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

const mockGetPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetToken = jest.fn().mockResolvedValue({ data: 'expo-push-token' });
const mockAddReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const mockAddResponseListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const mockSetChannel = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  getExpoPushTokenAsync: () => mockGetToken(),
  addNotificationReceivedListener: (cb: unknown) => mockAddReceivedListener(cb),
  addNotificationResponseReceivedListener: (cb: unknown) => mockAddResponseListener(cb),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissions.mockResolvedValue({ status: 'granted' });
  mockRequestPermissions.mockResolvedValue({ status: 'granted' });
  mockGetToken.mockResolvedValue({ data: 'expo-push-token' });
});

describe('usePushNotifications', () => {
  it('registers for push and returns token', async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => {
      expect(result.current.token).toBe('expo-push-token');
      expect(result.current.isEnabled).toBe(true);
    });
  });

  it('returns null token when permissions denied', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => {
      expect(result.current.token).toBeNull();
    });
  });

  it('subscribes to notification listeners', () => {
    renderHook(() => usePushNotifications());
    expect(mockAddReceivedListener).toHaveBeenCalled();
    expect(mockAddResponseListener).toHaveBeenCalled();
  });

  it('requestPermission returns granted status', async () => {
    const { result } = renderHook(() => usePushNotifications());
    const granted = await result.current.requestPermission();
    expect(granted).toBe(true);
  });

  it('routes notification response to correct screen', async () => {
    let responseCallback: (response: unknown) => void = () => {};
    mockAddResponseListener.mockImplementation((cb: (response: unknown) => void) => {
      responseCallback = cb;
      return { remove: jest.fn() };
    });

    renderHook(() => usePushNotifications());

    act(() => {
      responseCallback({
        notification: {
          request: { content: { data: { type: 'run_completed', id: 'run-1' } } },
        },
      });
    });

    expect(mockPush).toHaveBeenCalledWith('/runs/run-1');
  });

  it('does not route when notification data is missing type', async () => {
    let responseCallback: (response: unknown) => void = () => {};
    mockAddResponseListener.mockImplementation((cb: (response: unknown) => void) => {
      responseCallback = cb;
      return { remove: jest.fn() };
    });

    renderHook(() => usePushNotifications());

    act(() => {
      responseCallback({
        notification: {
          request: { content: { data: { id: 'run-1' } } },
        },
      });
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
