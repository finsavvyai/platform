// Throttle hook for React

import * as React from 'react';

export function useThrottle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): T {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExecRef = React.useRef<number>(0);

  return React.useCallback((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastExecRef.current > delay) {
      lastExecRef.current = now;
      func(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        lastExecRef.current = Date.now();
        func(...args);
      }, delay - (now - lastExecRef.current));
    }
  }, [func, delay]) as T;
}
