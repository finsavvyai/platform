/**
 * PII detection and redaction for request/response bodies.
 * Wraps the pii-detector module for proxy-level usage.
 */

import { redactPIIInObject, getRedactionSummary, type PIIMatch } from './pii-detector';
import type { ApiKeyRecord } from './api-keys';
import type { Env } from './env';

interface UsageLog {
  user_id: string;
  api_key_id: string;
  model: string;
  tokens: number;
  timestamp: number;
  endpoint: string;
}

export async function detectAndRedactRequest(
  request: Request
): Promise<{ request: Request; piiMatches: PIIMatch[] }> {
  try {
    const requestBody = (await request.clone().json()) as unknown;
    const { redacted, matches } = redactPIIInObject(requestBody);
    const headers = new Headers(request.headers);
    headers.set('Content-Type', 'application/json');

    return {
      request: new Request(request, {
        headers,
        body: JSON.stringify(redacted),
      }),
      piiMatches: matches,
    };
  } catch (error) {
    console.error('PII detection error in request:', error);
    return { request, piiMatches: [] };
  }
}

export async function detectAndRedactResponse(
  response: Response
): Promise<{ response: Response; piiMatches: PIIMatch[] }> {
  try {
    const responseBody = (await response.clone().json()) as unknown;
    const { redacted, matches } = redactPIIInObject(responseBody);

    return {
      response: new Response(JSON.stringify(redacted), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
      piiMatches: matches,
    };
  } catch (error) {
    console.error('PII detection error in response:', error);
    return { response, piiMatches: [] };
  }
}

export async function logUsage(
  keyData: ApiKeyRecord,
  request: Request,
  response: Response,
  requestPII: PIIMatch[],
  responsePII: PIIMatch[],
  env: Env
): Promise<void> {
  try {
    const responseData = (await response.clone().json()) as Record<string, unknown>;
    const usage: UsageLog = {
      user_id: keyData.user_id,
      api_key_id: keyData.id,
      model: typeof responseData.model === 'string' ? responseData.model : 'unknown',
      tokens:
        typeof (responseData.usage as Record<string, unknown> | undefined)?.total_tokens === 'number'
          ? (responseData.usage as Record<string, number>).total_tokens
          : 0,
      timestamp: Date.now(),
      endpoint: new URL(request.url).pathname,
    };

    await env.DB.prepare(
      `
      INSERT INTO usage_logs (user_id, api_key_id, model, tokens, timestamp, endpoint)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        usage.user_id,
        usage.api_key_id,
        usage.model,
        usage.tokens,
        usage.timestamp,
        usage.endpoint
      )
      .run();

    if (requestPII.length > 0 || responsePII.length > 0) {
      const requestSummary = getRedactionSummary(requestPII);
      const responseSummary = getRedactionSummary(responsePII);

      await env.DB.prepare(
        `
        INSERT INTO pii_redactions (
          user_id, api_key_id, timestamp,
          request_pii_count, response_pii_count,
          request_pii_types, response_pii_types
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
        .bind(
          keyData.user_id,
          keyData.id,
          usage.timestamp,
          requestPII.length,
          responsePII.length,
          JSON.stringify(requestSummary),
          JSON.stringify(responseSummary)
        )
        .run();

      console.log('PII redacted:', {
        request: requestPII.length,
        response: responsePII.length,
        requestTypes: Object.keys(requestSummary),
        responseTypes: Object.keys(responseSummary),
      });
    }
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}
