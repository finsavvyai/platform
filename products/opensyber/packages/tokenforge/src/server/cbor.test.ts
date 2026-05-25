import { describe, it, expect } from 'vitest';
import { decodeCbor } from './cbor.js';

describe('decodeCbor', () => {
  it('decodes small uint (0)', () => {
    expect(decodeCbor(new Uint8Array([0x00]))).toBe(0);
  });

  it('decodes small uint (10)', () => {
    expect(decodeCbor(new Uint8Array([0x0a]))).toBe(10);
  });

  it('decodes uint8 (100)', () => {
    expect(decodeCbor(new Uint8Array([0x18, 0x64]))).toBe(100);
  });

  it('decodes uint16 (1000)', () => {
    expect(decodeCbor(new Uint8Array([0x19, 0x03, 0xe8]))).toBe(1000);
  });

  it('decodes negative int (-1)', () => {
    expect(decodeCbor(new Uint8Array([0x20]))).toBe(-1);
  });

  it('decodes negative int (-10)', () => {
    expect(decodeCbor(new Uint8Array([0x29]))).toBe(-10);
  });

  it('decodes a 4-byte byte string', () => {
    const out = decodeCbor(new Uint8Array([0x44, 0x01, 0x02, 0x03, 0x04]));
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out as Uint8Array)).toEqual([1, 2, 3, 4]);
  });

  it('decodes a 3-char text string ("abc")', () => {
    expect(decodeCbor(new Uint8Array([0x63, 0x61, 0x62, 0x63]))).toBe('abc');
  });

  it('decodes an array of two ints [1, 2]', () => {
    expect(decodeCbor(new Uint8Array([0x82, 0x01, 0x02]))).toEqual([1, 2]);
  });

  it('decodes a map { -1: 1, -2: bytes(2) }', () => {
    // 0xa2 = map(2), 0x20 = -1, 0x01 = 1, 0x21 = -2, 0x42 0xaa 0xbb = bytes(2) [0xaa,0xbb]
    const out = decodeCbor(new Uint8Array([0xa2, 0x20, 0x01, 0x21, 0x42, 0xaa, 0xbb]));
    expect(out).toBeInstanceOf(Map);
    const m = out as Map<unknown, unknown>;
    expect(m.get(-1)).toBe(1);
    const v = m.get(-2) as Uint8Array;
    expect(Array.from(v)).toEqual([0xaa, 0xbb]);
  });

  it('decodes booleans and null', () => {
    expect(decodeCbor(new Uint8Array([0xf4]))).toBe(false);
    expect(decodeCbor(new Uint8Array([0xf5]))).toBe(true);
    expect(decodeCbor(new Uint8Array([0xf6]))).toBeNull();
  });

  it('throws on indefinite-length encoding', () => {
    expect(() => decodeCbor(new Uint8Array([0x5f, 0xff]))).toThrow(/indefinite-length/);
  });

  it('throws on tagged values (major type 6)', () => {
    expect(() => decodeCbor(new Uint8Array([0xc0, 0x01]))).toThrow(/major type 6/);
  });

  it('decodes uint32 (info=26) — RFC 8949 §3.1 four-byte length', () => {
    // 0x1a = unsigned int + info 26; followed by 4 BE bytes for 70_000
    expect(decodeCbor(new Uint8Array([0x1a, 0x00, 0x01, 0x11, 0x70]))).toBe(70_000);
  });

  it('returns BigInt when value exceeds Number.MAX_SAFE_INTEGER (info=27, no precision loss)', () => {
    // 0x1b = unsigned int + info 27; 8 BE bytes encoding 2^53 = 9_007_199_254_740_992
    // (Number.MAX_SAFE_INTEGER + 1 — safe-int boundary)
    const bytes = new Uint8Array([0x1b, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const result = decodeCbor(bytes);
    expect(typeof result).toBe('bigint');
    expect(result).toBe(9_007_199_254_740_992n);
  });

  it('throws "unexpected end of input" when length prefix has no body byte', () => {
    // 0x18 = uint with info=24 (one-byte length follower). The length byte
    // is missing → readLength's byteAt() throws. Uint8Array.slice() clips
    // silently for byte strings, so we trigger the error via the length
    // prefix path which actually calls byteAt().
    expect(() => decodeCbor(new Uint8Array([0x18]))).toThrow(/unexpected end of input/);
  });

  it('decodes simple value 0xf7 (CBOR `undefined`) as null', () => {
    // COSE_Key extensions sometimes contain `undefined` for absent fields;
    // we coerce to null so JS consumers don't get conflicting `undefined` semantics
    expect(decodeCbor(new Uint8Array([0xf7]))).toBeNull();
  });

  it('decodes an empty array (length 0) — common for absent WebAuthn extensions', () => {
    // 0x80 = array(0)
    expect(decodeCbor(new Uint8Array([0x80]))).toEqual([]);
  });

  it('decodes a map with text-string keys (e.g. WebAuthn extension blob)', () => {
    // 0xa1 = map(1), 0x63 'k' 0x6b 0x65 0x79 = text "key", 0x01 = uint 1
    const out = decodeCbor(new Uint8Array([0xa1, 0x63, 0x6b, 0x65, 0x79, 0x01]));
    expect(out).toBeInstanceOf(Map);
    expect((out as Map<unknown, unknown>).get('key')).toBe(1);
  });

  it('throws on unsupported simple value 0xf3 (RFC 8949 reserved)', () => {
    expect(() => decodeCbor(new Uint8Array([0xf3]))).toThrow(/simple value 0xf3 unsupported/);
  });
});
