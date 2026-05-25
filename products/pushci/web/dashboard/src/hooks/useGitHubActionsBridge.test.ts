// Tests for useGitHubActionsBridge — typed client over /api/github-actions/*.
// License: Apache-2.0
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitHubActionsBridge } from './useGitHubActionsBridge';

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

describe('useGitHubActionsBridge', () => {
  it('connect posts token body and returns connection', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      mockOk({ connection: { id: 'c1', label: 'Work', tokenPreview: 'ghp_…abcd', scopes: [], created_at: '', updated_at: '' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGitHubActionsBridge());
    let conn;
    await act(async () => { conn = await result.current.connect({ token: 'ghp_secret1234567890' }); });
    expect(conn).toMatchObject({ id: 'c1', tokenPreview: 'ghp_…abcd' });
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toContain('/api/github-actions/connect');
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.headers).toMatchObject({ Authorization: 'Bearer test-jwt' });
  });

  it('listConnections unwraps connections array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(mockOk({ connections: [{ id: 'a' }] })));
    const { result } = renderHook(() => useGitHubActionsBridge());
    const list = await result.current.listConnections();
    expect(list).toHaveLength(1);
  });

  it('listRepos hits the connections/:id/repos path with encoded search', async () => {
    const fetchMock = vi.fn().mockReturnValue(mockOk({ repos: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGitHubActionsBridge());
    await result.current.listRepos('c 1', 'my repo');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/github-actions/connections/c%201/repos?search=my%20repo');
  });

  it('listRuns encodes workflowId and branch as query string', async () => {
    const fetchMock = vi.fn().mockReturnValue(mockOk({ runs: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGitHubActionsBridge());
    await result.current.listRuns('c', 'acme', 'web', { workflowId: 42, branch: 'dev' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/github-actions/bridge/c/acme/web/runs?');
    expect(url).toContain('workflowId=42');
    expect(url).toContain('branch=dev');
  });

  it('dispatch posts body with workflowId + ref + inputs', async () => {
    const fetchMock = vi.fn().mockReturnValue(mockOk({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGitHubActionsBridge());
    const res = await result.current.dispatch('c', 'acme', 'web', {
      workflowId: 7, ref: 'main', inputs: { env: 'prod' },
    });
    expect(res.ok).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ workflowId: 7, ref: 'main', inputs: { env: 'prod' } });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/github-actions/bridge/c/acme/web/dispatch');
  });

  it('throws server error message on non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(mockErr(401, { error: 'bad token' })));
    const { result } = renderHook(() => useGitHubActionsBridge());
    await expect(result.current.listRepos('c')).rejects.toThrow('bad token');
  });
});
