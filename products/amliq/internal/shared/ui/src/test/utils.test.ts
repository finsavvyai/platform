/**
 * Utility functions tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatFileSize,
  formatPercentage,
  generateId,
  debounce,
  throttle,
  deepClone,
  isEmpty,
  capitalize,
  truncate,
  getInitials,
  isValidEmail,
  isValidPhone,
  stringToColor,
  copyToClipboard,
  getScrollPosition,
  scrollToElement,
  isInViewport,
  getBreakpoint,
  isMobile,
  isTablet,
  isDesktop,
} from '../../lib/utils';

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  describe('cn (className utility)', () => {
    it('merges class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('handles conditional classes', () => {
      expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2');
    });

    it('handles undefined and null values', () => {
      expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
    });

    it('handles empty strings', () => {
      expect(cn('class1', '', 'class2')).toBe('class1 class2');
    });

    it('handles arrays and objects', () => {
      expect(cn(['class1', 'class2'], { class3: true, class4: false })).toBe('class1 class2 class3');
    });
  });

  describe('formatCurrency', () => {
    it('formats default USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats different currencies', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
      expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,235');
    });

    it('formats with different locales', () => {
      expect(formatCurrency(1234.56, 'USD', 'de-DE')).toBe('1.234,56 $');
    });

    it('handles zero values', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles negative values', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });

    it('handles large numbers', () => {
      expect(formatCurrency(1234567890.99)).toBe('$1,234,567,890.99');
    });

    it('handles decimal places correctly', () => {
      expect(formatCurrency(1234.5)).toBe('$1,234.50');
      expect(formatCurrency(1234.567)).toBe('$1,234.57');
    });
  });

  describe('formatDate', () => {
    it('formats date strings', () => {
      expect(formatDate('2023-12-25')).toBe('Dec 25, 2023');
    });

    it('formats date objects', () => {
      const date = new Date(2023, 11, 25);
      expect(formatDate(date)).toBe('Dec 25, 2023');
    });

    it('uses different locales', () => {
      expect(formatDate('2023-12-25', 'de-DE')).toBe('25. Dez. 2023');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2023-12-25T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "just now" for recent times', () => {
      const recentTime = new Date('2023-12-25T11:59:30Z');
      expect(formatRelativeTime(recentTime)).toBe('just now');
    });

    it('shows minutes ago', () => {
      const minutesAgo = new Date('2023-12-25T11:55:00Z');
      expect(formatRelativeTime(minutesAgo)).toBe('5 minutes ago');
    });

    it('shows hours ago', () => {
      const hoursAgo = new Date('2023-12-25T08:00:00Z');
      expect(formatRelativeTime(hoursAgo)).toBe('4 hours ago');
    });

    it('shows days ago', () => {
      const daysAgo = new Date('2023-12-20T12:00:00Z');
      expect(formatRelativeTime(daysAgo)).toBe('5 days ago');
    });

    it('shows months ago', () => {
      const monthsAgo = new Date('2023-10-25T12:00:00Z');
      expect(formatRelativeTime(monthsAgo)).toBe('2 months ago');
    });

    it('shows years ago', () => {
      const yearsAgo = new Date('2021-12-25T12:00:00Z');
      expect(formatRelativeTime(yearsAgo)).toBe('2 years ago');
    });

    it('handles singular forms correctly', () => {
      const oneMinuteAgo = new Date('2023-12-25T11:59:00Z');
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');

      const oneHourAgo = new Date('2023-12-25T11:00:00Z');
      expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');

      const oneDayAgo = new Date('2023-12-24T12:00:00Z');
      expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(512)).toBe('512 Bytes');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(1610612736)).toBe('1.5 GB');
    });

    it('formats terabytes', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });
  });

  describe('formatPercentage', () => {
    it('formats percentages', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(25.5)).toBe('25.5%');
    });

    it('handles different decimal places', () => {
      expect(formatPercentage(50, 0)).toBe('50%');
      expect(formatPercentage(50, 2)).toBe('50.00%');
    });

    it('handles different locales', () => {
      expect(formatPercentage(50, 1, 'de-DE')).toBe('50,0%');
    });

    it('handles negative percentages', () => {
      expect(formatPercentage(-25)).toBe('-25.0%');
    });

    it('handles zero', () => {
      expect(formatPercentage(0)).toBe('0.0%');
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with prefix', () => {
      const id = generateId('test');
      expect(id).toStartWith('test_');
    });

    it('generates IDs of expected length', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(10); // prefix + 9 chars
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('delays function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancels previous calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('limits function execution frequency', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('passes arguments correctly', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('arg1', 'arg2');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('deepClone', () => {
    it('clones primitive values', () => {
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
      expect(deepClone(42)).toBe(42);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(true)).toBe(true);
    });

    it('clones dates', () => {
      const date = new Date('2023-12-25');
      const cloned = deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });

    it('clones arrays', () => {
      const arr = [1, 2, { nested: true }];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('clones objects', () => {
      const obj = { a: 1, b: { nested: true } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });
  });

  describe('isEmpty', () => {
    it('detects empty values', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it('detects non-empty values', () => {
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });
  });

  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('h')).toBe('H');
    });

    it('handles empty strings', () => {
      expect(capitalize('')).toBe('');
    });

    it('handles single character', () => {
      expect(capitalize('a')).toBe('A');
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      expect(truncate('Hello world', 5)).toBe('He...');
    });

    it('returns original string if under limit', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('uses default length', () => {
      const longString = 'A'.repeat(200);
      expect(truncate(longString)).toBe('A'.repeat(97) + '...');
    });
  });

  describe('getInitials', () => {
    it('gets initials from name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('John')).toBe('J');
    });

    it('limits to maxLength', () => {
      expect(getInitials('John Middle Doe', 2)).toBe('JM');
    });

    it('handles extra spaces', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });

    it('handles empty string', () => {
      expect(getInitials('')).toBe('');
    });
  });

  describe('isValidEmail', () => {
    it('validates correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('validates correct phone numbers', () => {
      expect(isValidPhone('+1 555-123-4567')).toBe(true);
      expect(isValidPhone('(555) 123-4567')).toBe(true);
      expect(isValidPhone('555.123.4567')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(isValidPhone('abc')).toBe(false);
      expect(isValidPhone('123')).toBe(false);
    });
  });

  describe('stringToColor', () => {
    it('generates consistent colors', () => {
      const color1 = stringToColor('test');
      const color2 = stringToColor('test');
      expect(color1).toBe(color2);
    });

    it('generates different colors for different strings', () => {
      const color1 = stringToColor('test1');
      const color2 = stringToColor('test2');
      expect(color1).not.toBe(color2);
    });

    it('returns valid hex colors', () => {
      const color = stringToColor('test');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('copyToClipboard', () => {
    it('copies text to clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('handles clipboard errors gracefully', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Not allowed')) },
      });

      // Mock document.execCommand for fallback
      const mockExecCommand = vi.fn().mockReturnValue(true);
      Object.assign(document, {
        execCommand: mockExecCommand,
      });

      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
    });
  });

  describe('breakpoint utilities', () => {
    it('detects mobile breakpoints', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      expect(getBreakpoint()).toBe('xs');
      expect(isMobile()).toBe(true);
      expect(isTablet()).toBe(false);
      expect(isDesktop()).toBe(false);
    });

    it('detects tablet breakpoints', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      expect(getBreakpoint()).toBe('md');
      expect(isMobile()).toBe(false);
      expect(isTablet()).toBe(true);
      expect(isDesktop()).toBe(false);
    });

    it('detects desktop breakpoints', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      expect(getBreakpoint()).toBe('lg');
      expect(isMobile()).toBe(false);
      expect(isTablet()).toBe(false);
      expect(isDesktop()).toBe(true);
    });
  });

  describe('scroll utilities', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'pageXOffset', { writable: true, configurable: true, value: 100 });
      Object.defineProperty(window, 'pageYOffset', { writable: true, configurable: true, value: 200 });
      Object.defineProperty(document, 'documentElement', {
        writable: true,
        configurable: true,
        value: {
          scrollLeft: 100,
          scrollTop: 200,
        },
      });
    });

    it('gets scroll position', () => {
      const position = getScrollPosition();
      expect(position).toEqual({ x: 100, y: 200 });
    });

    it('scrolls to element', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
      } as any;

      scrollToElement(mockElement);
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('scrolls to element by selector', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
      } as any;
      const querySelector = vi.fn().mockReturnValue(mockElement);
      Object.assign(document, { querySelector });

      scrollToElement('#test-element');
      expect(querySelector).toHaveBeenCalledWith('#test-element');
      expect(mockElement.scrollIntoView).toHaveBeenCalled();
    });

    it('checks if element is in viewport', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({
          top: 100,
          left: 100,
          bottom: 200,
          right: 200,
        }),
      } as any;

      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

      expect(isInViewport(mockElement)).toBe(true);
    });
  });
});