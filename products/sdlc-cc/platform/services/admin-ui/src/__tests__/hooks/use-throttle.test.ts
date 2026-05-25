import { act, renderHook } from '@testing-library/react'

import { useThrottledCallback } from '@/hooks/use-throttle'

describe('useThrottledCallback', () => {
  it('invokes the callback on leading edge', () => {
    const fn = jest.fn()
    const { result } = renderHook(() => useThrottledCallback(fn, 100))

    act(() => {
      result.current('a')
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith('a')
  })

  it('suppresses calls inside the throttle window', () => {
    const fn = jest.fn()
    const { result } = renderHook(() => useThrottledCallback(fn, 10_000))

    act(() => {
      result.current('a')
      result.current('b')
      result.current('c')
    })
    // Leading-edge only: one call for all three inside 10s window.
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('changes callback reference when deps change', () => {
    const fn = jest.fn()
    const { result, rerender } = renderHook(
      ({ d }) => useThrottledCallback(fn, 100, [d]),
      { initialProps: { d: 1 } },
    )

    const first = result.current
    rerender({ d: 2 })
    // new dep → new memoized callback reference
    expect(result.current).not.toBe(first)
  })
})
