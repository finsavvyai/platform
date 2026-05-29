// Tests for AuthClient

import { AuthClient } from '../../src/auth';
import { AuthClientConfig } from '../../src/types';

// Mock BaseClient
jest.mock('../../src/client/base');
import { BaseClient } from '../../src/client/base';

// Mock StorageUtils
jest.mock('../../src/utils');
import { StorageUtils, TokenUtils } from '../../src/utils';

// Mock jwt-decode
jest.mock('jwt-decode');
import { jwtDecode } from 'jwt-decode';

const mockedBaseClient = BaseClient as jest.MockedClass<typeof BaseClient>;
const mockedStorageUtils = StorageUtils as jest.Mocked<typeof StorageUtils>;
const mockedTokenUtils = TokenUtils as jest.Mocked<typeof TokenUtils>;
const mockedJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;

describe('AuthClient', () => {
  let authClient: AuthClient;
  let config: AuthClientConfig;

  beforeEach(() => {
    config = {
      baseURL: 'https://api.sdlc.ai',
      apiKey: 'test-api-key',
      timeout: 5000
    };

    // Mock environment detection
    Object.defineProperty(process, 'versions', { value: { node: '16.0.0' } });
    Object.defineProperty(window, 'undefined', { value: undefined });

    authClient = new AuthClient(config);
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        user: {
          id: 'user-123',
          email: credentials.email,
          firstName: 'Test',
          lastName: 'User'
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer' as const
        }
      };

      mockedBaseClient.prototype.post = jest.fn().mockResolvedValue({
        data: mockResponse
      });

      const result = await authClient.login(credentials);

      expect(result).toEqual(mockResponse);
      expect(authClient.isAuthenticated()).toBe(true);
    });

    it('should throw error with invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrong-password'
      };

      mockedBaseClient.prototype.post = jest.fn().mockRejectedValue({
        response: { status: 401, data: { message: 'Invalid credentials' } }
      });

      await expect(authClient.login(credentials)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      // Set up authenticated state
      authClient['tokens'] = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer'
      };

      mockedBaseClient.prototype.post = jest.fn().mockResolvedValue({});

      await authClient.logout();

      expect(authClient.isAuthenticated()).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      // Set up token state
      authClient['tokens'] = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
        tokenType: 'Bearer'
      };

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer'
      };

      mockedBaseClient.prototype.post = jest.fn().mockResolvedValue({
        data: newTokens
      });

      await authClient.refreshToken();

      expect(authClient.getTokens()).toEqual(newTokens);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no tokens', () => {
      expect(authClient.isAuthenticated()).toBe(false);
    });

    it('should return false when token is expired', () => {
      authClient['tokens'] = {
        accessToken: 'expired-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer'
      };

      mockedTokenUtils.isTokenExpired.mockReturnValue(true);

      expect(authClient.isAuthenticated()).toBe(false);
    });

    it('should return true when token is valid', () => {
      authClient['tokens'] = {
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer'
      };

      mockedTokenUtils.isTokenExpired.mockReturnValue(false);

      expect(authClient.isAuthenticated()).toBe(true);
    });
  });
});
