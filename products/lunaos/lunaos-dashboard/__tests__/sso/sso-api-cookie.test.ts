/**
 * lib/api/sso.ts — cookie-credentialed fetch (FIND-005).
 *
 * Asserts every SSO API call:
 *   - sets `credentials: 'include'`
 *   - does NOT attach an `Authorization: Bearer …` header
 *   - forwards a server-side `Cookie:` header when `ctx.cookie` is provided
 */
import { ssoApi } from '../../lib/api/sso';

const originalFetch = global.fetch;

function mockOk(body: unknown = {}) {
    return jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
}

function lastInit(fetchMock: jest.Mock): RequestInit {
    return fetchMock.mock.calls[0][1] as RequestInit;
}

function lastHeaders(fetchMock: jest.Mock): Record<string, string> {
    return (lastInit(fetchMock).headers ?? {}) as Record<string, string>;
}

afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
});

describe('ssoApi — credentials: include on every call (FIND-005)', () => {
    it('list() sets credentials: include', async () => {
        const fetchMock = mockOk({ idps: [] });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.list();
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('get() sets credentials: include', async () => {
        const fetchMock = mockOk({ idp: { id: 'x' } });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.get('x');
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('create() sets credentials: include', async () => {
        const fetchMock = mockOk({ idp: { id: 'new' } });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.create({
            name: 'Test', type: 'oidc', emailDomain: 'a.com',
            defaultRole: 'member', jitEnabled: true,
        });
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('update() sets credentials: include', async () => {
        const fetchMock = mockOk({ idp: { id: 'x' } });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.update('x', { enabled: false });
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('remove() sets credentials: include', async () => {
        const fetchMock = mockOk();
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.remove('x');
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('discover() sets credentials: include', async () => {
        const fetchMock = mockOk({ idpId: '1', type: 'oidc', initiateUrl: '/x' });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.discover('a@b.com');
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('initiateOidc() sets credentials: include', async () => {
        const fetchMock = mockOk({ redirectUrl: 'https://idp/auth' });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.initiateOidc('idp-1');
        expect(lastInit(fetchMock).credentials).toBe('include');
    });

    it('initiateSaml() sets credentials: include', async () => {
        const fetchMock = mockOk({ method: 'POST', url: 'https://idp/sso', params: {} });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.initiateSaml('idp-2');
        expect(lastInit(fetchMock).credentials).toBe('include');
    });
});

describe('ssoApi — never attaches Authorization Bearer header (FIND-005)', () => {
    it('list() does NOT attach Authorization header', async () => {
        const fetchMock = mockOk({ idps: [] });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.list();
        const headers = lastHeaders(fetchMock);
        expect(headers['Authorization']).toBeUndefined();
        expect(headers['authorization']).toBeUndefined();
    });

    it('create() does NOT attach Authorization header', async () => {
        const fetchMock = mockOk({ idp: { id: 'new' } });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.create({
            name: 'Test', type: 'oidc', emailDomain: 'a.com',
            defaultRole: 'member', jitEnabled: true,
        });
        const headers = lastHeaders(fetchMock);
        expect(headers['Authorization']).toBeUndefined();
        expect(headers['authorization']).toBeUndefined();
    });

    it('does NOT read luna_token from localStorage', async () => {
        // Even with a token in localStorage, no Authorization header is attached.
        const setItem = jest.spyOn(Storage.prototype, 'getItem');
        try {
            window.localStorage.setItem('luna_token', 'should-never-be-sent');
            const fetchMock = mockOk({ idps: [] });
            global.fetch = fetchMock as unknown as typeof fetch;
            await ssoApi.list();
            const headers = lastHeaders(fetchMock);
            expect(headers['Authorization']).toBeUndefined();
            // Confirm we never read luna_token (defence in depth)
            const readKeys = setItem.mock.calls.map((c) => c[0]);
            expect(readKeys).not.toContain('luna_token');
        } finally {
            setItem.mockRestore();
            window.localStorage.removeItem('luna_token');
        }
    });
});

describe('ssoApi — server-component cookie forwarding', () => {
    it('list({ cookie }) forwards Cookie header to engine', async () => {
        const fetchMock = mockOk({ idps: [] });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.list({ cookie: 'sso_session=abc.def' });
        const headers = lastHeaders(fetchMock);
        expect(headers['Cookie']).toBe('sso_session=abc.def');
    });

    it('get({ cookie }) forwards Cookie header to engine', async () => {
        const fetchMock = mockOk({ idp: { id: 'x' } });
        global.fetch = fetchMock as unknown as typeof fetch;
        await ssoApi.get('x', { cookie: 'sso_session=zzz' });
        const headers = lastHeaders(fetchMock);
        expect(headers['Cookie']).toBe('sso_session=zzz');
    });
});
