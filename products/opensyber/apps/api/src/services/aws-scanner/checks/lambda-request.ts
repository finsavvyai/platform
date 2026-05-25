/**
 * Lambda Request Utilities
 *
 * AWS SigV4-signed request helpers for Lambda API calls (JSON-based, not XML).
 */
import type { ScanContext } from '../types.js';
import { sha256, deriveSigningKey, signString } from '../sigv4.js';

const LAMBDA_ENDPOINT = (region: string): string => `https://lambda.${region}.amazonaws.com`;

export async function lambdaRequest(
  context: ScanContext,
  path: string,
  method = 'GET',
): Promise<unknown> {
  const host = `lambda.${context.region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  const payloadHash = await sha256('');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const credentialScope = `${dateStamp}/${context.region}/lambda/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashedCanonicalRequest].join('\n');

  const signingKey = await deriveSigningKey(context.credentials.secretAccessKey, dateStamp, context.region, 'lambda');
  const signatureHex = await signString(signingKey, stringToSign);

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${context.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  const response = await fetch(`${LAMBDA_ENDPOINT(context.region)}${path}`, {
    method,
    headers: {
      'Authorization': authorization,
      'X-Amz-Date': amzDate,
      'X-Amz-Security-Token': context.credentials.sessionToken,
      'Host': host,
    },
  });

  return response.json();
}
