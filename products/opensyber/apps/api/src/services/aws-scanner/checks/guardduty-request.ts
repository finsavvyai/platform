/**
 * GuardDuty SigV4 request signing helper
 */

import type { ScanContext } from '../types.js';
import { sha256, deriveSigningKey, signString } from '../sigv4.js';

const GUARDDUTY_ENDPOINT = (region: string) => `https://guardduty.${region}.amazonaws.com/`;

/**
 * Sign and make AWS GuardDuty API request using Signature Version 4
 */
export async function guardDutyRequest(
  context: ScanContext,
  action: string,
  params: Record<string, string> = {},
): Promise<string> {
  const host = `guardduty.${context.region}.amazonaws.com`;
  const queryParams = new URLSearchParams({ Action: action, Version: '2017-11-28', ...params });
  const queryString = queryParams.toString();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  const payloadHash = await sha256('');
  const canonicalRequest = [
    'POST',
    '/',
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const credentialScope = `${dateStamp}/${context.region}/guardduty/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const signingKey = await deriveSigningKey(context.credentials.secretAccessKey, dateStamp, context.region, 'guardduty');
  const signatureHex = await signString(signingKey, stringToSign);

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${context.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  const response = await fetch(GUARDDUTY_ENDPOINT(context.region), {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Amz-Date': amzDate,
      'X-Amz-Security-Token': context.credentials.sessionToken,
      'Host': host,
    },
    body: queryString,
  });

  return await response.text();
}
