/**
 * LunaOS Hooks — Unit Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useDebounce, useLocalStorage, useClickOutside, useKeyboardShortcut } from '../index';

describe('useDebounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('returns initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('hello', 500));
        expect(result.current).toBe('hello');
    });

    test('debounces value updates', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'hello', delay: 500 } }
        );

        expect(result.current).toBe('hello');

        // Update value
        rerender({ value: 'world', delay: 500 });

        // Should still be old value before delay
        expect(result.current).toBe('hello');

        // Fast-forward time
        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(result.current).toBe('world');
    });

    test('resets timer on rapid updates', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'a', delay: 300 } }
        );

        rerender({ value: 'b', delay: 300 });
        act(() => { jest.advanceTimersByTime(100); });

        rerender({ value: 'c', delay: 300 });
        act(() => { jest.advanceTimersByTime(100); });

        // Should still be 'a' — timer keeps resetting
        expect(result.current).toBe('a');

        // Wait full delay from last update
        act(() => { jest.advanceTimersByTime(300); });
        expect(result.current).toBe('c');
    });
});

describe('useLocalStorage', () => {
    test('returns initial value when nothing in storage', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('default');
    });

    test('returns stored value from localStorage', () => {
        (localStorage.getItem as jest.Mock).mockReturnValueOnce(JSON.stringify('stored-value'));
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('stored-value');
    });

    test('updates value and persists to localStorage', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

        act(() => {
            result.current[1]('new-value');
        });

        expect(result.current[0]).toBe('new-value');
        expect(localStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
    });

    test('supports function updater pattern', () => {
        const { result } = renderHook(() => useLocalStorage('counter', 0));

        act(() => {
            result.current[1]((prev: number) => prev + 1);
        });

        expect(result.current[0]).toBe(1);
    });

    test('handles invalid JSON in localStorage gracefully', () => {
        (localStorage.getItem as jest.Mock).mockReturnValueOnce('not-valid-json{{{');
        const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });
});

describe('useClickOutside', () => {
    test('returns a ref', () => {
        const { result } = renderHook(() => useClickOutside(jest.fn()));
        expect(result.current).toHaveProperty('current');
    });

    test('calls callback when clicking outside the ref element', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useClickOutside(callback));

        // Create a mock element and attach the ref
        const div = document.createElement('div');
        Object.defineProperty(result.current, 'current', { value: div, writable: true });

        // Simulate click outside
        const outsideEvent = new MouseEvent('mousedown', { bubbles: true });
        document.dispatchEvent(outsideEvent);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('does not call callback when clicking inside the ref element', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useClickOutside(callback));

        const div = document.createElement('div');
        const child = document.createElement('span');
        div.appendChild(child);
        document.body.appendChild(div);
        Object.defineProperty(result.current, 'current', { value: div, writable: true });

        // Simulate click on child (inside)
        const insideEvent = new MouseEvent('mousedown', { bubbles: true });
        child.dispatchEvent(insideEvent);

        expect(callback).not.toHaveBeenCalled();

        // Cleanup
        document.body.removeChild(div);
    });
});

describe('useKeyboardShortcut', () => {
    test('calls callback when matching key is pressed', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback));

        const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true });
        window.dispatchEvent(event);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('does not call callback for non-matching keys', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback));

        const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true });
        window.dispatchEvent(event);

        expect(callback).not.toHaveBeenCalled();
    });

    test('requires ctrl modifier when specified', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback, { ctrl: true }));

        // Without ctrl — should not fire
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
        expect(callback).not.toHaveBeenCalled();

        // With ctrl — should fire
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('requires meta modifier when specified', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback, { meta: true }));

        // Without meta — should not fire
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
        expect(callback).not.toHaveBeenCalled();

        // With meta — should fire
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('requires shift modifier when specified', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback, { shift: true }));

        // Without shift — should not fire
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
        expect(callback).not.toHaveBeenCalled();

        // With shift — should fire
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', shiftKey: true, bubbles: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('matches case-insensitively', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', bubbles: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('supports multiple key bindings', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k', 'escape'], callback));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(callback).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
        expect(callback).toHaveBeenCalledTimes(2);
    });

    test('cleans up event listener on unmount', () => {
        const callback = jest.fn();
        const { unmount } = renderHook(() => useKeyboardShortcut(['k'], callback));

        unmount();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
        expect(callback).not.toHaveBeenCalled();
    });
});
