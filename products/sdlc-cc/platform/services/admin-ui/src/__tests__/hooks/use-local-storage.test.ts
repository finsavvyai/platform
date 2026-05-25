import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '@/hooks/use-local-storage'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useLocalStorage Hook', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  it('returns initial value when localStorage is empty', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'))

    expect(result.current.value).toBe('initial-value')
    expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key')
  })

  it('returns stored value from localStorage', () => {
    const storedValue = { name: 'John', age: 30 }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedValue))

    const { result } = renderHook(() => useLocalStorage('test-key', { name: '', age: 0 }))

    expect(result.current.value).toEqual(storedValue)
  })

  it('updates value and localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))

    act(() => {
      result.current.setValue('updated-value')
    })

    expect(result.current.value).toBe('updated-value')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('updated-value'))
  })

  it('removes value from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))

    act(() => {
      result.current.removeValue()
    })

    expect(result.current.value).toBe('initial')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
  })

  it('handles function updates', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useLocalStorage('counter', 0))

    act(() => {
      result.current.setValue((result.current.value as number) + 1)
    })

    expect(result.current.value).toBe(1)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('counter', JSON.stringify(1))
  })

  it('handles localStorage errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('Storage error')
    })

    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'))

    expect(result.current.value).toBe('fallback')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('handles JSON parsing errors', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    localStorageMock.getItem.mockReturnValue('invalid-json')

    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'))

    expect(result.current.value).toBe('fallback')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
