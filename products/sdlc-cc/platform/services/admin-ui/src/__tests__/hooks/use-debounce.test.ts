import { act, renderHook } from '@testing-library/react'

import {
  useDebounce,
  useDebouncedCallback,
  useDebouncedValue,
} from '@/hooks/use-debounce'

jest.useFakeTimers()

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 100))
    expect(result.current).toBe('hello')
  })

  it('debounces subsequent updates', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 200),
      { initialProps: { v: 'a' } },
    )

    rerender({ v: 'b' })
    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(199)
    })
    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('resets the timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 200),
      { initialProps: { v: 'a' } },
    )

    rerender({ v: 'b' })
    act(() => { jest.advanceTimersByTime(150) })
    rerender({ v: 'c' })
    act(() => { jest.advanceTimersByTime(150) })
    // only 150ms since last change — still 'a'
    expect(result.current).toBe('a')

    act(() => { jest.advanceTimersByTime(50) })
    expect(result.current).toBe('c')
  })
})

describe('useDebouncedCallback', () => {
  it('invokes the callback once after the delay', () => {
    const fn = jest.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 100))

    act(() => {
      result.current('x')
      result.current('y')
      result.current('z')
    })
    expect(fn).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith('z')
  })

  it('clears the timer on unmount', () => {
    const fn = jest.fn()
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(fn, 100),
    )

    act(() => {
      result.current('x')
    })
    unmount()
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('useDebouncedValue', () => {
  it('exposes isDebouncing during the wait window', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 150),
      { initialProps: { v: 'a' } },
    )

    expect(result.current.debouncedValue).toBe('a')
    expect(result.current.isDebouncing).toBe(false)

    rerender({ v: 'b' })
    expect(result.current.isDebouncing).toBe(true)

    act(() => {
      jest.advanceTimersByTime(150)
    })
    expect(result.current.debouncedValue).toBe('b')
    expect(result.current.isDebouncing).toBe(false)
  })
})
