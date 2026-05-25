/**
 * KMS Request Utilities
 *
 * AWS SigV4-signed request helpers for KMS API calls (JSON-based).
 */
import type { ScanContext } from '../types.js';
import { sha256, deriveSigningKey, signString } from '../sigv4.js';

const KMS_ENDPOINT = (region: string): string => `https://kms.${region}.amazonaws.com`;

export async function kmsRequest(
  context: ScanContext,
  action: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  const host = `kms.${context.region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payload = JSON.stringify(body);

  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:TrentService.${action}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

  const payloadHash = await sha256(payload);
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const credentialScope = `${dateStamp}/${context.region}/kms/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashedCanonicalRequest].join('\n');

  const signingKey = await deriveSigningKey(context.credentials.secretAccessKey, dateStamp, context.region, 'kms');
  const signatureHex = await signString(signingKey, stringToSign);

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${context.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  const response = await fetch(`${KMS_ENDPOINT(context.region)}/`, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': `TrentService.${action}`,
      'X-Amz-Security-Token': context.credentials.sessionToken,
      'Host': host,
    },
    body: payload,
  });

  return response.json();
}
