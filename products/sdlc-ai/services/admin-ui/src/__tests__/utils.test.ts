import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatFileSize,
  formatCurrency,
  isValidEmail,
  isValidUrl,
  getInitials,
  slugify,
  truncateText,
  debounce,
  throttle,
} from '@/lib/utils'

describe('Utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
    })

    it('handles conditional classes', () => {
      expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
    })

    it('deduplicates conflicting classes', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })
  })

  describe('formatDate', () => {
    it('formats date correctly', () => {
      const date = new Date('2024-01-15')
      const result = formatDate(date)
      expect(result).toMatch(/January 15, 2024/)
    })

    it('handles string dates', () => {
      const result = formatDate('2024-01-15')
      expect(result).toMatch(/January 15, 2024/)
    })

    it('handles timestamp', () => {
      const timestamp = new Date('2024-01-15').getTime()
      const result = formatDate(timestamp)
      expect(result).toMatch(/January 15, 2024/)
    })
  })

  describe('formatDateTime', () => {
    it('formats date and time correctly', () => {
      const date = new Date('2024-01-15T14:30:00')
      const result = formatDateTime(date)
      expect(result).toMatch(/January 15, 2024.*14:30/)
    })
  })

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15T12:00:00'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('shows "just now" for very recent times', () => {
      const result = formatRelativeTime(new Date('2024-01-15T11:59:30'))
      expect(result).toBe('just now')
    })

    it('shows minutes ago', () => {
      const result = formatRelativeTime(new Date('2024-01-15T11:55:00'))
      expect(result).toBe('5 minutes ago')
    })

    it('shows hours ago', () => {
      const result = formatRelativeTime(new Date('2024-01-15T08:00:00'))
      expect(result).toBe('4 hours ago')
    })

    it('shows days ago', () => {
      const result = formatRelativeTime(new Date('2024-01-13T12:00:00'))
      expect(result).toBe('2 days ago')
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })

    it('handles decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(2621440)).toBe('2.5 MB')
    })
  })

  describe('formatCurrency', () => {
    it('formats USD correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })

    it('handles different currencies', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56')
    })

    it('handles different locales', () => {
      expect(formatCurrency(1234.56, 'USD', 'de-DE')).toBe('1.234,56 $')
    })
  })

  describe('isValidEmail', () => {
    it('validates correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true)
    })

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('test.example.com')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('validates correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://localhost:3000')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('www.example.com')).toBe(false)
    })
  })

  describe('getInitials', () => {
    it('gets initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD')
      expect(getInitials('Mary Jane Watson')).toBe('MJ')
    })

    it('handles single name', () => {
      expect(getInitials('John')).toBe('J')
    })

    it('handles empty string', () => {
      expect(getInitials('')).toBe('')
    })
  })

  describe('slugify', () => {
    it('converts string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world')
      expect(slugify('This is a Test!')).toBe('this-is-a-test')
    })

    it('handles special characters', () => {
      expect(slugify('Hello @ World #123')).toBe('hello-world-123')
    })
  })

  describe('truncateText', () => {
    it('truncates long text', () => {
      expect(truncateText('This is a very long text', 10)).toBe('This is a...')
    })

    it('returns short text unchanged', () => {
      expect(truncateText('Short', 10)).toBe('Short')
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('delays function execution', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      expect(mockFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('cancels previous calls', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      jest.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('limits function execution rate', () => {
      const mockFn = jest.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(1)

      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(100)
      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(2)
    })
  })
})
