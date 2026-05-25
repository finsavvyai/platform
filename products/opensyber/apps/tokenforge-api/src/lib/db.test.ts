/**
 * createDb is a thin wrapper around `drizzle(d1, { schema })`. Every other
 * test in this package mocks this module to return a fake Drizzle instance,
 * so the real createDb never executes — coverage was 0%. This file pins
 * the real wrapper so a regression that breaks the schema wiring (e.g. a
 * dropped table import) surfaces here instead of in production.
 */

import { describe, it, expect } from 'vitest';
import { createDb } from './db.js';

describe('createDb', () => {
  it('wraps a D1Database into a Drizzle ORM instance with the expected query-builder surface', () => {
    // Drizzle's d1 driver only consumes the D1 binding lazily on query;
    // we can pass a stub object — createDb itself just returns the
    // drizzle wrapper. The pin asserts the wrapper exposes the four
    // standard verbs the rest of the package consumes.
    const fakeD1 = {} as D1Database;
    const db = createDb(fakeD1);
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
  });
});
