/**
 * Tests for auth Zustand store.
 * Validates login, signup, logout, restore state management.
 */

import { act } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';
import * as authApi from '../../api/auth';
import * as storage from '../../utils/storage';
import { mockUser, mockAuthResponse } from '../../test-utils/mocks/fixtures';

jest.mock('../../api/auth');
jest.mock('../../utils/storage');
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockStorage = storage as jest.Mocked<typeof storage>;

beforeEach(() => {
  // Reset Zustand store between tests
  useAuthStore.setState({
    user: null,
    isLoading: false,
    isInitialized: false,
    error: null,
  });
  jest.clearAllMocks();
});

describe('useAuthStore', () => {
  describe('login', () => {
    it('sets user and stores token on success', async () => {
      mockAuthApi.login.mockResolvedValue(mockAuthResponse);
      mockStorage.setToken.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().login('test@lunaos.ai', 'Pass1234!');
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockStorage.setToken).toHaveBeenCalledWith(mockAuthResponse.token);
    });

    it('sets isLoading during login', async () => {
      let loadingDuringCall = false;
      mockAuthApi.login.mockImplementation(() => {
        loadingDuringCall = useAuthStore.getState().isLoading;
        return Promise.resolve(mockAuthResponse);
      });

      await act(async () => {
        await useAuthStore.getState().login('test@lunaos.ai', 'Pass1234!');
      });

      expect(loadingDuringCall).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure and re-throws', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        act(async () => {
          await useAuthStore.getState().login('bad@test.com', 'wrong');
        }),
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('signup', () => {
    it('sets user and stores token on success', async () => {
      mockAuthApi.signup.mockResolvedValue(mockAuthResponse);
      mockStorage.setToken.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().signup('test@lunaos.ai', 'Pass1234!', 'Test');
      });

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(mockStorage.setToken).toHaveBeenCalledWith(mockAuthResponse.token);
    });

    it('sets error on failure', async () => {
      mockAuthApi.signup.mockRejectedValue(new Error('Email exists'));

      await expect(
        act(async () => {
          await useAuthStore.getState().signup('dup@test.com', 'Pass!', 'Dup');
        }),
      ).rejects.toThrow('Email exists');

      expect(useAuthStore.getState().error).toBe('Email exists');
    });
  });

  describe('logout', () => {
    it('clears user and removes token', async () => {
      useAuthStore.setState({ user: mockUser });
      mockStorage.removeToken.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().error).toBeNull();
      expect(mockStorage.removeToken).toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('restores user from stored token', async () => {
      mockStorage.getToken.mockResolvedValue('stored-token');
      mockAuthApi.getMe.mockResolvedValue({ user: mockUser });

      await act(async () => {
        await useAuthStore.getState().restore();
      });

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it('sets initialized with no user when no token', async () => {
      mockStorage.getToken.mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().restore();
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it('clears token and initializes on getMe failure', async () => {
      mockStorage.getToken.mockResolvedValue('expired-token');
      mockAuthApi.getMe.mockRejectedValue(new Error('Token expired'));

      await act(async () => {
        await useAuthStore.getState().restore();
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(mockStorage.removeToken).toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useAuthStore.setState({ error: 'some error' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
