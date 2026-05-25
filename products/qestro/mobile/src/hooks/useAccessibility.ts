import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

interface AccessibilityState {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isBoldTextEnabled: boolean;
}

export function useAccessibility(): AccessibilityState {
  const [state, setState] = useState<AccessibilityState>({
    isScreenReaderEnabled: false,
    isReduceMotionEnabled: false,
    isBoldTextEnabled: false,
  });

  useEffect(() => {
    Promise.all([
      AccessibilityInfo.isScreenReaderEnabled(),
      AccessibilityInfo.isReduceMotionEnabled(),
      AccessibilityInfo.isBoldTextEnabled(),
    ]).then(([screen, motion, bold]) => {
      setState({ isScreenReaderEnabled: screen, isReduceMotionEnabled: motion, isBoldTextEnabled: bold });
    });

    const subs = [
      AccessibilityInfo.addEventListener('screenReaderChanged', (v) => setState((s) => ({ ...s, isScreenReaderEnabled: v }))),
      AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setState((s) => ({ ...s, isReduceMotionEnabled: v }))),
      AccessibilityInfo.addEventListener('boldTextChanged', (v) => setState((s) => ({ ...s, isBoldTextEnabled: v }))),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return state;
}
