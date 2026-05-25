import { renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useAccessibility } from '../../hooks/useAccessibility';

describe('useAccessibility', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'isBoldTextEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns all false by default', async () => {
    const { result } = renderHook(() => useAccessibility());
    await waitFor(() => {
      expect(result.current.isScreenReaderEnabled).toBe(false);
      expect(result.current.isReduceMotionEnabled).toBe(false);
      expect(result.current.isBoldTextEnabled).toBe(false);
    });
  });

  it('returns true when screen reader is enabled', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const { result } = renderHook(() => useAccessibility());
    await waitFor(() => {
      expect(result.current.isScreenReaderEnabled).toBe(true);
    });
  });

  it('subscribes to accessibility events', () => {
    renderHook(() => useAccessibility());
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith('screenReaderChanged', expect.any(Function));
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith('boldTextChanged', expect.any(Function));
  });
});
