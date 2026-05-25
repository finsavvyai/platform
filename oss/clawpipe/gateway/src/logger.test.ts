/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, requestLogger } from './logger';

describe('Logger', () => {
  let logged: string[];
  let errored: string[];
  beforeEach(() => {
    logged = [];
    errored = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => { logged.push(line); });
    vi.spyOn(console, 'error').mockImplementation((line: string) => { errored.push(line); });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('emits info to console.log with timestamp + level + msg', () => {
    new Logger().info('hello');
    expect(logged).toHaveLength(1);
    const entry = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(entry.level).toBe('info');
    expect(entry.msg).toBe('hello');
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('emits warn + error to console.error', () => {
    const l = new Logger();
    l.warn('w'); l.error('e');
    expect(errored).toHaveLength(2);
    expect(JSON.parse(errored[0]).level).toBe('warn');
    expect(JSON.parse(errored[1]).level).toBe('error');
  });

  it('debug also goes to console.log', () => {
    new Logger().debug('dbg');
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0]).level).toBe('debug');
  });

  it('child() merges context into every entry', () => {
    new Logger({ requestId: 'req-1' }).child({ projectId: 'p1' }).info('test');
    const entry = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(entry.requestId).toBe('req-1');
    expect(entry.projectId).toBe('p1');
  });

  it('per-call extra overrides constructor context', () => {
    new Logger({ projectId: 'old' }).info('m', { projectId: 'new' });
    const entry = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(entry.projectId).toBe('new');
  });
});

describe('requestLogger', () => {
  let logged: string[];
  beforeEach(() => {
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => { logged.push(line); });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('uses x-request-id header when present', () => {
    const req = new Request('https://x.test/v1/prompt', { headers: { 'x-request-id': 'fixed-id' }, method: 'POST' });
    requestLogger(req).info('hi');
    expect(JSON.parse(logged[0]).requestId).toBe('fixed-id');
  });

  it('generates a uuid when header missing', () => {
    const req = new Request('https://x.test/v1/prompt', { method: 'POST' });
    requestLogger(req).info('hi');
    expect(JSON.parse(logged[0]).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('captures path + method', () => {
    const req = new Request('https://x.test/v1/abc?z=1', { method: 'PUT' });
    requestLogger(req).info('hi');
    const entry = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(entry.path).toBe('/v1/abc');
    expect(entry.method).toBe('PUT');
  });
});
