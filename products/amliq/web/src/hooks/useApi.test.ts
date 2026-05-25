import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useApi } from './useApi'

describe('useApi', () => {
  it('sets initial loading state to true', () => {
    const fetchFn = vi.fn(() => new Promise<any>(() => {}))
    const { result } = renderHook(() => useApi(fetchFn))
    expect(result.current.loading).toBe(true)
  })

  it('fetches data successfully', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useApi(fetchFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual({ data: 'test' })
    expect(result.current.error).toBeNull()
  })

  it('handles fetch errors', async () => {
    const error = new Error('Network error')
    const fetchFn = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useApi(fetchFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual(error)
  })

  it('converts non-Error objects to Error', async () => {
    const fetchFn = vi.fn().mockRejectedValue('string error')
    const { result } = renderHook(() => useApi(fetchFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('string error')
  })

  it('respects dependencies array', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ id: 1 })
    const { rerender } = renderHook(
      ({ id }) => useApi(fetchFn, [id]),
      { initialProps: { id: 1 } }
    )

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    rerender({ id: 1 })
    expect(fetchFn).toHaveBeenCalledTimes(1)

    rerender({ id: 2 })
    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  it('provides refetch function', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ value: 1 })
    const { result } = renderHook(() => useApi(fetchFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})
