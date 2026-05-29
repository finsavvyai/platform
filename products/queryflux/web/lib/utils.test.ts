import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge multiple class names', () => {
    const result = cn('foo', 'bar');

    expect(result).toBe('foo bar');
  });

  it('should handle a single class name', () => {
    const result = cn('foo');

    expect(result).toBe('foo');
  });

  it('should handle conditional classes with true', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');

    expect(result).toBe('base active');
  });

  it('should handle conditional classes with false', () => {
    const isActive = false;
    const result = cn('base', isActive && 'active');

    expect(result).toBe('base');
  });

  it('should handle undefined values', () => {
    const result = cn('foo', undefined, 'bar');

    expect(result).toBe('foo bar');
  });

  it('should handle null values', () => {
    const result = cn('foo', null, 'bar');

    expect(result).toBe('foo bar');
  });

  it('should handle false values', () => {
    const result = cn('foo', false, 'bar');

    expect(result).toBe('foo bar');
  });

  it('should handle empty string values', () => {
    const result = cn('foo', '', 'bar');

    expect(result).toBe('foo bar');
  });

  it('should resolve Tailwind padding conflicts (last wins)', () => {
    const result = cn('p-4', 'p-2');

    expect(result).toBe('p-2');
  });

  it('should resolve Tailwind margin conflicts', () => {
    const result = cn('mt-4', 'mt-8');

    expect(result).toBe('mt-8');
  });

  it('should resolve Tailwind text color conflicts', () => {
    const result = cn('text-red-500', 'text-blue-500');

    expect(result).toBe('text-blue-500');
  });

  it('should resolve Tailwind background color conflicts', () => {
    const result = cn('bg-white', 'bg-black');

    expect(result).toBe('bg-black');
  });

  it('should keep non-conflicting Tailwind classes', () => {
    const result = cn('p-4', 'mx-2', 'text-lg');

    expect(result).toBe('p-4 mx-2 text-lg');
  });

  it('should handle object syntax from clsx', () => {
    const result = cn({ 'text-red-500': true, hidden: false });

    expect(result).toBe('text-red-500');
  });

  it('should handle array syntax from clsx', () => {
    const result = cn(['foo', 'bar']);

    expect(result).toBe('foo bar');
  });

  it('should handle no arguments', () => {
    const result = cn();

    expect(result).toBe('');
  });

  it('should handle mixed types', () => {
    const result = cn('base', undefined, { active: true }, ['extra']);

    expect(result).toBe('base active extra');
  });

  it('should resolve Tailwind display conflicts', () => {
    const result = cn('block', 'flex');

    expect(result).toBe('flex');
  });
});
