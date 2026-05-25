/** AWS Bedrock provider adapter with SigV4 signing (crypto.subtle only). */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

// ── SigV4 helpers ────────────────────────────────────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data),
  );
  return toHex(buf);
}

async function hmacSha256(keyBuf: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

async function deriveSigningKey(
  secret: string, date: string, region: string, service: string,
): Promise<ArrayBuffer> {
  const kDate    = await hmacSha256(new TextEncoder().encode(`AWS4${secret}`).buffer as ArrayBuffer, date);
  const kRegion  = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function signBedrockRequest(
  method: string,
  url: URL,
  bodyStr: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<Record<string, string>> {
  const service = 'bedrock';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256hex(bodyStr);

  const canonicalHeaders =
    `content-type:application/json\nhost:${url.hostname}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';

  const canonicalRequest = [
    method,
    url.pathname,
    '',                  // empty query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  return {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// ── Request / response helpers ───────────────────────────────────────────────

function buildBody(req: PromptRequest): unknown {
  const model = req.model;
  if (model.startsWith('anthropic.')) {
    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) {
      messages.push({ role: 'user', content: `${req.system}\n\n${req.prompt}` });
    } else {
      messages.push({ role: 'user', content: req.prompt });
    }
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: req.maxTokens ?? 2048,
      messages,
    };
  }
  if (model.startsWith('amazon.titan-')) {
    return {
      inputText: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt,
      textGenerationConfig: {
        maxTokenCount: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.7,
      },
    };
  }
  // Meta Llama, Cohere Command, etc.
  const fullPrompt = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;
  return {
    prompt: fullPrompt,
    max_gen_len: req.maxTokens ?? 2048,
    temperature: req.temperature ?? 0.7,
  };
}

function parseBody(
  data: Record<string, unknown>,
  model: string,
): { text: string; tokensIn: number; tokensOut: number } {
  if (model.startsWith('anthropic.')) {
    const content = data.content as Array<{ text: string }> | undefined;
    const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return {
      text: content?.[0]?.text ?? '',
      tokensIn: usage?.input_tokens ?? 0,
      tokensOut: usage?.output_tokens ?? 0,
    };
  }
  if (model.startsWith('amazon.titan-')) {
    const results = data.results as Array<{ outputText: string }> | undefined;
    return { text: results?.[0]?.outputText ?? '', tokensIn: 0, tokensOut: 0 };
  }
  return { text: (data.generation as string | undefined) ?? '', tokensIn: 0, tokensOut: 0 };
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export const bedrockAdapter: ProviderAdapter = {
  name: 'bedrock',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();

    const parts = apiKey.split('|');
    if (parts.length !== 3) throw new Error('Bedrock: expected REGION|ACCESS_KEY_ID|SECRET_ACCESS_KEY');
    const [region, accessKeyId, secretAccessKey] = parts;

    const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(req.model)}/invoke`;
    const url = new URL(endpoint);
    const bodyStr = JSON.stringify(buildBody(req));

    const headers = await signBedrockRequest('POST', url, bodyStr, accessKeyId, secretAccessKey, region);

    const res = await fetch(endpoint, { method: 'POST', headers, body: bodyStr });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bedrock ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const { text, tokensIn, tokensOut } = parseBody(data, req.model);

    return { text, tokensIn, tokensOut, latencyMs: Date.now() - start };
  },
};
