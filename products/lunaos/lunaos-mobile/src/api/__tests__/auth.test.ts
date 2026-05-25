/**
 * Tests for the auth API module.
 * Validates login, signup, getMe endpoints.
 */

import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/mocks/server';
import { login, signup, getMe } from '../auth';
import { mockAuthResponse, mockUser } from '../../test-utils/mocks/fixtures';

const BASE_URL = 'https://api.lunaos.ai';

jest.mock('../../utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue('test-token'),
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('login', () => {
  it('sends POST /auth/login with credentials', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockAuthResponse);
      }),
    );

    const result = await login({ email: 'test@lunaos.ai', password: 'pass' });
    expect(capturedBody).toEqual({ email: 'test@lunaos.ai', password: 'pass' });
    expect(result.token).toBe(mockAuthResponse.token);
    expect(result.user.id).toBe(mockUser.id);
  });

  it('throws on invalid credentials', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/login`, () =>
        HttpResponse.json({ error: 'Invalid email or password' }, { status: 401 }),
      ),
    );

    await expect(
      login({ email: 'bad@test.com', password: 'wrong' }),
    ).rejects.toThrow('Invalid email or password');
  });
});

describe('signup', () => {
  it('sends POST /auth/signup with user data', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/auth/signup`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { token: 'new-token', user: { ...mockUser, id: 'user-new' } },
          { status: 201 },
        );
      }),
    );

    const result = await signup({
      email: 'new@test.com',
      password: 'NewPass1!',
      name: 'New',
    });

    expect(capturedBody).toEqual({
      email: 'new@test.com',
      password: 'NewPass1!',
      name: 'New',
    });
    expect(result.token).toBe('new-token');
  });

  it('throws on duplicate email', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/signup`, () =>
        HttpResponse.json({ error: 'Email already exists' }, { status: 409 }),
      ),
    );

    await expect(
      signup({ email: 'dup@test.com', password: 'Pass1234!' }),
    ).rejects.toThrow('Email already exists');
  });
});

describe('getMe', () => {
  it('fetches current user from GET /auth/me', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json({ user: mockUser }),
      ),
    );

    const result = await getMe();
    expect(result.user).toEqual(mockUser);
  });

  it('throws on unauthorized', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );

    await expect(getMe()).rejects.toThrow('Unauthorized');
  });
});
