import {
    cn,
    formatDate,
    formatRelativeTime,
    truncate,
    capitalize,
    formatNumber,
    formatBytes,
    sleep,
    debounce,
    throttle,
    isClient,
    isServer,
    generateId,
    createUrl,
    isValidEmail,
    getInitials,
    parseErrorMessage,
} from './utils';

// ============================================================================
// cn
// ============================================================================

describe('cn', () => {
    it('merges simple class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
        expect(cn('base', false && 'hidden', 'end')).toBe('base end');
    });

    it('resolves tailwind conflicts (last wins)', () => {
        const result = cn('p-4', 'p-2');
        expect(result).toBe('p-2');
    });

    it('returns empty string for no input', () => {
        expect(cn()).toBe('');
    });

    it('handles undefined and null values', () => {
        expect(cn('a', undefined, null, 'b')).toBe('a b');
    });

    it('handles array inputs', () => {
        expect(cn(['foo', 'bar'])).toBe('foo bar');
    });
});

// ============================================================================
// formatDate
// ============================================================================

describe('formatDate', () => {
    it('formats a Date object', () => {
        const d = new Date('2026-01-15T00:00:00Z');
        const result = formatDate(d);
        expect(result).toContain('Jan');
        expect(result).toContain('15');
        expect(result).toContain('2026');
    });

    it('formats an ISO string', () => {
        const result = formatDate('2026-06-20T12:00:00Z');
        expect(result).toContain('Jun');
        expect(result).toContain('20');
        expect(result).toContain('2026');
    });

    it('respects custom options', () => {
        const result = formatDate('2026-03-05', { month: 'long' });
        expect(result).toContain('March');
    });

    it('handles edge date (epoch)', () => {
        const result = formatDate(new Date(0));
        expect(result).toContain('1970');
    });
});

// ============================================================================
// formatRelativeTime
// ============================================================================

describe('formatRelativeTime', () => {
    it('returns "just now" for very recent timestamps', () => {
        const now = new Date();
        expect(formatRelativeTime(now)).toBe('just now');
    });

    it('returns minutes ago', () => {
        const d = new Date(Date.now() - 5 * 60 * 1000);
        expect(formatRelativeTime(d)).toBe('5m ago');
    });

    it('returns hours ago', () => {
        const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
        expect(formatRelativeTime(d)).toBe('3h ago');
    });

    it('returns days ago', () => {
        const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        expect(formatRelativeTime(d)).toBe('2d ago');
    });

    it('falls back to formatted date for > 7 days', () => {
        const d = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const result = formatRelativeTime(d);
        // Should not contain "ago" — it uses formatDate fallback
        expect(result).not.toContain('ago');
    });

    it('accepts ISO string', () => {
        const d = new Date(Date.now() - 90 * 1000).toISOString();
        expect(formatRelativeTime(d)).toBe('1m ago');
    });

    it('returns "just now" for 30 seconds ago', () => {
        const d = new Date(Date.now() - 30 * 1000);
        expect(formatRelativeTime(d)).toBe('just now');
    });

    it('boundary: exactly 60 seconds ago shows 1m ago', () => {
        const d = new Date(Date.now() - 60 * 1000);
        expect(formatRelativeTime(d)).toBe('1m ago');
    });
});

// ============================================================================
// truncate
// ============================================================================

describe('truncate', () => {
    it('returns the string unchanged if within limit', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates and appends ellipsis', () => {
        expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('handles exact boundary (length === maxLength)', () => {
        expect(truncate('abc', 3)).toBe('abc');
    });

    it('handles maxLength shorter than 3', () => {
        // When maxLength < string length, truncate slices to (maxLength - 3) + "..."
        // For maxLength=2: slice(0, -1) => "hell" + "..." => "hell..." (7 chars)
        // This is an edge case where the function does not clamp output length
        const result = truncate('hello', 2);
        expect(result).toContain('...');
    });

    it('handles empty string', () => {
        expect(truncate('', 5)).toBe('');
    });
});

// ============================================================================
// capitalize
// ============================================================================

describe('capitalize', () => {
    it('capitalizes the first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
    });

    it('handles already capitalized string', () => {
        expect(capitalize('Hello')).toBe('Hello');
    });

    it('handles single character', () => {
        expect(capitalize('a')).toBe('A');
    });

    it('handles empty string', () => {
        expect(capitalize('')).toBe('');
    });

    it('does not change rest of string', () => {
        expect(capitalize('hELLO')).toBe('HELLO');
    });
});

// ============================================================================
// formatNumber
// ============================================================================

describe('formatNumber', () => {
    it('formats thousands with commas', () => {
        expect(formatNumber(1000)).toBe('1,000');
    });

    it('formats millions', () => {
        expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('leaves small numbers unchanged', () => {
        expect(formatNumber(42)).toBe('42');
    });

    it('handles zero', () => {
        expect(formatNumber(0)).toBe('0');
    });

    it('handles negative numbers', () => {
        const result = formatNumber(-1234);
        expect(result).toContain('1,234');
        expect(result).toContain('-');
    });
});

// ============================================================================
// formatBytes
// ============================================================================

describe('formatBytes', () => {
    it('returns "0 Bytes" for zero', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('formats bytes', () => {
        expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('formats kilobytes', () => {
        expect(formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
        expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('formats gigabytes', () => {
        expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('formats terabytes', () => {
        expect(formatBytes(1099511627776)).toBe('1 TB');
    });

    it('respects decimal places', () => {
        expect(formatBytes(1536, 1)).toBe('1.5 KB');
    });

    it('handles negative decimals parameter (clamps to 0)', () => {
        expect(formatBytes(1536, -1)).toBe('2 KB');
    });
});

// ============================================================================
// sleep
// ============================================================================

describe('sleep', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves after the specified duration', async () => {
        const promise = sleep(1000);
        jest.advanceTimersByTime(1000);
        await expect(promise).resolves.toBeUndefined();
    });

    it('does not resolve before the specified duration', () => {
        let resolved = false;
        sleep(500).then(() => {
            resolved = true;
        });
        jest.advanceTimersByTime(499);
        expect(resolved).toBe(false);
    });
});

// ============================================================================
// debounce
// ============================================================================

describe('debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('delays function execution', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 300);
        debounced();
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(300);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets delay on subsequent calls', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 300);

        debounced();
        jest.advanceTimersByTime(200);
        debounced(); // reset timer
        jest.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to the original function', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced('a', 'b');
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('a', 'b');
    });

    it('uses the latest arguments when called multiple times', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced('first');
        debounced('second');
        debounced('third');
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('third');
    });
});

// ============================================================================
// throttle
// ============================================================================

describe('throttle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('invokes immediately on first call', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 300);
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('suppresses calls within throttle window', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 300);
        throttled();
        throttled();
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('allows call after throttle window expires', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 300);
        throttled();
        jest.advanceTimersByTime(300);
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('passes arguments correctly', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);
        throttled('arg1');
        expect(fn).toHaveBeenCalledWith('arg1');
    });
});

// ============================================================================
// isClient / isServer
// ============================================================================

describe('isClient', () => {
    it('returns true in jsdom environment', () => {
        expect(isClient()).toBe(true);
    });
});

describe('isServer', () => {
    it('returns false in jsdom environment', () => {
        expect(isServer()).toBe(false);
    });
});

// ============================================================================
// generateId
// ============================================================================

describe('generateId', () => {
    it('generates a string of default length 12', () => {
        const id = generateId();
        expect(id).toHaveLength(12);
    });

    it('generates a string of custom length', () => {
        expect(generateId(6)).toHaveLength(6);
        expect(generateId(20)).toHaveLength(20);
    });

    it('generates only alphanumeric characters', () => {
        const id = generateId(100);
        expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('generates unique ids', () => {
        const ids = new Set(Array.from({ length: 50 }, () => generateId()));
        expect(ids.size).toBe(50);
    });

    it('handles length 0', () => {
        expect(generateId(0)).toBe('');
    });
});

// ============================================================================
// createUrl
// ============================================================================

describe('createUrl', () => {
    it('appends query params to path', () => {
        const url = createUrl('/api/search', { q: 'hello', page: 1 });
        expect(url).toContain('/api/search');
        expect(url).toContain('q=hello');
        expect(url).toContain('page=1');
    });

    it('omits undefined values', () => {
        const url = createUrl('/api/data', { a: 'yes', b: undefined });
        expect(url).toContain('a=yes');
        expect(url).not.toContain('b=');
    });

    it('handles boolean values', () => {
        const url = createUrl('/path', { active: true });
        expect(url).toContain('active=true');
    });

    it('handles empty params', () => {
        const url = createUrl('/path', {});
        expect(url).toBe('/path');
    });

    it('handles path with existing structure', () => {
        const url = createUrl('/api/v1/items', { limit: 10 });
        expect(url).toContain('/api/v1/items');
        expect(url).toContain('limit=10');
    });
});

// ============================================================================
// isValidEmail
// ============================================================================

describe('isValidEmail', () => {
    it('accepts valid email', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('accepts email with subdomain', () => {
        expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
    });

    it('accepts email with plus', () => {
        expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('rejects email without @', () => {
        expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('rejects email without domain', () => {
        expect(isValidEmail('user@')).toBe(false);
    });

    it('rejects email without local part', () => {
        expect(isValidEmail('@example.com')).toBe(false);
    });

    it('rejects email with spaces', () => {
        expect(isValidEmail('user @example.com')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidEmail('')).toBe(false);
    });

    it('rejects email without TLD', () => {
        expect(isValidEmail('user@example')).toBe(false);
    });
});

// ============================================================================
// getInitials
// ============================================================================

describe('getInitials', () => {
    it('returns two-letter initials for full name', () => {
        expect(getInitials('John Doe')).toBe('JD');
    });

    it('returns single letter for single name', () => {
        expect(getInitials('Alice')).toBe('A');
    });

    it('returns max two letters for long names', () => {
        expect(getInitials('John Michael Doe')).toBe('JM');
    });

    it('uppercases initials', () => {
        expect(getInitials('john doe')).toBe('JD');
    });
});

// ============================================================================
// parseErrorMessage
// ============================================================================

describe('parseErrorMessage', () => {
    it('returns a string error as-is', () => {
        expect(parseErrorMessage('something went wrong')).toBe('something went wrong');
    });

    it('extracts message from Error instance', () => {
        expect(parseErrorMessage(new Error('fail'))).toBe('fail');
    });

    it('extracts message from object with message property', () => {
        expect(parseErrorMessage({ message: 'oops' })).toBe('oops');
    });

    it('extracts error from object with error property', () => {
        expect(parseErrorMessage({ error: 'bad request' })).toBe('bad request');
    });

    it('prefers message over error property', () => {
        expect(parseErrorMessage({ message: 'msg', error: 'err' })).toBe('msg');
    });

    it('returns default message for null', () => {
        expect(parseErrorMessage(null)).toBe('An unknown error occurred');
    });

    it('returns default message for undefined', () => {
        expect(parseErrorMessage(undefined)).toBe('An unknown error occurred');
    });

    it('returns default message for number', () => {
        expect(parseErrorMessage(42)).toBe('An unknown error occurred');
    });

    it('returns default message for empty object', () => {
        expect(parseErrorMessage({})).toBe('An unknown error occurred');
    });
});
