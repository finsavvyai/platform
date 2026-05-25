/**
 * Test-only helpers — inverse of derToRawEcdsa for synthesizing valid
 * assertions in tests. NOT exported from the package.
 */

export async function makeP256Keypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
}

function stripLeading(b: Uint8Array): Uint8Array {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  return b.slice(i);
}

function derInteger(b: Uint8Array): Uint8Array {
  const first = b[0] ?? 0;
  const needsPad = first & 0x80;
  const content = needsPad ? new Uint8Array([0x00, ...b]) : b;
  const out = new Uint8Array(2 + content.length);
  out[0] = 0x02; out[1] = content.length;
  out.set(content, 2);
  return out;
}

/** Convert raw r||s ECDSA signature into the DER form WebAuthn produces. */
export function rawToDerEcdsa(raw: Uint8Array): Uint8Array {
  const r = stripLeading(raw.slice(0, 32));
  const s = stripLeading(raw.slice(32, 64));
  const rTLV = derInteger(r);
  const sTLV = derInteger(s);
  const body = new Uint8Array(rTLV.length + sTLV.length);
  body.set(rTLV, 0);
  body.set(sTLV, rTLV.length);
  const out = new Uint8Array(2 + body.length);
  out[0] = 0x30; out[1] = body.length;
  out.set(body, 2);
  return out;
}
