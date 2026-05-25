import {
  capitalizeFirst,
  camelCase,
  cn,
  deepMerge,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatRelativeTime,
  generateId,
  getInitials,
  getRandomColor,
  isObject,
  isValidEmail,
  isValidUrl,
  kebabCase,
  slugify,
  truncateText,
} from '@/lib/utils'

describe('cn (class merger)', () => {
  it('joins truthy classes', () => {
    expect(cn('a', 'b', false && 'c', 'd')).toBe('a b d')
  })

  it('lets tailwind-merge resolve conflicts', () => {
    // twMerge should keep the last conflicting utility
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})

describe('date formatting', () => {
  it('formatDate uses long month', () => {
    const out = formatDate(new Date('2026-04-17T00:00:00Z'))
    expect(out).toMatch(/April/)
    expect(out).toMatch(/2026/)
  })

  it('formatDateTime includes hour', () => {
    const out = formatDateTime(new Date('2026-04-17T12:30:00Z'))
    expect(out).toMatch(/April/)
    expect(out).toMatch(/2026/)
  })

  it('formatRelativeTime: < 60s returns "just now"', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 5_000))).toBe('just now')
  })

  it('formatRelativeTime: minutes pluralized', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 60_000))).toBe('1 minute ago')
    expect(formatRelativeTime(new Date(now - 120_000))).toBe('2 minutes ago')
  })

  it('formatRelativeTime: hours pluralized', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 3_600_000))).toBe('1 hour ago')
  })

  it('formatRelativeTime: days pluralized', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 86_400_000))).toBe('1 day ago')
  })

  it('formatRelativeTime: >= 7 days falls back to formatDate', () => {
    const out = formatRelativeTime(new Date('2020-01-01T00:00:00Z'))
    expect(out).toMatch(/2020/)
  })
})

describe('format helpers', () => {
  it('formatFileSize: 0', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  it('formatFileSize: KB / MB / GB', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('formatCurrency: USD default', () => {
    expect(formatCurrency(1234.5)).toMatch(/\$1,234\.50/)
  })

  it('formatCurrency: EUR respects locale', () => {
    const out = formatCurrency(1234.5, 'EUR', 'de-DE')
    expect(out).toMatch(/1\.234,50/)
  })

  it('formatNumber', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })
})

describe('string helpers', () => {
  it('slugify lowercases and hyphenates', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('  messy __ input  ')).toBe('messy-input')
  })

  it('truncateText adds ellipsis only when long', () => {
    expect(truncateText('short', 10)).toBe('short')
    expect(truncateText('abcdefghij', 5)).toBe('abcde...')
  })

  it('capitalizeFirst', () => {
    expect(capitalizeFirst('hello')).toBe('Hello')
    expect(capitalizeFirst('')).toBe('')
  })

  it('kebabCase', () => {
    expect(kebabCase('camelCase')).toBe('camel-case')
    expect(kebabCase('snake_case')).toBe('snake-case')
    expect(kebabCase('spaces here')).toBe('spaces-here')
  })

  it('camelCase', () => {
    expect(camelCase('hello world')).toBe('helloWorld')
    expect(camelCase('foo bar baz')).toBe('fooBarBaz')
  })

  it('getInitials returns up to 2 chars uppercased', () => {
    expect(getInitials('alice bob')).toBe('AB')
    expect(getInitials('alice bob carol')).toBe('AB')
    expect(getInitials('alice')).toBe('A')
  })
})

describe('validators', () => {
  it.each([
    ['alice@example.com', true],
    ['plain', false],
    ['a@b.c', true],
    ['a@b', false],
  ])('isValidEmail(%s) === %s', (email, want) => {
    expect(isValidEmail(email as string)).toBe(want)
  })

  it.each([
    ['https://example.com', true],
    ['http://sub.example.co.uk/path?x=1', true],
    ['not a url', false],
    ['/relative', false],
  ])('isValidUrl(%s) === %s', (url, want) => {
    expect(isValidUrl(url as string)).toBe(want)
  })
})

describe('misc', () => {
  it('generateId returns short string', () => {
    const a = generateId()
    const b = generateId()
    expect(a).toMatch(/^[a-z0-9]+$/)
    expect(a).not.toBe(b)
  })

  it('getRandomColor returns a tailwind class', () => {
    expect(getRandomColor()).toMatch(/^bg-(red|blue|green|yellow|purple|pink|indigo|teal)-500$/)
  })

  it('isObject rejects arrays and null', () => {
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(42)).toBe(false)
  })

  it('deepMerge merges nested without mutating the target', () => {
    const target = { a: 1, nested: { b: 2, c: 3 } }
    const source = { nested: { c: 4, d: 5 } }
    const out = deepMerge(target as any, source as any)
    expect(out).toEqual({ a: 1, nested: { b: 2, c: 4, d: 5 } })
    // target remains unchanged
    expect(target.nested).toEqual({ b: 2, c: 3 })
  })

  it('deepMerge replaces non-object values outright', () => {
    const out = deepMerge({ x: [1, 2] } as any, { x: [3] } as any)
    expect(out.x).toEqual([3])
  })
})
