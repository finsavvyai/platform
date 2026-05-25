/**
 * LunaOS API Client — Unit Tests
 * Full coverage of auth, agents, and health endpoints
 */

import { authApi, agentsApi, healthApi, getAuthToken, setAuthToken, removeAuthToken } from '../api';

// Helper to mock fetch responses
function mockFetchResponse(data: unknown, ok = true, status = 200) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok,
        status,
        json: () => Promise.resolve(data),
    });
}

function mockFetchError(message: string) {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(message));
}

describe('Auth Helpers', () => {
    test('getAuthToken returns null when no token is set', () => {
        (localStorage.getItem as jest.Mock).mockReturnValueOnce(null);
        expect(getAuthToken()).toBeNull();
    });

    test('setAuthToken stores token in localStorage', () => {
        setAuthToken('test-token-123');
        expect(localStorage.setItem).toHaveBeenCalledWith('luna_token', 'test-token-123');
    });

    test('getAuthToken returns stored token', () => {
        (localStorage.getItem as jest.Mock).mockReturnValueOnce('my-token');
        expect(getAuthToken()).toBe('my-token');
    });

    test('removeAuthToken removes token from localStorage', () => {
        removeAuthToken();
        expect(localStorage.removeItem).toHaveBeenCalledWith('luna_token');
    });
});

describe('authApi', () => {
    describe('login', () => {
        test('sends POST with email and password', async () => {
            mockFetchResponse({ token: 'jwt-token-abc', user: { id: '1', email: 'test@luna.ai' } });

            const result = await authApi.login('test@luna.ai', 'password123');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/login'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ email: 'test@luna.ai', password: 'password123' }),
                })
            );
            expect(result.ok).toBe(true);
            expect(result.data.token).toBe('jwt-token-abc');
        });

        test('stores JWT token on successful login', async () => {
            mockFetchResponse({ token: 'jwt-token-abc' });

            await authApi.login('test@luna.ai', 'password123');

            expect(localStorage.setItem).toHaveBeenCalledWith('luna_token', 'jwt-token-abc');
        });

        test('does not store token on failed login', async () => {
            mockFetchResponse({ error: 'Invalid credentials' }, false, 401);

            const result = await authApi.login('test@luna.ai', 'wrong');

            expect(result.ok).toBe(false);
            expect(result.status).toBe(401);
            expect(localStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('signup', () => {
        test('sends POST with email, password, and name', async () => {
            mockFetchResponse({ token: 'new-token', user: { id: '2', email: 'new@luna.ai', name: 'Luna' } });

            const result = await authApi.signup('new@luna.ai', 'securepass', 'Luna');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/signup'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ email: 'new@luna.ai', password: 'securepass', name: 'Luna' }),
                })
            );
            expect(result.ok).toBe(true);
        });

        test('stores JWT token on successful signup', async () => {
            mockFetchResponse({ token: 'new-user-token' });

            await authApi.signup('new@luna.ai', 'securepass', 'Luna');

            expect(localStorage.setItem).toHaveBeenCalledWith('luna_token', 'new-user-token');
        });

        test('returns error data on failed signup', async () => {
            mockFetchResponse({ error: 'Email already exists' }, false, 409);

            const result = await authApi.signup('existing@luna.ai', 'pass', 'Test');

            expect(result.ok).toBe(false);
            expect(result.data.error).toBe('Email already exists');
        });
    });

    describe('me', () => {
        test('fetches authenticated user profile', async () => {
            (localStorage.getItem as jest.Mock).mockReturnValue('valid-token');
            mockFetchResponse({ user: { id: '1', email: 'test@luna.ai', name: 'Shahar', tier: 'pro' } });

            const user = await authApi.me();

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/me'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer valid-token',
                    }),
                })
            );
            expect(user).toEqual({ id: '1', email: 'test@luna.ai', name: 'Shahar', tier: 'pro' });
        });

        test('returns null when not authenticated', async () => {
            mockFetchResponse({ error: 'Unauthorized' }, false, 401);

            const user = await authApi.me();

            expect(user).toBeNull();
        });
    });

    describe('logout', () => {
        test('removes auth token', () => {
            authApi.logout();
            expect(localStorage.removeItem).toHaveBeenCalledWith('luna_token');
        });
    });

    describe('isAuthenticated', () => {
        test('returns false when no token', () => {
            (localStorage.getItem as jest.Mock).mockReturnValueOnce(null);
            expect(authApi.isAuthenticated()).toBe(false);
        });

        test('returns true when token exists', () => {
            (localStorage.getItem as jest.Mock).mockReturnValue('some-token');
            expect(authApi.isAuthenticated()).toBe(true);
        });
    });
});

describe('agentsApi', () => {
    describe('list', () => {
        test('fetches agent list from /agents/list', async () => {
            const mockAgents = {
                agents: [
                    { slug: 'code-review', name: 'Code Review', category: 'review', tier: 'free', hasSystemPrompt: true },
                    { slug: 'security-scan', name: 'Security Scan', category: 'security', tier: 'pro', hasSystemPrompt: true },
                ],
                total: 2,
                free: 1,
                pro: 1,
            };
            mockFetchResponse(mockAgents);

            const result = await agentsApi.list();

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/agents/list'),
                expect.any(Object)
            );
            expect(result.agents).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.free).toBe(1);
            expect(result.pro).toBe(1);
        });
    });

    describe('execute', () => {
        test('sends POST to /agents/execute with agent and context', async () => {
            const mockResponse = {
                ok: true,
                body: null,
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await agentsApi.execute('code-review', 'function add(a, b) { return a + b; }');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/agents/execute'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        agent: 'code-review',
                        context: 'function add(a, b) { return a + b; }',
                    }),
                })
            );
            expect(result).toBe(mockResponse);
        });

        test('includes optional provider and model', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: null });

            await agentsApi.execute('code-review', 'test context', {
                provider: 'anthropic',
                model: 'claude-3-opus',
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/agents/execute'),
                expect.objectContaining({
                    body: JSON.stringify({
                        agent: 'code-review',
                        context: 'test context',
                        provider: 'anthropic',
                        model: 'claude-3-opus',
                    }),
                })
            );
        });

        test('includes auth token in headers', async () => {
            (localStorage.getItem as jest.Mock).mockReturnValue('my-auth-token');
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: null });

            await agentsApi.execute('code-review', 'context');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer my-auth-token',
                    }),
                })
            );
        });
    });

    describe('executions', () => {
        test('fetches execution history', async () => {
            const mockExecs = {
                executions: [
                    {
                        id: 'exec-1',
                        agent: 'code-review',
                        provider: 'deepseek',
                        model: 'deepseek-chat',
                        duration_ms: 3200,
                        created_at: '2026-02-08T00:00:00Z',
                    },
                ],
                count: 1,
            };
            mockFetchResponse(mockExecs);

            const result = await agentsApi.executions();

            expect(result.executions).toHaveLength(1);
            expect(result.executions[0].agent).toBe('code-review');
            expect(result.count).toBe(1);
        });
    });
});

describe('healthApi', () => {
    test('checks API health without auth', async () => {
        mockFetchResponse({ status: 'ok', version: '1.0.0', timestamp: '2026-02-08T00:00:00Z' });

        const result = await healthApi.check();

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/health')
        );
        expect(result.status).toBe('ok');
    });

    test('handles health check failure', async () => {
        mockFetchError('Network unreachable');

        await expect(healthApi.check()).rejects.toThrow('Network unreachable');
    });
});

describe('API URL configuration', () => {
    test('uses NEXT_PUBLIC_API_URL env or defaults to https://api.lunaos.ai', async () => {
        mockFetchResponse({ status: 'ok' });

        await healthApi.check();

        const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
        expect(calledUrl).toMatch(/^https:\/\/api\.lunaos\.ai/);
    });
});

describe('Token edge cases', () => {
    test('execute without auth token omits Authorization header', async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(null);
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: null });

        await agentsApi.execute('code-review', 'test');

        const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
        expect(headers).not.toHaveProperty('Authorization');
    });
});
