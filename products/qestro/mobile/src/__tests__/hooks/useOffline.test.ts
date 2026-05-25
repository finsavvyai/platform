import { renderHook } from '@testing-library/react-native';
import { useOffline } from '@/hooks/useOffline';
import NetInfo from '@react-native-community/netinfo';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

describe('useOffline', () => {
  it('should return isOffline status', () => {
    const { result } = renderHook(() => useOffline());
    expect(typeof result.current.isOffline).toBe('boolean');
  });

  it('should subscribe to NetInfo on mount', () => {
    renderHook(() => useOffline());
    expect(NetInfo.addEventListener).toHaveBeenCalled();
  });

  it('should provide replay function', () => {
    const { result } = renderHook(() => useOffline());
    expect(typeof result.current.replay).toBe('function');
  });
});
