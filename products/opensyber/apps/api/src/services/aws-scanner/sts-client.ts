/**
 * AWS STS client using fetch API
 *
 * Implements AssumeRole calls for cross-account access.
 * Designed for Cloudflare Workers compatibility (no Node.js dependencies).
 */

import type {
  AWSTemporaryCredentials,
  AssumeRoleResult,
  CloudAccountConfig,
  AWSError,
} from './types.js';
import { signRequest } from './sts-signing.js';

const STS_ENDPOINT = 'https://sts.amazonaws.com/';
const STS_ACTION = 'AssumeRole';
const STS_VERSION = '2011-06-15';

/**
 * Parse STS error response
 */
function parseSTSError(body: string): AWSError {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(body, 'text/xml');

    const errorNode = xmlDoc.getElementsByTagName('Error')[0];
    if (errorNode) {
      return {
        code: errorNode.getElementsByTagName('Code')[0]?.textContent || 'UnknownError',
        message: errorNode.getElementsByTagName('Message')[0]?.textContent || 'Unknown error',
        type: errorNode.getElementsByTagName('Type')[0]?.textContent || undefined,
      };
    }
  } catch {
    // Fallback to generic error
  }
  return {
    code: 'UnknownError',
    message: body || 'Failed to parse STS response',
  };
}

/**
 * AssumeRole using STS with long-lived credentials
 */
export async function assumeRole(
  roleArn: string,
  accessKeyId: string,
  secretAccessKey: string,
  externalId?: string,
  sessionName?: string,
  duration = 3600,
): Promise<AssumeRoleResult> {
  if (!roleArn.startsWith('arn:aws:iam::')) {
    throw new Error('Invalid role ARN format');
  }
  if (duration < 900 || duration > 43200) {
    throw new Error('Duration must be between 900 and 43200 seconds');
  }

  const arnParts = roleArn.split(':');
  const accountId = arnParts[4] ?? '';

  const uniqueId = crypto.randomUUID().slice(0, 16);
  const roleSessionName = sessionName || `opensyber-${uniqueId}`;

  const params = new URLSearchParams({
    Action: STS_ACTION,
    RoleArn: roleArn,
    RoleSessionName: roleSessionName,
    DurationSeconds: duration.toString(),
    Version: STS_VERSION,
  });

  if (externalId) {
    params.append('ExternalId', externalId);
  }

  const url = new URL(STS_ENDPOINT);
  url.search = params.toString();
  const body = params.toString();

  const headers = await signRequest(
    'POST', url,
    { 'Content-Type': 'application/x-www-form-urlencoded', Host: url.hostname },
    body, accessKeyId, secretAccessKey,
  );

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body,
  });

  const responseBody = await response.text();

  if (!response.ok) {
    const error = parseSTSError(responseBody);
    throw new Error(`STS AssumeRole failed: ${error.code} - ${error.message}`);
  }

  return parseAssumeRoleResponse(responseBody, roleSessionName, accountId);
}

/**
 * Parse successful AssumeRole XML response
 */
function parseAssumeRoleResponse(
  responseBody: string,
  roleSessionName: string,
  accountId: string,
): AssumeRoleResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(responseBody, 'text/xml');

  const credentialsNode = xmlDoc.getElementsByTagName('Credentials')[0];
  const assumedRoleUserNode = xmlDoc.getElementsByTagName('AssumedRoleUser')[0];

  if (!credentialsNode) {
    throw new Error('Invalid STS response: missing Credentials node');
  }

  const accessKeyId = credentialsNode.getElementsByTagName('AccessKeyId')[0]?.textContent;
  const secretAccessKey = credentialsNode.getElementsByTagName('SecretAccessKey')[0]?.textContent;
  const sessionToken = credentialsNode.getElementsByTagName('SessionToken')[0]?.textContent;
  const expiration = credentialsNode.getElementsByTagName('Expiration')[0]?.textContent;

  if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
    throw new Error('Invalid STS response: missing credential fields');
  }

  const assumedRoleId = assumedRoleUserNode
    ?.getElementsByTagName('AssumedRoleId')[0]?.textContent || roleSessionName;

  return {
    credentials: { accessKeyId, secretAccessKey, sessionToken, expiration },
    assumedRoleId,
    account: accountId,
    arn: assumedRoleUserNode?.getElementsByTagName('Arn')[0]?.textContent,
  };
}

/**
 * AssumeRole with role ARN and stored credentials (helper for cloud account config)
 */
export async function assumeRoleFromConfig(
  config: CloudAccountConfig,
  accessKeyId: string,
  secretAccessKey: string,
): Promise<AssumeRoleResult> {
  return assumeRole(config.roleArn, accessKeyId, secretAccessKey, config.externalId, 'opensyber-scan', 3600);
}
