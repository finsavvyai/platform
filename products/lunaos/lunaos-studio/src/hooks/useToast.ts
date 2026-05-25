/**
 * Toast notification hook — lightweight pub/sub for action feedback.
 * Supports success, error, and info variants with auto-dismiss.
 */

import { useState, useCallback, useRef } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

let nextToastId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 3000) => {
      const id = `toast_${nextToastId++}`;
      setToasts((prev) => [...prev, { id, message, variant }]);

      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  return { toasts, show, dismiss };
}
