import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits structured JSON for info level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message', { userId: 'u1' });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test message');
    expect(parsed.userId).toBe('u1');
    expect(parsed.timestamp).toBeDefined();
  });

  it('emits structured JSON for error level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('something broke', { code: 500 });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('something broke');
    expect(parsed.code).toBe(500);
  });

  it('emits structured JSON for warn level', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('rate limit approaching');
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('warn');
  });

  it('emits structured JSON for debug level', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('verbose info', { query: 'SELECT 1' });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('debug');
    expect(parsed.query).toBe('SELECT 1');
  });

  it('works without context object', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('no context');
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.message).toBe('no context');
    expect(parsed.level).toBe('info');
  });

  it('includes ISO timestamp', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('time check');
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
