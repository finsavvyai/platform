/**
 * Tests for SettingsScreen.
 * Validates user info display, tier badge, logout, version.
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test-utils/render';
import { SettingsScreen } from '../../settings/SettingsScreen';
import { useAuthStore } from '../../../store/authStore';
import { mockUser, mockFreeUser } from '../../../test-utils/mocks/fixtures';

jest.mock('../../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    accent: '#007AFF',
    surface: '#fff',
    cardBorder: '#E0E0E0',
    separator: '#E0E0E0',
    tierFree: '#34C759',
    tierPro: '#AF52DE',
    destructive: '#FF3B30',
    fill: '#F0F0F0',
  }),
}));

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  useAuthStore.setState({
    user: mockUser,
    isLoading: false,
    error: null,
  });
  jest.clearAllMocks();
});

describe('SettingsScreen', () => {
  it('renders user name and email', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);

    expect(getByText('Test User')).toBeTruthy();
    expect(getByText('test@lunaos.ai')).toBeTruthy();
  });

  it('renders avatar initial from name', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText('T')).toBeTruthy();
  });

  it('renders tier badge with PRO PLAN', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText('PRO PLAN')).toBeTruthy();
  });

  it('renders FREE PLAN for free tier user', () => {
    useAuthStore.setState({ user: mockFreeUser });

    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText('FREE PLAN')).toBeTruthy();
  });

  it('renders subscription row matching tier', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText('Subscription')).toBeTruthy();
    expect(getByText('Pro')).toBeTruthy();
  });

  it('renders user ID row (truncated)', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText('User ID')).toBeTruthy();
    expect(getByText('user-001')).toBeTruthy();
  });

  it('renders version info', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);
    expect(getByText('Version')).toBeTruthy();
    expect(getByText('0.1.0')).toBeTruthy();
  });

  it('shows alert confirmation on Sign Out press', () => {
    const { getByText } = renderWithProviders(<SettingsScreen />);

    fireEvent.press(getByText('Sign Out'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign Out',
      'Are you sure you want to sign out?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Sign Out', style: 'destructive' }),
      ]),
    );
  });

  it('calls logout when confirmed in alert', () => {
    const logoutFn = jest.fn();
    useAuthStore.setState({ logout: logoutFn } as any);

    const { getByText } = renderWithProviders(<SettingsScreen />);
    fireEvent.press(getByText('Sign Out'));

    // Simulate pressing "Sign Out" in the alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const destructiveButton = alertCall[2].find(
      (btn: any) => btn.style === 'destructive',
    );
    destructiveButton.onPress();

    expect(logoutFn).toHaveBeenCalled();
  });
});
