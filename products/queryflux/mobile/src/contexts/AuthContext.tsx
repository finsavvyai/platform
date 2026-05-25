/**
 * Authentication context for managing user authentication state
 */

import React, {createContext, useContext, useReducer, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {showMessage} from 'react-native-flash-message';

import {ApiService} from '../services/ApiService';
import {StorageService} from '../services/StorageService';

interface User {
  id: string;
  username: string;
  email?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
}

type AuthAction =
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'LOGIN_SUCCESS'; payload: {user: User; token: string}}
  | {type: 'LOGOUT'}
  | {type: 'RESTORE_AUTH'; payload: {user: User; token: string}};

interface AuthContextType extends AuthState {
  login: (username: string, password: string, serverUrl: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {...state, isLoading: action.payload};
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        token: action.payload.token,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
      };
    case 'RESTORE_AUTH':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        token: action.payload.token,
      };
    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    restoreAuthState();
  }, []);

  const restoreAuthState = async () => {
    try {
      const [storedToken, storedUser, serverUrl] = await Promise.all([
        StorageService.getSecureItem('auth_token'),
        StorageService.getItem('user'),
        StorageService.getItem('server_url'),
      ]);

      if (storedToken && storedUser && serverUrl) {
        // Set API base URL
        ApiService.setBaseURL(serverUrl);
        ApiService.setAuthToken(storedToken);

        // Verify token is still valid
        try {
          await ApiService.get('/auth/verify');
          
          dispatch({
            type: 'RESTORE_AUTH',
            payload: {
              user: JSON.parse(storedUser),
              token: storedToken,
            },
          });
        } catch (error) {
          // Token is invalid, clear stored data
          await clearStoredAuth();
          dispatch({type: 'SET_LOADING', payload: false});
        }
      } else {
        dispatch({type: 'SET_LOADING', payload: false});
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
      dispatch({type: 'SET_LOADING', payload: false});
    }
  };

  const clearStoredAuth = async () => {
    await Promise.all([
      StorageService.removeSecureItem('auth_token'),
      StorageService.removeItem('user'),
    ]);
  };

  const login = async (username: string, password: string, serverUrl: string): Promise<boolean> => {
    dispatch({type: 'SET_LOADING', payload: true});

    try {
      // Set API base URL
      ApiService.setBaseURL(serverUrl);

      // Attempt login
      const response = await ApiService.post('/auth/login', {
        username,
        password,
      });

      const {user, token} = response.data;

      // Store authentication data
      await Promise.all([
        StorageService.setSecureItem('auth_token', token),
        StorageService.setItem('user', JSON.stringify(user)),
        StorageService.setItem('server_url', serverUrl),
      ]);

      // Set auth token for future requests
      ApiService.setAuthToken(token);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {user, token},
      });

      showMessage({
        message: 'Login Successful',
        description: `Welcome back, ${user.username}!`,
        type: 'success',
      });

      return true;
    } catch (error: any) {
      dispatch({type: 'SET_LOADING', payload: false});
      
      const errorMessage = error.response?.data?.message || 'Login failed';
      showMessage({
        message: 'Login Failed',
        description: errorMessage,
        type: 'danger',
      });

      return false;
    }
  };

  const logout = async () => {
    dispatch({type: 'SET_LOADING', payload: true});

    try {
      // Notify server of logout
      await ApiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if server request fails
      console.warn('Failed to notify server of logout:', error);
    }

    // Clear stored authentication data
    await clearStoredAuth();
    
    // Clear API auth token
    ApiService.clearAuthToken();

    dispatch({type: 'LOGOUT'});

    showMessage({
      message: 'Logged Out',
      description: 'You have been successfully logged out',
      type: 'info',
    });
  };

  const updateServerUrl = async (url: string) => {
    await StorageService.setItem('server_url', url);
    ApiService.setBaseURL(url);
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    updateServerUrl,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};