import { describe, it, expect } from 'vitest';
import { buildCloudInit, encodeCloudInit } from './cloud-init';

const VALID_OPTS = {
  instanceId: 'inst_abc123',
  gatewayToken: 'gw_token_xyz',
  apiBaseUrl: 'https://api.opensyber.cloud',
  agentImage: 'ghcr.io/opensyber/agent:latest',
};

describe('buildCloudInit', () => {
  it('produces a bash script with the instance ID', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script).toContain('OPENSYBER_INSTANCE_ID=inst_abc123');
  });

  it('includes the gateway token', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script).toContain('OPENSYBER_GATEWAY_TOKEN=gw_token_xyz');
  });

  it('includes the API base URL', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script).toContain('OPENSYBER_API_URL=https://api.opensyber.cloud');
  });

  it('includes the agent Docker image', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script).toContain('ghcr.io/opensyber/agent:latest');
  });

  it('starts with cloud-config header', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script.startsWith('#cloud-config')).toBe(true);
  });

  it('includes Docker install commands', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script).toContain('docker-ce');
    expect(script).toContain('docker pull');
  });

  it('runs agent container with security hardening', () => {
    const script = buildCloudInit(VALID_OPTS);
    expect(script).toContain('opensyber-agent');
    expect(script).toContain('--security-opt no-new-privileges:true');
    expect(script).toContain('--cap-drop ALL');
  });

  it('throws if instanceId is empty', () => {
    expect(() => buildCloudInit({ ...VALID_OPTS, instanceId: '' }))
      .toThrow('instanceId is required');
  });

  it('throws if gatewayToken is empty', () => {
    expect(() => buildCloudInit({ ...VALID_OPTS, gatewayToken: '' }))
      .toThrow('gatewayToken is required');
  });

  it('throws if apiBaseUrl is empty', () => {
    expect(() => buildCloudInit({ ...VALID_OPTS, apiBaseUrl: '' }))
      .toThrow('apiBaseUrl is required');
  });

  it('throws if agentImage is empty', () => {
    expect(() => buildCloudInit({ ...VALID_OPTS, agentImage: '' }))
      .toThrow('agentImage is required');
  });
});

describe('encodeCloudInit', () => {
  it('returns a base64-encoded string', () => {
    const encoded = encodeCloudInit('#!/bin/bash\necho hello');
    const decoded = atob(encoded);
    expect(decoded).toBe('#!/bin/bash\necho hello');
  });

  it('handles empty input', () => {
    const encoded = encodeCloudInit('');
    expect(atob(encoded)).toBe('');
  });
});
