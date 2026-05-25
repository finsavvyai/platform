import { renderHook, act } from '@testing-library/react';
import { useDebounce, useLocalStorage, useKeyboardShortcut, useClickOutside } from './index';

// ============================================================================
// useDebounce
// ============================================================================

describe('useDebounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns the initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('hello', 500));
        expect(result.current).toBe('hello');
    });

    it('does not update the debounced value before the delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        rerender({ value: 'updated', delay: 500 });
        jest.advanceTimersByTime(300);
        expect(result.current).toBe('initial');
    });

    it('updates the debounced value after the delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        rerender({ value: 'updated', delay: 500 });
        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(result.current).toBe('updated');
    });

    it('resets timer on rapid value changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'a', delay: 300 } }
        );

        rerender({ value: 'b', delay: 300 });
        jest.advanceTimersByTime(200);
        rerender({ value: 'c', delay: 300 });
        jest.advanceTimersByTime(200);
        expect(result.current).toBe('a'); // still original

        act(() => {
            jest.advanceTimersByTime(100);
        });
        expect(result.current).toBe('c');
    });

    it('works with numeric values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 0, delay: 200 } }
        );

        rerender({ value: 42, delay: 200 });
        act(() => {
            jest.advanceTimersByTime(200);
        });
        expect(result.current).toBe(42);
    });

    it('works with object values', () => {
        const initial = { key: 'a' };
        const updated = { key: 'b' };
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: initial, delay: 100 } }
        );

        rerender({ value: updated, delay: 100 });
        act(() => {
            jest.advanceTimersByTime(100);
        });
        expect(result.current).toEqual({ key: 'b' });
    });

    it('cleans up timeout on unmount', () => {
        const { unmount } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'test', delay: 500 } }
        );

        unmount();
        // Should not throw when timers advance after unmount
        expect(() => jest.advanceTimersByTime(500)).not.toThrow();
    });
});

// ============================================================================
// useLocalStorage
// ============================================================================

describe('useLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    it('returns the initial value when storage is empty', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('default');
    });

    it('reads existing value from localStorage', () => {
        localStorage.setItem('test-key', JSON.stringify('stored'));
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
        expect(result.current[0]).toBe('stored');
    });

    it('sets a new value', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

        act(() => {
            result.current[1]('new-value');
        });

        expect(result.current[0]).toBe('new-value');
        expect(localStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
    });

    it('supports function updater pattern', () => {
        const { result } = renderHook(() => useLocalStorage<number>('count', 0));

        act(() => {
            result.current[1]((prev) => prev + 1);
        });

        expect(result.current[0]).toBe(1);
    });

    it('handles object values', () => {
        const initialObj = { name: 'test', count: 0 };
        const { result } = renderHook(() => useLocalStorage('obj-key', initialObj));

        act(() => {
            result.current[1]({ name: 'updated', count: 5 });
        });

        expect(result.current[0]).toEqual({ name: 'updated', count: 5 });
    });

    it('handles array values', () => {
        const { result } = renderHook(() => useLocalStorage<string[]>('arr-key', []));

        act(() => {
            result.current[1](['a', 'b', 'c']);
        });

        expect(result.current[0]).toEqual(['a', 'b', 'c']);
    });

    it('handles boolean values', () => {
        const { result } = renderHook(() => useLocalStorage('bool-key', false));

        act(() => {
            result.current[1](true);
        });

        expect(result.current[0]).toBe(true);
    });

    it('falls back to initial value on invalid JSON in storage', () => {
        // Force getItem to return invalid JSON
        (localStorage.getItem as jest.Mock).mockReturnValueOnce('not-valid-json{{{');
        const { result } = renderHook(() => useLocalStorage('bad-key', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });
});

// ============================================================================
// useKeyboardShortcut
// ============================================================================

describe('useKeyboardShortcut', () => {
    it('calls callback when matching key is pressed', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback));

        const event = new KeyboardEvent('keydown', { key: 'k' });
        window.dispatchEvent(event);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not call callback for non-matching key', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback));

        const event = new KeyboardEvent('keydown', { key: 'j' });
        window.dispatchEvent(event);

        expect(callback).not.toHaveBeenCalled();
    });

    it('requires ctrl modifier when specified', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['s'], callback, { ctrl: true }));

        // Without ctrl
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: false }));
        expect(callback).not.toHaveBeenCalled();

        // With ctrl
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('requires meta modifier when specified', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback, { meta: true }));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: false }));
        expect(callback).not.toHaveBeenCalled();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('requires shift modifier when specified', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['p'], callback, { shift: true }));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', shiftKey: false }));
        expect(callback).not.toHaveBeenCalled();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports multiple keys', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['escape', 'q'], callback));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(callback).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('is case-insensitive on key matching', () => {
        const callback = jest.fn();
        renderHook(() => useKeyboardShortcut(['k'], callback));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('cleans up event listener on unmount', () => {
        const callback = jest.fn();
        const { unmount } = renderHook(() => useKeyboardShortcut(['k'], callback));

        unmount();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
        expect(callback).not.toHaveBeenCalled();
    });

    it('uses latest callback via ref', () => {
        let counter = 0;
        const { rerender } = renderHook(
            ({ cb }) => useKeyboardShortcut(['k'], cb),
            { initialProps: { cb: () => { counter = 1; } } }
        );

        rerender({ cb: () => { counter = 2; } });

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
        expect(counter).toBe(2);
    });
});

// ============================================================================
// useClickOutside
// ============================================================================

describe('useClickOutside', () => {
    it('returns a ref object', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useClickOutside(callback));
        expect(result.current).toHaveProperty('current');
    });

    it('calls callback when clicking outside the referenced element', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useClickOutside(callback));

        // Create a DOM element and assign to ref
        const div = document.createElement('div');
        document.body.appendChild(div);
        Object.defineProperty(result.current, 'current', { value: div, writable: true });

        // Click outside
        const outsideEvent = new MouseEvent('mousedown', { bubbles: true });
        document.body.dispatchEvent(outsideEvent);

        expect(callback).toHaveBeenCalledTimes(1);

        document.body.removeChild(div);
    });

    it('does not call callback when clicking inside the referenced element', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useClickOutside(callback));

        const div = document.createElement('div');
        const child = document.createElement('span');
        div.appendChild(child);
        document.body.appendChild(div);
        Object.defineProperty(result.current, 'current', { value: div, writable: true });

        // Click inside (on child)
        const insideEvent = new MouseEvent('mousedown', { bubbles: true });
        child.dispatchEvent(insideEvent);

        expect(callback).not.toHaveBeenCalled();

        document.body.removeChild(div);
    });

    it('cleans up event listener on unmount', () => {
        const callback = jest.fn();
        const { unmount } = renderHook(() => useClickOutside(callback));

        unmount();

        const event = new MouseEvent('mousedown', { bubbles: true });
        document.body.dispatchEvent(event);

        expect(callback).not.toHaveBeenCalled();
    });

    it('uses latest callback via ref', () => {
        let value = 0;
        const { result, rerender } = renderHook(
            ({ cb }) => useClickOutside(cb),
            { initialProps: { cb: () => { value = 1; } } }
        );

        rerender({ cb: () => { value = 2; } });

        const div = document.createElement('div');
        document.body.appendChild(div);
        Object.defineProperty(result.current, 'current', { value: div, writable: true });

        const event = new MouseEvent('mousedown', { bubbles: true });
        document.body.dispatchEvent(event);

        expect(value).toBe(2);

        document.body.removeChild(div);
    });
});
