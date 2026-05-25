/**
 * EC2 Request Utilities
 *
 * AWS SigV4-signed request helpers and XML parsing for EC2 API calls.
 * Used by EC2 security checks.
 */

import { XMLParser } from 'fast-xml-parser';
import type { ScanContext } from '../types.js';
import { sha256, deriveSigningKey, signString } from '../sigv4.js';

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
});

const EC2_ENDPOINT = (region: string): string => `https://ec2.${region}.amazonaws.com/`;

/**
 * Sign and make AWS EC2 API request using Signature Version 4
 */
export async function ec2Request(
  context: ScanContext,
  action: string,
  params: Record<string, string> = {},
): Promise<string> {
  const host = `ec2.${context.region}.amazonaws.com`;
  const queryParams = new URLSearchParams({ Action: action, Version: '2016-11-15', ...params });
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
  const credentialScope = `${dateStamp}/${context.region}/ec2/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const signingKey = await deriveSigningKey(context.credentials.secretAccessKey, dateStamp, context.region, 'ec2');
  const signatureHex = await signString(signingKey, stringToSign);

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${context.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  const response = await fetch(EC2_ENDPOINT(context.region), {
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
