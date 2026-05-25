/**
 * Tests for LoginScreen.
 * Validates form render, validation, submit success/error.
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test-utils/render';
import { LoginScreen } from '../../auth/LoginScreen';
import { useAuthStore } from '../../../store/authStore';

jest.mock('../../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    accent: '#007AFF',
    error: '#FF3B30',
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
    fill: '#F0F0F0',
  }),
}));

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate } as any;
const mockRoute = { key: 'Login', name: 'Login' as const, params: undefined };

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    isLoading: false,
    error: null,
    isInitialized: true,
  });
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('renders email and password fields', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Welcome Back')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Min 8 characters')).toBeTruthy();
  });

  it('renders Sign In button', () => {
    const { getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Sign In')).toBeTruthy();
  });

  it('shows error when email is empty', async () => {
    const { getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows error when password is too short', async () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Min 8 characters'), 'short');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters')).toBeTruthy();
    });
  });

  it('calls login on valid submit', async () => {
    const loginFn = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ login: loginFn } as any);

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@lunaos.ai');
    fireEvent.changeText(getByPlaceholderText('Min 8 characters'), 'Test1234!');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(loginFn).toHaveBeenCalledWith('test@lunaos.ai', 'Test1234!');
    });
  });

  it('displays store error on login failure', async () => {
    useAuthStore.setState({ error: 'Invalid email or password' });

    const { getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Invalid email or password')).toBeTruthy();
  });

  it('navigates to Signup when link is pressed', () => {
    const { getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByText('Sign Up'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });
});
