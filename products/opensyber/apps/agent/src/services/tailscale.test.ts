import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock before dynamic import so the module picks up the mock
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));
vi.mock('node:util', () => ({
  promisify: (fn: unknown) => fn,
}));

import * as childProcess from 'node:child_process';

const execFileMock = vi.mocked(childProcess.execFile);

// Dynamic import after mocks are registered
const { connectTailscale, getTailscaleStatus, resolveApiUrl, isTailscaleInstalled } =
  await import('./tailscale.js');

const VALID_CONFIG = {
  authKey: 'tskey-auth-test',
  tailnet: 'example.com',
  instanceId: 'abc123',
  apiBaseUrl: 'https://api.example.com',
};

const RUNNING_STATUS_JSON = JSON.stringify({
  BackendState: 'Running',
  Self: {
    HostName: 'agent-abc123',
    TailscaleIPs: ['100.64.0.1'],
    DNSName: 'agent-abc123.example.ts.net',
  },
});

describe('connectTailscale', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects instanceId with special characters', async () => {
    await expect(
      connectTailscale({ ...VALID_CONFIG, instanceId: 'bad/id' }),
    ).rejects.toThrow('Invalid instanceId format');
  });

  it('rejects instanceId with spaces', async () => {
    await expect(
      connectTailscale({ ...VALID_CONFIG, instanceId: 'bad id' }),
    ).rejects.toThrow('Invalid instanceId format');
  });

  it('rejects instanceId with dots', async () => {
    await expect(
      connectTailscale({ ...VALID_CONFIG, instanceId: 'bad.id' }),
    ).rejects.toThrow('Invalid instanceId format');
  });

  it('accepts valid alphanumeric-with-hyphens instanceId', async () => {
    execFileMock
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never) // tailscale up
      .mockResolvedValueOnce({ stdout: RUNNING_STATUS_JSON, stderr: '' } as never); // tailscale status

    const status = await connectTailscale({ ...VALID_CONFIG, instanceId: 'inst-001' });

    expect(status.connected).toBe(true);
    expect(status.hostname).toBe('agent-abc123');
    expect(status.tailnetIp).toBe('100.64.0.1');
    expect(status.magicDns).toBe('agent-abc123.example.ts.net');
  });

  it('invokes tailscale up with correct hostname flag', async () => {
    execFileMock
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
      .mockResolvedValueOnce({ stdout: RUNNING_STATUS_JSON, stderr: '' } as never);

    await connectTailscale(VALID_CONFIG);

    expect(execFileMock).toHaveBeenCalledWith(
      'tailscale',
      ['up', '--hostname=agent-abc123', '--reset'],
      expect.objectContaining({ env: expect.objectContaining({ TS_AUTHKEY: VALID_CONFIG.authKey }) }),
    );
  });

  it('returns disconnected status when tailscale up fails', async () => {
    execFileMock.mockRejectedValueOnce(new Error('not found') as never);

    const status = await connectTailscale(VALID_CONFIG);

    expect(status.connected).toBe(false);
    expect(status.hostname).toBe('agent-abc123');
    expect(status.tailnetIp).toBeNull();
    expect(status.magicDns).toBeNull();
  });
});

describe('getTailscaleStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns connected status when tailscale reports Running', async () => {
    execFileMock.mockResolvedValueOnce({
      stdout: RUNNING_STATUS_JSON,
      stderr: '',
    } as never);

    const status = await getTailscaleStatus();

    expect(status.connected).toBe(true);
    expect(status.hostname).toBe('agent-abc123');
    expect(status.tailnetIp).toBe('100.64.0.1');
    expect(status.magicDns).toBe('agent-abc123.example.ts.net');
  });

  it('returns disconnected when BackendState is not Running', async () => {
    execFileMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ BackendState: 'Stopped', Self: null }),
      stderr: '',
    } as never);

    const status = await getTailscaleStatus();

    expect(status.connected).toBe(false);
    expect(status.hostname).toBe('');
    expect(status.tailnetIp).toBeNull();
  });

  it('returns safe defaults when execFile throws', async () => {
    execFileMock.mockRejectedValueOnce(new Error('command not found') as never);

    const status = await getTailscaleStatus();

    expect(status.connected).toBe(false);
    expect(status.hostname).toBe('');
    expect(status.tailnetIp).toBeNull();
    expect(status.magicDns).toBeNull();
  });

  it('handles missing Self fields gracefully', async () => {
    execFileMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ BackendState: 'Running', Self: {} }),
      stderr: '',
    } as never);

    const status = await getTailscaleStatus();

    expect(status.connected).toBe(true);
    expect(status.hostname).toBe('');
    expect(status.tailnetIp).toBeNull();
    expect(status.magicDns).toBeNull();
  });
});

describe('resolveApiUrl', () => {
  const PUBLIC_URL = 'https://api.example.com';
  const TS_HOST = 'api.internal.ts.net';

  it('prefers Tailscale host when connected and host is provided', () => {
    const url = resolveApiUrl(
      PUBLIC_URL,
      { connected: true, hostname: 'h', tailnetIp: '100.64.0.1', magicDns: 'h.ts.net' },
      TS_HOST,
    );
    expect(url).toBe(`https://${TS_HOST}`);
  });

  it('falls back to public URL when not connected', () => {
    const url = resolveApiUrl(
      PUBLIC_URL,
      { connected: false, hostname: '', tailnetIp: null, magicDns: null },
      TS_HOST,
    );
    expect(url).toBe(PUBLIC_URL);
  });

  it('falls back to public URL when tailscaleApiHost is undefined', () => {
    const url = resolveApiUrl(
      PUBLIC_URL,
      { connected: true, hostname: 'h', tailnetIp: '100.64.0.1', magicDns: 'h.ts.net' },
    );
    expect(url).toBe(PUBLIC_URL);
  });

  it('falls back to public URL when connected but host is empty string', () => {
    const url = resolveApiUrl(
      PUBLIC_URL,
      { connected: true, hostname: 'h', tailnetIp: '100.64.0.1', magicDns: 'h.ts.net' },
      '',
    );
    expect(url).toBe(PUBLIC_URL);
  });
});

describe('isTailscaleInstalled', () => {
  it('returns true when tailscale version succeeds', async () => {
    execFileMock.mockResolvedValueOnce({ stdout: '1.60.0', stderr: '' } as never);

    const result = await isTailscaleInstalled();
    expect(result).toBe(true);
  });

  it('returns false when tailscale binary is not found', async () => {
    execFileMock.mockRejectedValueOnce(new Error('ENOENT') as never);

    const result = await isTailscaleInstalled();
    expect(result).toBe(false);
  });
});
