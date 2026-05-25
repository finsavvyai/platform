import { describe, expect, it } from 'vitest';
import { parseMessage, formatResponse, formatError, ErrorCode } from './protocol';

describe('JSON-RPC 2.0 Protocol', () => {
  describe('parseMessage', () => {
    it('should parse a valid JSON-RPC request', () => {
      const msg = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      const result = parseMessage(msg);
      expect(result.jsonrpc).toBe('2.0');
      expect(result.id).toBe(1);
      expect(result.method).toBe('tools/list');
    });

    it('should parse request with params', () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0', id: 'abc', method: 'tools/call',
        params: { name: 'tenantiq.list_tenants' },
      });
      const result = parseMessage(msg);
      expect(result.params).toEqual({ name: 'tenantiq.list_tenants' });
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseMessage('not-json')).toThrow('Invalid JSON');
    });

    it('should throw when jsonrpc field is missing', () => {
      expect(() => parseMessage('{"id":1,"method":"test"}')).toThrow('jsonrpc');
    });

    it('should throw when id is missing', () => {
      expect(() => parseMessage('{"jsonrpc":"2.0","method":"test"}')).toThrow('id');
    });

    it('should throw when method is missing', () => {
      expect(() => parseMessage('{"jsonrpc":"2.0","id":1}')).toThrow('method');
    });

    it('should throw when params is not an object', () => {
      const msg = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test', params: 'bad' });
      expect(() => parseMessage(msg)).toThrow('Params');
    });
  });

  describe('formatResponse', () => {
    it('should format a success response', () => {
      const raw = formatResponse(1, { tools: [] });
      const parsed = JSON.parse(raw);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(1);
      expect(parsed.result).toEqual({ tools: [] });
      expect(parsed.error).toBeUndefined();
    });
  });

  describe('formatError', () => {
    it('should format an error response', () => {
      const raw = formatError(1, ErrorCode.METHOD_NOT_FOUND, 'Not found');
      const parsed = JSON.parse(raw);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(1);
      expect(parsed.error.code).toBe(-32601);
      expect(parsed.error.message).toBe('Not found');
    });

    it('should handle null id', () => {
      const raw = formatError(null, ErrorCode.PARSE_ERROR, 'Bad');
      const parsed = JSON.parse(raw);
      expect(parsed.id).toBe(0);
    });
  });
});
