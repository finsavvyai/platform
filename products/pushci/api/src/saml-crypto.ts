// SAML signature verification — RSASSA-PKCS1-v1_5 with SHA-1/256/512 via WebCrypto.
// X.509 SPKI extraction is hand-rolled DER walking; no Node deps.

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Outer SEQ → TBSCertificate SEQ → optional [0] version → skip serial,
// sigAlg, issuer, validity, subject (5 fields) → SubjectPublicKeyInfo SEQ.
function extractSpkiFromX509(der: Uint8Array): Uint8Array {
  let p = 0;
  const readLen = () => {
    const f = der[p++];
    if (f < 0x80) return f;
    let len = 0;
    for (let i = 0; i < (f & 0x7f); i++) len = (len << 8) | der[p++];
    return len;
  };
  const expectSeq = () => {
    if (der[p++] !== 0x30) throw new Error("saml: expected SEQUENCE");
    return readLen();
  };
  const skipField = () => { p++; const l = readLen(); p += l; };
  expectSeq();
  expectSeq();
  if (der[p] === 0xa0) { p++; const l = readLen(); p += l; }
  skipField(); skipField(); skipField(); skipField(); skipField();
  const spkiStart = p;
  if (der[p++] !== 0x30) throw new Error("saml: expected SPKI SEQUENCE");
  const spkiLen = readLen();
  return der.slice(spkiStart, p + spkiLen);
}

async function importX509SpkiFromPem(
  pem: string,
  hash: "SHA-1" | "SHA-256" | "SHA-512"
): Promise<CryptoKey> {
  const stripped = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  const der = base64ToBytes(stripped);
  const spki = extractSpkiFromX509(der);
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash },
    false,
    ["verify"]
  );
}

export async function verifySignature(xml: string, certPem: string): Promise<boolean> {
  const siMatch = xml.match(/<(?:[\w-]+:)?SignedInfo(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?SignedInfo>/);
  const svMatch = xml.match(/<(?:[\w-]+:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?SignatureValue>/);
  if (!siMatch || !svMatch) return false;

  const signedInfo = siMatch[0].replace(/>\s+</g, "><").trim();
  const signature = base64ToBytes(svMatch[1].replace(/\s+/g, ""));
  const hash: "SHA-1" | "SHA-256" | "SHA-512" = /rsa-sha512/i.test(siMatch[0])
    ? "SHA-512"
    : /rsa-sha1/i.test(siMatch[0])
      ? "SHA-1"
      : "SHA-256";
  const key = await importX509SpkiFromPem(certPem, hash);
  return crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    new TextEncoder().encode(signedInfo)
  );
}
