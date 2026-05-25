// Tests for useBitbucketBridge — typed client over /api/bitbucket/*.
// Uses the real `fetch` swapped out via vi.fn for each endpoint.
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBitbucketBridge } from './useBitbucketBridge';

function mockOk<T>(payload: T) {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status: 200, headers: { 'content-type': 'application/json' },
  }));
}

function mockErr(status: number, body: unknown = { error: 'boom' }) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  }));
}

beforeEach(() => {
  localStorage.setItem('pushci_token', 'test-jwt');
});

describe('useBitbucketBridge', () => {
  it('connect posts body and returns connection', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      mockOk({ connection: { id: 'c1', label: 'l', authType: 'bearer', secretPreview: 'x', created_at: '', updated_at: '' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useBitbucketBridge());
    let conn;
    await act(async () => { conn = await result.current.connect({ bearer: 'abc' }); });
    expect(conn).toMatchObject({ id: 'c1', authType: 'bearer' });
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toContain('/api/bitbucket/connect');
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.headers).toMatchObject({ Authorization: 'Bearer test-jwt' });
  });

  it('listConnections unwraps connections array', async () => {
    const fetchMock = vi.fn().mockReturnValue(mockOk({ connections: [{ id: 'a' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useBitbucketBridge());
    const list = await result.current.listConnections();
    expect(list).toHaveLength(1);
  });

  it('listPipelines hits the bridge path with encoded segments', async () => {
    const fetchMock = vi.fn().mockReturnValue(mockOk({ pipelines: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useBitbucketBridge());
    await result.current.listPipelines('c 1', 'my ws', 'my/repo');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/bitbucket/bridge/c%201/my%20ws/my%2Frepo/pipelines');
  });

  it('triggerPipeline posts ref body', async () => {
    const fetchMock = vi.fn().mockReturnValue(mockOk({ triggered: true, pipeline: { uuid: 'u1', build_number: 1, status: 'pending', created_on: '' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useBitbucketBridge());
    const p = await result.current.triggerPipeline('c', 'w', 'r', { ref: 'dev', refType: 'branch' });
    expect(p.uuid).toBe('u1');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ ref: 'dev', refType: 'branch' });
  });

  it('throws on non-ok responses with server error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(mockErr(502, { error: 'upstream dead' })));
    const { result } = renderHook(() => useBitbucketBridge());
    await expect(result.current.listWorkspaces('c')).rejects.toThrow('upstream dead');
  });
});
