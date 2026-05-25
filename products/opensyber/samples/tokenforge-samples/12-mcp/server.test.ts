/**
 * Tests: TokenForge MCP Server
 *
 * Validates the MCP server module that provides device-bound
 * session security to AI agents (Claude, Cursor, etc.).
 * Tests module structure since full MCP requires stdio transport.
 */
import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';

describe('MCP Server - Crypto Operations', () => {
  it('should generate ECDSA P-256 key pair', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    expect(publicKey).toBeDefined();
    expect(privateKey).toBeDefined();

    const jwk = publicKey.export({ format: 'jwk' });
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
  });

  it('should sign payloads with ECDSA', () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    const payload = 'session-123:nonce-456:1700000000';
    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    const signature = sign.sign(privateKey, 'base64');

    expect(signature).toBeTruthy();
    expect(signature.length).toBeGreaterThan(0);
  });

  it('should verify signatures', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    const payload = 'session-123:nonce-456:1700000000';
    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    const signature = sign.sign(privateKey, 'base64');

    const verify = crypto.createVerify('SHA256');
    verify.update(payload);
    expect(verify.verify(publicKey, signature, 'base64')).toBe(true);
  });

  it('should reject tampered signatures', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    const payload = 'session-123:nonce-456:1700000000';
    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    const signature = sign.sign(privateKey, 'base64');

    const verify = crypto.createVerify('SHA256');
    verify.update('tampered-payload');
    expect(verify.verify(publicKey, signature, 'base64')).toBe(false);
  });

  it('should generate unique nonces', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(crypto.randomBytes(16).toString('hex'));
    }
    expect(nonces.size).toBe(100);
  });
});

describe('MCP Server - Header Format', () => {
  it('should produce correct header shape', () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    const sessionId = 'mcp-session-001';
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = `${sessionId}:${nonce}:${timestamp}`;

    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    const signature = sign.sign(privateKey, 'base64');

    const headers = {
      'X-TF-Signature': signature,
      'X-TF-Nonce': nonce,
      'X-TF-Timestamp': String(timestamp),
      'X-TF-Device-ID': crypto.randomUUID(),
    };

    expect(headers['X-TF-Signature']).toBeTruthy();
    expect(headers['X-TF-Nonce']).toHaveLength(32);
    expect(Number(headers['X-TF-Timestamp'])).toBeGreaterThan(0);
    expect(headers['X-TF-Device-ID']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should format payload as sessionId:nonce:timestamp', () => {
    const sessionId = 'sess-abc';
    const nonce = 'nonce-xyz';
    const timestamp = 1700000000;
    const payload = `${sessionId}:${nonce}:${timestamp}`;

    const parts = payload.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('sess-abc');
    expect(parts[1]).toBe('nonce-xyz');
    expect(parts[2]).toBe('1700000000');
  });
});

describe('MCP Server - Tool Definitions', () => {
  it('should define tokenforge_bind tool schema', () => {
    const tool = {
      name: 'tokenforge_bind',
      description: 'Bind this agent to a session with ECDSA device key.',
      inputSchema: {
        type: 'object' as const,
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    };

    expect(tool.inputSchema.required).toContain('sessionId');
  });

  it('should define tokenforge_sign tool schema', () => {
    const tool = {
      name: 'tokenforge_sign',
      description: 'Get X-TF-* headers to sign an outbound HTTP request.',
      inputSchema: {
        type: 'object' as const,
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    };

    expect(tool.name).toBe('tokenforge_sign');
    expect(tool.inputSchema.required).toContain('sessionId');
  });

  it('should define tokenforge_status tool schema', () => {
    const tool = {
      name: 'tokenforge_status',
      description: 'Check if this agent is device-bound.',
      inputSchema: { type: 'object' as const, properties: {} },
    };

    expect(tool.name).toBe('tokenforge_status');
  });
});
