import { describe, it, expect, vi } from 'vitest';
import { loadPublicJwks } from './key-store.js';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];

function makeDb(rows: Array<Record<string, unknown>>): DbLike {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => rows),
      })),
    })),
  } as unknown as DbLike;
}

describe('loadPublicJwks', () => {
  it('returns empty array when store has no rows', async () => {
    const result = await loadPublicJwks(makeDb([]));
    expect(result).toEqual([]);
  });

  it('parses a single active EC P-256 key and adds kid + alg', async () => {
    const result = await loadPublicJwks(makeDb([{
      id: 'sk_1',
      kid: 'kid-active-1',
      alg: 'ES256',
      publicJwk: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'X', y: 'Y' }),
      status: 'active',
    }]));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kid: 'kid-active-1',
      alg: 'ES256',
      kty: 'EC',
      crv: 'P-256',
      x: 'X', y: 'Y',
    });
  });

  it('returns multiple keys (active + retiring) — caller relies on row WHERE for status filtering', async () => {
    const rows = [
      { kid: 'k1', alg: 'ES256', publicJwk: JSON.stringify({ kty: 'EC' }), status: 'active' },
      { kid: 'k2', alg: 'ES256', publicJwk: JSON.stringify({ kty: 'EC' }), status: 'retiring' },
    ];
    const result = await loadPublicJwks(makeDb(rows));
    expect(result).toHaveLength(2);
    expect(result.map((k) => k.kid)).toEqual(['k1', 'k2']);
  });

  it('drops rows with malformed JSON instead of throwing', async () => {
    const rows = [
      { kid: 'good', alg: 'ES256', publicJwk: JSON.stringify({ kty: 'EC' }), status: 'active' },
      { kid: 'broken', alg: 'ES256', publicJwk: '{not-json', status: 'active' },
    ];
    const result = await loadPublicJwks(makeDb(rows));
    expect(result).toHaveLength(1);
    expect(result[0]!.kid).toBe('good');
  });

  it('drops rows whose JWK is not an object (e.g. JSON null or bare string)', async () => {
    const rows = [
      { kid: 'good', alg: 'ES256', publicJwk: JSON.stringify({ kty: 'EC' }), status: 'active' },
      { kid: 'null', alg: 'ES256', publicJwk: 'null', status: 'active' },
      { kid: 'string', alg: 'ES256', publicJwk: '"hello"', status: 'active' },
    ];
    const result = await loadPublicJwks(makeDb(rows));
    expect(result.map((k) => k.kid)).toEqual(['good']);
  });

  it('always overwrites kid + alg with row values even if JSON has different ones', async () => {
    const rows = [{
      kid: 'row-kid',
      alg: 'ES256',
      publicJwk: JSON.stringify({ kty: 'EC', kid: 'json-kid-LIE', alg: 'RS256-LIE' }),
      status: 'active',
    }];
    const result = await loadPublicJwks(makeDb(rows));
    expect(result[0]!.kid).toBe('row-kid');
    expect(result[0]!.alg).toBe('ES256');
  });
});
