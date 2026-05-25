#!/usr/bin/env node
/**
 * TokenForge MCP Server
 *
 * Provides device-bound session security to any MCP-compatible AI agent.
 * Install: npx @opensyber/tokenforge-mcp
 * Config: Add to claude_desktop_config.json or .cursor/mcp.json
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as crypto from 'crypto';

const API_BASE = process.env.TOKENFORGE_API_URL ?? 'https://tokenforge-api.opensyber.cloud';
const API_KEY = process.env.TOKENFORGE_API_KEY ?? '';

let deviceId: string | null = null;
let privateKey: crypto.KeyObject | null = null;
let publicKeyJwk: crypto.JsonWebKey | null = null;
let bound = false;

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function generateKeyPair(): Promise<void> {
  const { publicKey, privateKey: privKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  privateKey = privKey;
  publicKeyJwk = publicKey.export({ format: 'jwk' });
}

async function signPayload(payload: string): Promise<string> {
  if (!privateKey) throw new Error('Not bound — call tokenforge_bind first');
  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  return sign.sign(privateKey, 'base64');
}

async function bind(sessionId: string): Promise<string> {
  if (!privateKey) await generateKeyPair();
  const res = await fetch(`${API_BASE}/v1/bind`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publicKey: JSON.stringify(publicKeyJwk),
      sessionId,
      metadata: {
        userAgent: 'TokenForge-MCP/1.0',
        language: 'en',
        platform: process.platform,
        screenResolution: 'N/A',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        colorDepth: 0,
      },
    }),
  });
  const data = (await res.json()) as { data?: { deviceId: string } };
  if (data.data?.deviceId) {
    deviceId = data.data.deviceId;
    bound = true;
    return deviceId;
  }
  throw new Error('Bind failed');
}

function getSignHeaders(sessionId: string): Record<string, string> {
  if (!bound || !deviceId || !privateKey) {
    return {};
  }
  const nonce = generateNonce();
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${sessionId}:${nonce}:${timestamp}`;
  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  const signature = sign.sign(privateKey, 'base64');

  return {
    'X-TF-Signature': signature,
    'X-TF-Nonce': nonce,
    'X-TF-Timestamp': String(timestamp),
    'X-TF-Device-ID': deviceId,
  };
}

const server = new Server(
  { name: 'tokenforge', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'tokenforge_bind',
      description: 'Bind this agent to a session with ECDSA device key. Call once at start.',
      inputSchema: {
        type: 'object' as const,
        properties: { sessionId: { type: 'string', description: 'Session/agent ID' } },
        required: ['sessionId'],
      },
    },
    {
      name: 'tokenforge_sign',
      description: 'Get X-TF-* headers to sign an outbound HTTP request.',
      inputSchema: {
        type: 'object' as const,
        properties: { sessionId: { type: 'string', description: 'Session/agent ID' } },
        required: ['sessionId'],
      },
    },
    {
      name: 'tokenforge_status',
      description: 'Check if this agent is device-bound and get the device ID.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'tokenforge_bind': {
      const sid = (args as { sessionId: string }).sessionId;
      const id = await bind(sid);
      return { content: [{ type: 'text', text: `Bound. Device ID: ${id}` }] };
    }
    case 'tokenforge_sign': {
      const sid = (args as { sessionId: string }).sessionId;
      const headers = getSignHeaders(sid);
      if (!Object.keys(headers).length) {
        return { content: [{ type: 'text', text: 'Not bound. Call tokenforge_bind first.' }] };
      }
      return {
        content: [{
          type: 'text',
          text: `Add these headers to your request:\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')}`,
        }],
      };
    }
    case 'tokenforge_status': {
      return {
        content: [{
          type: 'text',
          text: bound
            ? `Bound. Device ID: ${deviceId}`
            : 'Not bound. Call tokenforge_bind to start.',
        }],
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
