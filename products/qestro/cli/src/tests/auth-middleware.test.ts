/**
 * Authentication Middleware Tests
 * Tests AWS-style authentication requirements and token management
 */

import AuthMiddleware from '../utils/auth-middleware';
import { config } from '../utils/config';

// Mock config and process.env
jest.mock('../utils/config');
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockConfig = config as jest.Mocked<typeof config>;

describe('AuthMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env
    delete process.env.QESTRO_ACCESS_TOKEN;
  });

  describe('Authentication Requirements', () => {
    test('should allow access to public commands', () => {
      // Mock args to include help
      const originalArgv = process.argv;
      process.argv = ['node', 'cli', '--help'];

      expect(() => {
        AuthMiddleware.requireAuth();
      }).not.toThrow();

      // Restore original argv
      process.argv = originalArgv;
    });

    test('should require authentication for protected commands', () => {
      mockConfig.isAuthenticated.mockReturnValue(false);

      expect(() => {
        AuthMiddleware.requireAuth({ required: true, skipForHelp: false });
      }).toThrow();
    });

    test('should pass when authenticated', () => {
      mockConfig.isAuthenticated.mockReturnValue(true);

      expect(() => {
        AuthMiddleware.requireAuth({ required: true });
      }).not.toThrow();
    });
  });

  describe('Token Validation', () => {
    test('should validate JWT format token', () => {
      mockConfig.get.mockReturnValue({
        accessToken: 'header.payload.signature',
        tokenExpiry: Date.now() + 3600000, // 1 hour from now
      });

      expect(AuthMiddleware.validateToken()).toBe(true);
    });

    test('should reject non-JWT format token', () => {
      mockConfig.get.mockReturnValue({
        accessToken: 'invalid-token',
        tokenExpiry: Date.now() + 3600000,
      });

      expect(AuthMiddleware.validateToken()).toBe(false);
    });

    test('should reject expired token', () => {
      mockConfig.get.mockReturnValue({
        accessToken: 'header.payload.signature',
        tokenExpiry: Date.now() - 1000, // 1 second ago
      });

      expect(AuthMiddleware.validateToken()).toBe(false);
    });

    test('should reject missing token', () => {
      mockConfig.get.mockReturnValue({
        accessToken: undefined,
        tokenExpiry: Date.now() + 3600000,
      });

      expect(AuthMiddleware.validateToken()).toBe(false);
    });
  });

  describe('Token Information', () => {
    test('should return token information when authenticated', () => {
      const currentTime = Date.now();
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'auth') {
          return {
            accessToken: 'header.payload.signature',
            tokenExpiry: currentTime + 3600000,
          };
        }
        if (key === 'defaults') {
          return {
            region: 'us-west-2',
          };
        }
        return {};
      });
      mockConfig.getCurrentProfile.mockReturnValue('test-profile');

      const tokenInfo = AuthMiddleware.getTokenInfo();

      expect(tokenInfo).toEqual({
        token: 'header.payload.signature',
        expiry: currentTime + 3600000,
        expiresIn: expect.any(Number),
        profile: 'test-profile',
        region: 'us-west-2',
      });
    });

    test('should return null when not authenticated', () => {
      mockConfig.get.mockReturnValue({
        accessToken: undefined,
      });

      expect(AuthMiddleware.getTokenInfo()).toBeNull();
    });

    test('should calculate correct expires in time', () => {
      const currentTime = Date.now();
      const futureTime = currentTime + 1800000; // 30 minutes

      mockConfig.get.mockReturnValue({
        accessToken: 'header.payload.signature',
        tokenExpiry: futureTime,
      });
      mockConfig.getCurrentProfile.mockReturnValue('test');

      const tokenInfo = AuthMiddleware.getTokenInfo();

      expect(tokenInfo?.expiresIn).toBeCloseTo(1800, 0); // 30 minutes in seconds
    });
  });

  describe('Credential Chain Validation', () => {
    test('should prioritize environment variables', () => {
      process.env.QESTRO_ACCESS_TOKEN = 'env-token';

      const result = AuthMiddleware.validateCredentialChain();

      expect(result).toEqual({
        valid: true,
        source: 'environment',
        message: 'Using credentials from environment variables',
      });

      delete process.env.QESTRO_ACCESS_TOKEN;
    });

    test('should use profile when no environment variables', () => {
      mockConfig.isAuthenticated.mockReturnValue(true);

      const result = AuthMiddleware.validateCredentialChain();

      expect(result).toEqual({
        valid: true,
        source: 'profile',
        message: 'Using credentials from profile "default"',
      });
    });

    test('should return no credentials when none available', () => {
      mockConfig.isAuthenticated.mockReturnValue(false);

      const result = AuthMiddleware.validateCredentialChain();

      expect(result).toEqual({
        valid: false,
        source: 'none',
        message: 'No credentials found',
      });
    });
  });

  describe('Command Authentication Check', () => {
    test('should allow public commands', () => {
      const mockCommand = {
        name: () => 'auth',
        parent: null,
      } as any;

      expect(() => {
        AuthMiddleware.checkCommandAuth(mockCommand);
      }).not.toThrow();
    });

    test('should require auth for protected commands', () => {
      mockConfig.isAuthenticated.mockReturnValue(false);

      const mockCommand = {
        name: () => 'projects',
        parent: null,
      } as any;

      expect(() => {
        AuthMiddleware.checkCommandAuth(mockCommand);
      }).toThrow();
    });

    test('should handle nested command paths', () => {
      const mockCommand = {
        name: () => 'list',
        parent: {
          name: () => 'projects',
          parent: null,
        },
      } as any;

      mockConfig.isAuthenticated.mockReturnValue(false);

      expect(() => {
        AuthMiddleware.checkCommandAuth(mockCommand);
      }).toThrow();
    });
  });

  describe('Error Creation', () => {
    test('should create credential error with suggestions', () => {
      const error = AuthMiddleware.createCredentialError();

      expect(error.message).toBe('Unable to locate credentials');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.suggestions).toContain('Run "qestro auth login" to configure credentials');
      expect(error.suggestions).toContain('Check your profile configuration with "qestro config show"');
    });

    test('should create credential error with custom message', () => {
      const customMessage = 'Custom error message';
      const error = AuthMiddleware.createCredentialError(customMessage);

      expect(error.message).toBe(customMessage);
    });
  });

  describe('Status Display', () => {
    test('should show not authenticated status', () => {
      mockConfig.get.mockReturnValue({
        accessToken: undefined,
      });

      // Mock console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      AuthMiddleware.showAuthStatus();

      expect(consoleSpy).toHaveBeenCalledWith('Not authenticated');
      expect(consoleSpy).toHaveBeenCalledWith('Run "qestro auth login" to authenticate');

      consoleSpy.mockRestore();
    });

    test('should show authenticated status', () => {
      const currentTime = Date.now();
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'auth') {
          return {
            accessToken: 'header.payload.signature',
            tokenExpiry: currentTime + 3600000,
          };
        }
        if (key === 'defaults') {
          return {
            region: 'us-east-1',
          };
        }
        return {};
      });
      mockConfig.getCurrentProfile.mockReturnValue('test-profile');

      // Mock console.log and chalk
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.mock('chalk', () => ({
        green: jest.fn((text) => text),
        cyan: jest.fn((text) => text),
        yellow: jest.fn((text) => text),
      }));

      AuthMiddleware.showAuthStatus();

      expect(consoleSpy).toHaveBeenCalledWith('Authenticated');
      expect(consoleSpy).toHaveBeenCalledWith('Profile: test-profile');
      expect(consoleSpy).toHaveBeenCalledWith('Region: us-east-1');

      consoleSpy.mockRestore();
    });

    test('should show expired token status', () => {
      mockConfig.get.mockReturnValue({
        accessToken: 'header.payload.signature',
        tokenExpiry: Date.now() - 1000, // 1 second ago
      });
      mockConfig.getCurrentProfile.mockReturnValue('test');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      AuthMiddleware.showAuthStatus();

      expect(consoleSpy).toHaveBeenCalledWith('Token has expired');

      consoleSpy.mockRestore();
    });
  });
});