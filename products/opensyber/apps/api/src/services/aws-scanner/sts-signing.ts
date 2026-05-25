/**
 * STS Request Signing
 *
 * AWS Signature Version 4 signing for STS API requests.
 * Uses shared sigv4 utilities for key derivation and hashing.
 */

import { sha256, deriveSigningKey, signString } from './sigv4.js';

/**
 * Generate AWS Signature Version 4 signature for STS requests
 */
export async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken?: string,
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Parse URL
  const host = url.hostname;
  const canonicalUri = url.pathname || '/';
  const canonicalQuerystring = url.search.slice(1);

  // Build canonical headers
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-date:${amzDate}`,
  ];
  if (sessionToken) {
    canonicalHeaders.push(`x-amz-security-token:${sessionToken}`);
  }
  const canonicalHeadersString = canonicalHeaders.join('\n') + '\n';

  const signedHeaders = ['host', 'x-amz-date'];
  if (sessionToken) {
    signedHeaders.push('x-amz-security-token');
  }
  const signedHeadersString = signedHeaders.join(';');

  // Build payload hash using shared utility
  const payloadHash = await sha256(body);

  // Canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeadersString,
    signedHeadersString,
    payloadHash,
  ].join('\n');

  // Create string to sign
  const credentialScope = `${dateStamp}/us-east-1/sts/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature
  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, 'us-east-1', 'sts');
  const signatureHex = await signString(signingKey, stringToSign);

  // Build authorization header
  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeadersString}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  return {
    ...headers,
    Authorization: authorization,
    'X-Amz-Date': amzDate,
    ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}),
  };
}
