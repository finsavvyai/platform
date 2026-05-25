/**
 * S3 Request Utilities
 *
 * AWS SigV4-signed request helpers and XML parsing for S3 API calls.
 * Used by S3 security checks and bucket listing.
 */

import { XMLParser } from 'fast-xml-parser';
import type { ScanContext } from '../types.js';
import { sha256, deriveSigningKey, signString } from '../sigv4.js';

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
});

/**
 * Sign and make AWS API request using Signature Version 4
 */
export async function s3Request(
  context: ScanContext,
  method: string,
  bucket: string,
  query: string,
  region: string = 'us-east-1',
): Promise<Response> {
  const host = bucket ? `${bucket}.s3.amazonaws.com` : 's3.amazonaws.com';
  const url = `${host}/${query}`;
  const fullUrl = `https://${url}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Canonical request
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = await sha256('');

  const canonicalRequest = [
    method,
    `/${query}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature
  const signingKey = await deriveSigningKey(context.credentials.secretAccessKey, dateStamp, region, 's3');
  const signatureHex = await signString(signingKey, stringToSign);

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${context.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  return fetch(fullUrl, {
    method,
    headers: {
      'Authorization': authorization,
      'X-Amz-Date': amzDate,
      'X-Amz-Security-Token': context.credentials.sessionToken,
      'Host': host,
    },
  });
}

/**
 * Parse S3 ACL response to check for public access
 */
export function parseS3Acl(text: string): { publicRead: boolean; publicWrite: boolean } {
  try {
    const xmlDoc = parser.parse(text);
    const grants = xmlDoc?.AccessControlPolicy?.AccessControlList?.Grant
      || xmlDoc?.AccessControlPolicy?.Grant
      || [];
    const grantsList = Array.isArray(grants) ? grants : [grants];

    for (const grant of grantsList) {
      const grantee = grant?.Grantee;
      const permissionRaw = grant?.Permission;
      const permission = typeof permissionRaw === 'object' ? permissionRaw?.['#text'] : permissionRaw;
      const uriRaw = grantee?.URI;
      const uri = typeof uriRaw === 'object' ? uriRaw?.['#text'] : uriRaw;

      if (uri === 'http://acs.amazonaws.com/groups/global/AllUsers' || uri === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers') {
        if (permission === 'READ' || permission === 'FULL_CONTROL') {
          return { publicRead: true, publicWrite: false };
        }
        if (permission === 'WRITE') {
          return { publicRead: true, publicWrite: true };
        }
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return { publicRead: false, publicWrite: false };
}

/**
 * List all S3 buckets in the account
 */
export async function listS3Buckets(context: ScanContext): Promise<string[]> {
  const buckets: string[] = [];

  try {
    const response = await s3Request(context, 'GET', '', '', 'us-east-1');

    if (response.ok) {
      const text = await response.text();
      const parsed = parser.parse(text);
      const bucketsList = parsed?.ListAllMyBucketsResult?.Buckets?.Bucket || [];
      const bucketArray = Array.isArray(bucketsList) ? bucketsList : bucketsList ? [bucketsList] : [];

      for (const bucket of bucketArray) {
        const name = typeof bucket?.Name === 'object' ? bucket?.Name?.['#text'] : bucket?.Name;
        if (name) {
          buckets.push(name);
        }
      }
    }
  } catch (error) {
    console.error('Failed to list S3 buckets:', error);
  }

  return buckets;
}
