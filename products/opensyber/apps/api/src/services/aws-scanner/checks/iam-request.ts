/**
 * IAM Request Utilities
 *
 * AWS SigV4-signed request helpers and XML parsing for IAM API calls.
 * Used by IAM security checks.
 */

import { XMLParser } from 'fast-xml-parser';
import type { ScanContext } from '../types.js';
import { sha256, deriveSigningKey, signString } from '../sigv4.js';

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
});

const IAM_ENDPOINT = 'https://iam.amazonaws.com/';

/**
 * Sign and make AWS IAM API request using Signature Version 4
 */
export async function iamRequest(
  context: ScanContext,
  action: string,
  params: Record<string, string> = {},
): Promise<string> {
  const host = 'iam.amazonaws.com';
  const queryParams = new URLSearchParams({ Action: action, Version: '2010-05-08', ...params });
  const queryString = queryParams.toString();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Canonical request
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

  // String to sign
  const credentialScope = `${dateStamp}/us-east-1/iam/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature
  const signingKey = await deriveSigningKey(context.credentials.secretAccessKey, dateStamp, 'us-east-1', 'iam');
  const signatureHex = await signString(signingKey, stringToSign);

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${context.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  const response = await fetch(IAM_ENDPOINT, {
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
