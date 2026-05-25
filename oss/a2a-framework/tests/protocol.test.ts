import { describe, it, expect, beforeEach, vi } from 'vitest';
import { A2AProtocol } from '../src/services/protocol';

describe('A2AProtocol', () => {
  let protocol: A2AProtocol;

  beforeEach(() => {
    protocol = new A2AProtocol();
  });

  it('should create valid handshake', () => {
    const hs = protocol.createHandshake('agent1', ['cap1', 'cap2']);
    expect(hs.agentId).toBe('agent1');
    expect(hs.version).toBe('1.0.0');
    expect(hs.capabilities).toContain('cap1');
  });

  it('should throw on empty agentId', () => {
    expect(() => {
      protocol.createHandshake('', []);
    }).toThrow('agentId is required');
  });

  it('should validate correct handshake', () => {
    const hs = protocol.createHandshake('agent1', ['cap1']);
    expect(protocol.validateHandshake(hs)).toBe(true);
  });

  it('should reject invalid handshake', () => {
    expect(protocol.validateHandshake({ agentId: '', version: '', capabilities: [] })).toBe(false);
  });

  it('should create request with generated requestId', () => {
    const req = protocol.createRequest('getStatus', { id: '123' });
    expect(req.requestId).toBeDefined();
    expect(req.method).toBe('getStatus');
    expect(req.params.id).toBe('123');
    expect(req.timeout).toBe(30000);
  });

  it('should create request with custom timeout', () => {
    const req = protocol.createRequest('method', {}, 60000);
    expect(req.timeout).toBe(60000);
  });

  it('should throw on empty method', () => {
    expect(() => {
      protocol.createRequest('', {});
    }).toThrow('method is required');
  });

  it('should validate correct request', () => {
    const req = protocol.createRequest('test', {});
    expect(protocol.validateRequest(req)).toBe(true);
  });

  it('should reject invalid request', () => {
    expect(protocol.validateRequest({ requestId: '', method: '' })).toBe(false);
  });

  it('should create success response', () => {
    const res = protocol.createResponse('req123', 'success', { result: 'ok' });
    expect(res.requestId).toBe('req123');
    expect(res.status).toBe('success');
    expect(res.data).toEqual({ result: 'ok' });
  });

  it('should create error response', () => {
    const res = protocol.createResponse('req123', 'error', undefined, 'Not found');
    expect(res.status).toBe('error');
    expect(res.error).toBe('Not found');
  });

  it('should throw on empty requestId in response', () => {
    expect(() => {
      protocol.createResponse('', 'success');
    }).toThrow('requestId is required');
  });

  it('should validate correct response', () => {
    const res = protocol.createResponse('req1', 'success', {});
    expect(protocol.validateResponse(res)).toBe(true);
  });

  it('should reject invalid response', () => {
    expect(protocol.validateResponse({ requestId: '', status: 'success' })).toBe(false);
  });

  it('should set request timeout', (done) => {
    const onTimeout = vi.fn();
    const requestId = 'req1';

    protocol.setRequestTimeout(requestId, 100, onTimeout);

    setTimeout(() => {
      expect(onTimeout).toHaveBeenCalled();
      done();
    }, 150);
  });

  it('should clear request timeout', (done) => {
    const onTimeout = vi.fn();
    const requestId = 'req1';

    protocol.setRequestTimeout(requestId, 200, onTimeout);
    protocol.clearRequestTimeout(requestId);

    setTimeout(() => {
      expect(onTimeout).not.toHaveBeenCalled();
      done();
    }, 250);
  });

  it('should return version', () => {
    expect(protocol.getVersion()).toBe('1.0.0');
  });
});
