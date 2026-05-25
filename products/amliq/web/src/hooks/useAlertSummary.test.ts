import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAlertSummary } from './useAlertSummary'
import { createMockAlert } from '../test/utils'

vi.mock('../api/ai', () => ({
  fetchAlertSummary: vi.fn(),
}))

import { fetchAlertSummary } from '../api/ai'

const mockFetchAlertSummary = vi.mocked(fetchAlertSummary)

describe('useAlertSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in idle state', () => {
    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))
    expect(result.current.state.status).toBe('idle')
  })

  it('exposes a generate function', () => {
    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))
    expect(typeof result.current.generate).toBe('function')
  })

  it('transitions to loading state when generate is called', async () => {
    mockFetchAlertSummary.mockReturnValue(new Promise(() => {}))
    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))

    act(() => {
      result.current.generate()
    })

    expect(result.current.state.status).toBe('loading')
  })

  it('transitions to done state with summary and model on success', async () => {
    mockFetchAlertSummary.mockResolvedValue({
      summary: 'This is a risk summary.',
      model: 'claude-sonnet-4-6',
    })
    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))

    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.state.status).toBe('done')
    if (result.current.state.status === 'done') {
      expect(result.current.state.summary).toBe('This is a risk summary.')
      expect(result.current.state.model).toBe('claude-sonnet-4-6')
    }
  })

  it('transitions to error state when fetchAlertSummary rejects with Error', async () => {
    mockFetchAlertSummary.mockRejectedValue(new Error('Endpoint unavailable'))
    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))

    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.state.status).toBe('error')
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toBe('Endpoint unavailable')
    }
  })

  it('uses fallback message when a non-Error is thrown', async () => {
    mockFetchAlertSummary.mockRejectedValue('unexpected failure')
    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))

    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.state.status).toBe('error')
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toBe('Failed to generate summary')
    }
  })

  it('can regenerate after a successful response', async () => {
    mockFetchAlertSummary
      .mockResolvedValueOnce({ summary: 'First summary', model: 'model-a' })
      .mockResolvedValueOnce({ summary: 'Second summary', model: 'model-b' })

    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))

    await act(async () => {
      await result.current.generate()
    })
    expect(result.current.state.status).toBe('done')

    await act(async () => {
      await result.current.generate()
    })

    if (result.current.state.status === 'done') {
      expect(result.current.state.summary).toBe('Second summary')
    }
    expect(mockFetchAlertSummary).toHaveBeenCalledTimes(2)
  })

  it('calls fetchAlertSummary with the alert', async () => {
    mockFetchAlertSummary.mockResolvedValue({ summary: 'ok', model: 'x' })
    const alert = createMockAlert({ id: 'alert-42' })
    const { result } = renderHook(() => useAlertSummary(alert))

    await act(async () => {
      await result.current.generate()
    })

    expect(mockFetchAlertSummary).toHaveBeenCalledWith(alert)
  })

  it('can recover from error by calling generate again', async () => {
    mockFetchAlertSummary
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({ summary: 'Recovered', model: 'model-x' })

    const alert = createMockAlert()
    const { result } = renderHook(() => useAlertSummary(alert))

    await act(async () => {
      await result.current.generate()
    })
    expect(result.current.state.status).toBe('error')

    await act(async () => {
      await result.current.generate()
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('done')
    })
  })
})
