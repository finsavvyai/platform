/**
 * Minimal CBOR decoder — supports just enough of RFC 8949 to parse
 * WebAuthn `attestationObject` and embedded COSE_Key structures.
 *
 * Supported major types:
 *   0 (uint), 1 (negative int), 2 (byte string), 3 (text string),
 *   4 (array), 5 (map).
 * Unsupported: tags, floats, indefinite-length, simple values other than
 * true/false/null.
 *
 * This is intentionally small (no npm dep) because the only inputs we ever
 * decode are WebAuthn attestation blobs with a known structure. If you feed
 * arbitrary CBOR you may hit `unsupported` errors — that is by design.
 */

export type CborValue =
  | number
  | bigint
  | string
  | Uint8Array
  | boolean
  | null
  | CborValue[]
  | { [key: string]: CborValue }
  | Map<CborValue, CborValue>;

interface DecodeState { buf: Uint8Array; pos: number; }

/** Decode a CBOR-encoded buffer. Throws on unsupported encodings. */
export function decodeCbor(input: ArrayBuffer | Uint8Array): CborValue {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const state: DecodeState = { buf, pos: 0 };
  const value = decodeItem(state);
  return value;
}

function byteAt(s: DecodeState, offset: number): number {
  const v = s.buf[offset];
  if (v === undefined) throw new Error('cbor: unexpected end of input');
  return v;
}

function decodeItem(s: DecodeState): CborValue {
  if (s.pos >= s.buf.length) throw new Error('cbor: unexpected end of input');
  const initial = byteAt(s, s.pos);
  s.pos++;
  const major = initial >> 5;
  const info = initial & 0x1f;
  const len = readLength(s, info);

  switch (major) {
    case 0: return numberify(len);                         // unsigned int
    case 1: return numberify(-1n - BigInt(len));            // negative int
    case 2: return readBytes(s, Number(len));               // byte string
    case 3: return new TextDecoder().decode(readBytes(s, Number(len)));
    case 4: return readArray(s, Number(len));
    case 5: return readMap(s, Number(len));
    case 7: return readSimple(initial);
    default: throw new Error(`cbor: major type ${major} unsupported`);
  }
}

function readLength(s: DecodeState, info: number): bigint {
  if (info < 24) return BigInt(info);
  if (info === 24) {
    const v = byteAt(s, s.pos); s.pos++; return BigInt(v);
  }
  if (info === 25) {
    const v = (byteAt(s, s.pos) << 8) | byteAt(s, s.pos + 1);
    s.pos += 2;
    return BigInt(v);
  }
  if (info === 26) {
    let v = 0;
    for (let i = 0; i < 4; i++) v = (v * 256) + byteAt(s, s.pos + i);
    s.pos += 4;
    return BigInt(v);
  }
  if (info === 27) {
    let v = 0n;
    for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(byteAt(s, s.pos + i));
    s.pos += 8;
    return v;
  }
  throw new Error(`cbor: length info ${info} unsupported (indefinite-length not implemented)`);
}

function numberify(n: bigint): number | bigint {
  return n >= -9007199254740991n && n <= 9007199254740991n ? Number(n) : n;
}

function readBytes(s: DecodeState, n: number): Uint8Array {
  const out = s.buf.slice(s.pos, s.pos + n);
  s.pos += n;
  return out;
}

function readArray(s: DecodeState, n: number): CborValue[] {
  const arr: CborValue[] = [];
  for (let i = 0; i < n; i++) arr.push(decodeItem(s));
  return arr;
}

function readMap(s: DecodeState, n: number): Map<CborValue, CborValue> {
  const m = new Map<CborValue, CborValue>();
  for (let i = 0; i < n; i++) {
    const k = decodeItem(s);
    const v = decodeItem(s);
    m.set(k, v);
  }
  return m;
}

function readSimple(initial: number): boolean | null {
  if (initial === 0xf4) return false;
  if (initial === 0xf5) return true;
  if (initial === 0xf6) return null;
  if (initial === 0xf7) return null; // undefined → null
  throw new Error(`cbor: simple value 0x${initial.toString(16)} unsupported`);
}
