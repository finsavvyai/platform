/**
 * AWS Signature Version 4 shared utilities
 *
 * Provides SHA-256 hashing, HMAC-SHA256, signing key derivation,
 * and string signing for AWS SigV4 request authentication.
 *
 * Designed for Cloudflare Workers compatibility (Web Crypto API only).
 *
 * References:
 * - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_create_sign-request.html
 */

const encoder = new TextEncoder();

/**
 * Convert an ArrayBuffer to a lowercase hex string
 */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SHA-256 hash of a string, returned as hex
 */
export async function sha256(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(data),
  );
  return toHex(hashBuffer);
}

/**
 * HMAC-SHA256 with key and data, returned as Uint8Array.
 * Key is the HMAC key, data is what gets signed (matching AWS SigV4 convention).
 */
export async function hmacSha256(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    data.buffer as ArrayBuffer,
  );
  return new Uint8Array(signature);
}

/**
 * Derive an AWS SigV4 signing key from secret, date, region, and service.
 *
 * Implements the standard derivation chain:
 *   kDate    = HMAC("AWS4" + secret, dateStamp)
 *   kRegion  = HMAC(kDate, region)
 *   kService = HMAC(kRegion, service)
 *   kSigning = HMAC(kService, "aws4_request")
 */
export async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kSecret = encoder.encode(`AWS4${secretAccessKey}`);
  const kDate = await hmacSha256(kSecret, encoder.encode(dateStamp));
  const kRegion = await hmacSha256(kDate, encoder.encode(region));
  const kService = await hmacSha256(kRegion, encoder.encode(service));
  return hmacSha256(kService, encoder.encode('aws4_request'));
}

/**
 * Sign a string using a signing key, returning hex signature
 */
export async function signString(
  signingKey: Uint8Array,
  stringToSign: string,
): Promise<string> {
  const signature = await hmacSha256(
    signingKey,
    encoder.encode(stringToSign),
  );
  return Array.from(signature)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
