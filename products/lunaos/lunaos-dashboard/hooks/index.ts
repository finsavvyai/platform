'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// UTILITY HOOKS — LunaOS Dashboard
// ============================================================================

/**
 * Hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook for local storage with SSR support
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            setStoredValue((prev) => {
                const newValue = value instanceof Function ? value(prev) : value;
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(newValue));
                }
                return newValue;
            });
        },
        [key]
    );

    return [storedValue, setValue];
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
    keys: string[],
    callback: () => void,
    options?: { ctrl?: boolean; meta?: boolean; shift?: boolean }
) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const key = e.key.toLowerCase();
            if (!keys.includes(key)) return;
            if (options?.ctrl && !e.ctrlKey) return;
            if (options?.meta && !e.metaKey) return;
            if (options?.shift && !e.shiftKey) return;
            e.preventDefault();
            callbackRef.current();
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keys, options?.ctrl, options?.meta, options?.shift]);
}

/**
 * Hook for click outside detection
 */
export function useClickOutside(callback: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                callbackRef.current();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return ref;
}
