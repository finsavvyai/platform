// Tests for useAuth hook

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { SDLCProvider } from '../../src/react/providers/SDLCProvider';
import { useAuth } from '../../src/react/hooks/useAuth';
import { BaseClient } from '../../src/client/base';

// Mock dependencies
jest.mock('../../src/client/base');
jest.mock('../../src/utils', () => ({
  isNode: false,
  isBrowser: true
}));

const mockedBaseClient = BaseClient as jest.MockedClass<typeof BaseClient>;

describe('useAuth', () => {
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    // Mock client methods
    const mockAuthClient = {
      login: jest.fn(),
      logout: jest.fn(),
      isAuthenticated: jest.fn().mockReturnValue(false),
      getCurrentUser: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      enableMFA: jest.fn(),
      getTokens: jest.fn().mockReturnValue(null),
      on: jest.fn(),
      off: jest.fn()
    };

    const mockClient = {
      auth: mockAuthClient,
      config: { baseURL: 'https://api.test.com' }
    } as any;

    mockedBaseClient.mockImplementation(() => mockClient);

    wrapper = ({ children }) => (
      <SDLCProvider config={{ baseURL: 'https://api.test.com' }} autoAuthenticate={false}>
        {children}
      </SDLCProvider>
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial auth state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBe(null);
    expect(result.current.tokens).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle login successfully', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockTokens = { accessToken: 'token123', refreshToken: 'refresh123' };

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock successful login
    mockedBaseClient.mock.results[0].value.auth.login.mockResolvedValueOnce({
      user: mockUser,
      tokens: mockTokens
    });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle login error', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock login failure
    mockedBaseClient.mock.results[0].value.auth.login.mockRejectedValueOnce(
      new Error('Invalid credentials')
    );

    await act(async () => {
      try {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrong-password'
        });
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Invalid credentials');
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Manually set error
    result.current.error = new Error('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });
});
