import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSentry } from './sentry.js';

describe('createSentry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs locally when no DSN is configured', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sentry = createSentry({});
    sentry.captureException(new Error('test'));
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('No DSN configured'),
      'test',
    );
  });

  it('sends exception to Sentry when DSN is configured', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const sentry = createSentry({
      dsn: 'https://abc123@o1.ingest.sentry.io/1',
      environment: 'test',
    });
    sentry.captureException(new Error('boom'));
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0]!;
    expect(url).toContain('sentry.io');
    const body = JSON.parse(opts!.body as string);
    expect(body.exception.values[0].value).toBe('boom');
    expect(body.environment).toBe('test');
  });

  it('sends message to Sentry when DSN is configured', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const sentry = createSentry({
      dsn: 'https://key@o1.ingest.sentry.io/2',
    });
    sentry.captureMessage('deployment complete', { version: '1.0' });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.message.formatted).toBe('deployment complete');
    expect(body.extra.version).toBe('1.0');
  });

  it('handles non-Error objects gracefully', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const sentry = createSentry({
      dsn: 'https://key@o1.ingest.sentry.io/3',
    });
    sentry.captureException('string error');
    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.exception.values[0].value).toBe('string error');
  });

  it('includes release when provided', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const sentry = createSentry({
      dsn: 'https://key@o1.ingest.sentry.io/4',
      release: 'v0.2.0',
    });
    sentry.captureException(new Error('test'));
    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.release).toBe('v0.2.0');
  });

  it('warns locally for captureMessage without DSN', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sentry = createSentry({});
    sentry.captureMessage('hello');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('No DSN configured'),
      'hello',
    );
  });
});
