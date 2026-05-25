import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce } from './useDebounce'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial'))
    expect(result.current).toBe('initial')
  })

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'first' } }
    )

    expect(result.current).toBe('first')

    rerender({ value: 'second' })
    expect(result.current).toBe('first')

    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('second')
  })

  it('respects custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    )

    rerender({ value: 'updated' })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('initial')

    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('updated')
  })

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'start' } }
    )

    rerender({ value: 'end' })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('end')
  })

  it('cancels previous timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'c' })
    act(() => { vi.advanceTimersByTime(100) })

    expect(result.current).toBe('a')

    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('c')
  })

  it('works with different types', () => {
    const numberHook = renderHook(() => useDebounce(42, 300))
    expect(numberHook.result.current).toBe(42)

    const objectHook = renderHook(() => useDebounce({ key: 'value' }, 300))
    expect(objectHook.result.current).toEqual({ key: 'value' })
  })
})
