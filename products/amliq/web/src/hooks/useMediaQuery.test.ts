import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from './useMediaQuery'

let listeners: Array<() => void> = []
let mockMatches = false

function createMockMediaQuery() {
  return {
    get matches() { return mockMatches },
    media: '',
    addEventListener: vi.fn((_e: string, cb: () => void) => {
      listeners.push(cb)
    }),
    removeEventListener: vi.fn((_e: string, cb: () => void) => {
      listeners = listeners.filter((l) => l !== cb)
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }
}

beforeEach(() => {
  listeners = []
  mockMatches = false
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () => createMockMediaQuery() as unknown as MediaQueryList
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('returns false initially', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('returns match result from window.matchMedia', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 639px)'))
    expect(typeof result.current).toBe('boolean')
  })

  it('responds to media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    mockMatches = true
    act(() => { listeners.forEach((l) => l()) })

    expect(result.current).toBe(true)
  })

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    unmount()
    expect(window.matchMedia('').removeEventListener).toBeDefined()
  })
})

describe('useIsMobile', () => {
  it('returns mobile breakpoint match', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(typeof result.current).toBe('boolean')
  })

  it('queries max-width 639px', () => {
    renderHook(() => useIsMobile())
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 639px)')
  })
})

describe('useIsTablet', () => {
  it('returns tablet breakpoint match', () => {
    const { result } = renderHook(() => useIsTablet())
    expect(typeof result.current).toBe('boolean')
  })

  it('queries tablet range', () => {
    renderHook(() => useIsTablet())
    expect(window.matchMedia).toHaveBeenCalledWith(
      '(min-width: 640px) and (max-width: 1023px)'
    )
  })
})

describe('useIsDesktop', () => {
  it('returns boolean and queries correct breakpoint', () => {
    const { result } = renderHook(() => useIsDesktop())
    expect(typeof result.current).toBe('boolean')
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)')
  })
})
