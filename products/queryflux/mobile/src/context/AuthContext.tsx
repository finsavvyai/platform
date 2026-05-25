import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppStore } from '@store';
import { User } from '@types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login: storeLogin,
    logout: storeLogout,
    refreshToken: storeRefreshToken,
    setLoading,
    setError,
  } = useAppStore();

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);

        // Check for stored token and validate it
        if (token) {
          // In a real app, you would validate the token with your backend
          // For now, we'll just set the initialized state
          console.log('Auth initialized with stored token');
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setError('Failed to initialize authentication');
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [token, setLoading, setError]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock user data - replace with actual API response
      const mockUser: User = {
        id: 'user-123',
        email,
        name: email.split('@')[0],
        role: 'admin',
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockToken = 'mock-jwt-token';

      await storeLogin(mockUser, mockToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock user data - replace with actual API response
      const mockUser: User = {
        id: 'user-123',
        email,
        name,
        role: 'admin',
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockToken = 'mock-jwt-token';

      await storeLogin(mockUser, mockToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      // Perform any cleanup API calls here
      await storeLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      await storeRefreshToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout the user
      await logout();
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real app, you would call your password reset API
      console.log('Password reset email sent to:', email);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading: loading || !isInitialized,
    error,
    login,
    register,
    logout,
    refreshToken,
    resetPassword,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};