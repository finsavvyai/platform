import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';

interface Options {
  enabled?: boolean;
  onEscape?: () => void;
  initialFocus?: 'first' | 'last';
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  { enabled = true, onEscape, initialFocus = 'first' }: Options = {},
): void {
  useEffect(() => {
    if (!enabled) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const items = () =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      );
    const initial = items();
    if (initial.length > 0) {
      (initialFocus === 'last' ? initial[initial.length - 1] : initial[0])?.focus();
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = items();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [containerRef, enabled, onEscape, initialFocus]);
}
