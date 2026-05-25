import { renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

describe('useReducedMotion', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns false by default', async () => {
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('returns true when motion is reduced', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
