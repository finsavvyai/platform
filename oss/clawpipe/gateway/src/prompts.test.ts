/**
 * CP-025: Prompt versioning — gateway handler + renderTemplate unit tests.
 */

import { describe, it, expect } from 'vitest';
import { expandTemplate, extractVariables } from './prompt-template';

// ── renderTemplate (expandTemplate) unit tests ──────────────────────────────

describe('expandTemplate()', () => {
  it('substitutes a single variable', () => {
    expect(expandTemplate('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice');
  });

  it('substitutes multiple variables', () => {
    expect(expandTemplate('{{a}} and {{b}}', { a: 'foo', b: 'bar' })).toBe('foo and bar');
  });

  it('substitutes the same variable multiple times', () => {
    expect(expandTemplate('{{a}}{{a}}', { a: '!' })).toBe('!!');
  });

  it('passes through text with no variables', () => {
    expect(expandTemplate('no vars', {})).toBe('no vars');
  });

  it('uses fallback default when variable missing', () => {
    expect(expandTemplate('ships {{date|tomorrow}}', {})).toBe('ships tomorrow');
  });

  it('optional variable leaves empty string when missing', () => {
    expect(expandTemplate('hi {{name?}}!', {})).toBe('hi !');
  });

  it('throws TemplateError for required missing variable', () => {
    expect(() => expandTemplate('Hello {{name}}', {})).toThrow('missing template variables');
  });

  it('handles nested dot-path variable', () => {
    expect(expandTemplate('{{user.name}}', { user: { name: 'Bob' } as unknown as string })).toBe('Bob');
  });

  it('empty template returns empty string', () => {
    expect(expandTemplate('', {})).toBe('');
  });

  it('special chars in values are preserved', () => {
    expect(expandTemplate('{{v}}', { v: '<script>alert(1)</script>' })).toBe('<script>alert(1)</script>');
  });
});

describe('extractVariables()', () => {
  it('extracts unique variable names', () => {
    const vars = extractVariables('Hello {{name}}, your order {{order_id}} ships {{date|tomorrow}}');
    expect(vars).toContain('name');
    expect(vars).toContain('order_id');
    expect(vars).toContain('date');
    expect(vars.length).toBe(3);
  });

  it('deduplicates repeated variable names', () => {
    const vars = extractVariables('{{a}} and {{a}}');
    expect(vars).toEqual(['a']);
  });

  it('returns empty array for template with no variables', () => {
    expect(extractVariables('no vars')).toEqual([]);
  });
});

// ── CRUD handler tests with D1 mock ─────────────────────────────────────────

interface DbOverrides { prepare?: (sql: string) => unknown; batch?: (stmts: unknown[]) => Promise<unknown[]> }
function makeDb(overrides: DbOverrides = {}) {
  const rows: Record<string, unknown>[] = [];
  let firstResult: Record<string, unknown> | null = null;

  const stmt = {
    bind: (..._args: unknown[]) => stmt,
    run: async () => ({ success: true }),
    first: async <T>() => firstResult as T,
    all: async <T>() => ({ results: rows as T[] }),
  };

  return {
    prepare: (_sql: string) => stmt,
    batch: async (stmts: unknown[]) => stmts,
    _setFirst: (v: unknown) => { firstResult = v as Record<string, unknown>; },
    _setRows: (v: unknown[]) => { rows.splice(0, rows.length, ...v as Record<string, unknown>[]); },
    ...overrides,
  };
}

function makeEnv(db: ReturnType<typeof makeDb>) {
  return { DB: db } as unknown as import('./types').Env;
}

describe('listPrompts()', async () => {
  const { listPrompts } = await import('./prompts');

  it('returns prompts array', async () => {
    const db = makeDb();
    db._setRows([{ id: 'p1', name: 'greeting', description: '', updated_at: '2025-01-01', latest_version: 1 }]);
    const res = await listPrompts(makeEnv(db), 'proj1');
    const data = await res.json() as { prompts: unknown[] };
    expect(Array.isArray(data.prompts)).toBe(true);
  });
});

describe('createPrompt()', async () => {
  const { createPrompt } = await import('./prompts');

  it('returns 400 when name missing', async () => {
    const db = makeDb();
    const req = new Request('https://x', { method: 'POST', body: JSON.stringify({ template: 'hi' }) });
    const res = await createPrompt(req, makeEnv(db), 'proj1');
    expect(res.status).toBe(400);
  });

  it('returns 400 when template missing', async () => {
    const db = makeDb();
    const req = new Request('https://x', { method: 'POST', body: JSON.stringify({ name: 'test' }) });
    const res = await createPrompt(req, makeEnv(db), 'proj1');
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    const db = makeDb();
    const req = new Request('https://x', { method: 'POST', body: JSON.stringify({ name: 'greeting', template: 'Hello {{name}}' }) });
    const res = await createPrompt(req, makeEnv(db), 'proj1');
    expect(res.status).toBe(201);
    const data = await res.json() as { version: number };
    expect(data.version).toBe(1);
  });
});

describe('renderPrompt()', async () => {
  const { renderPrompt } = await import('./prompts');

  it('returns 404 when prompt not found', async () => {
    const db = makeDb();
    const req = new Request('https://x', { method: 'POST', body: JSON.stringify({ variables: {} }) });
    const res = await renderPrompt(req, makeEnv(db), 'proj1', 'no-such-id');
    expect(res.status).toBe(404);
  });

  it('returns rendered prompt', async () => {
    const db = makeDb();
    db._setFirst({ template: 'Hello {{name}}', system: null, model: null, variables: '["name"]' });
    const req = new Request('https://x', { method: 'POST', body: JSON.stringify({ variables: { name: 'Alice' } }) });
    const res = await renderPrompt(req, makeEnv(db), 'proj1', 'p1');
    expect(res.status).toBe(200);
    const data = await res.json() as { prompt: string };
    expect(data.prompt).toBe('Hello Alice');
  });

  it('leaves unknown vars unchanged (optional syntax)', async () => {
    const db = makeDb();
    db._setFirst({ template: 'Hello {{name?}}', system: null, model: null, variables: '[]' });
    const req = new Request('https://x', { method: 'POST', body: JSON.stringify({ variables: {} }) });
    const res = await renderPrompt(req, makeEnv(db), 'proj1', 'p1');
    expect(res.status).toBe(200);
  });
});
