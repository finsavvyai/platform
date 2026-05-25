/**
 * Tests for SignupScreen.
 * Validates field rendering, validation, submit flow.
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test-utils/render';
import { SignupScreen } from '../../auth/SignupScreen';
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
const mockRoute = { key: 'Signup', name: 'Signup' as const, params: undefined };

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    isLoading: false,
    error: null,
    isInitialized: true,
  });
  jest.clearAllMocks();
});

describe('SignupScreen', () => {
  it('renders name, email, and password fields', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <SignupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Create Account')).toBeTruthy();
    expect(getByPlaceholderText('Your name (optional)')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Min 8 characters')).toBeTruthy();
  });

  it('shows error when email is empty', async () => {
    const { getByText } = renderWithProviders(
      <SignupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows error when password is too short', async () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <SignupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'new@test.com');
    fireEvent.changeText(getByPlaceholderText('Min 8 characters'), 'short');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters')).toBeTruthy();
    });
  });

  it('calls signup on valid submit', async () => {
    const signupFn = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signup: signupFn } as any);

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <SignupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your name (optional)'), 'New User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'new@test.com');
    fireEvent.changeText(getByPlaceholderText('Min 8 characters'), 'NewPass123!');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(signupFn).toHaveBeenCalledWith('new@test.com', 'NewPass123!', 'New User');
    });
  });

  it('displays store error on signup failure', () => {
    useAuthStore.setState({ error: 'Email already exists' });

    const { getByText } = renderWithProviders(
      <SignupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Email already exists')).toBeTruthy();
  });

  it('navigates to Login when link is pressed', () => {
    const { getByText } = renderWithProviders(
      <SignupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByText('Sign In'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});
