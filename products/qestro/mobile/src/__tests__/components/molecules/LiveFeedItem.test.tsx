import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LiveFeedItem } from '@/components/molecules/LiveFeedItem';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', bgTertiary: '#1a1b23',
      textPrimary: '#f5f5f7', textSecondary: '#8e8e93', textMuted: '#636366',
      accentPrimary: '#3b82f6', accentSuccess: '#34c759', accentError: '#ff3b30',
      accentWarning: '#ff9500', borderColor: '#2c2c2e',
    },
    isDark: true,
  }),
}));

describe('LiveFeedItem', () => {
  it('should render title', () => {
    render(<LiveFeedItem title="Login Flow" status="passed" timestamp={new Date().toISOString()} />);
    expect(screen.getByText('Login Flow')).toBeTruthy();
  });

  it('should render environment when provided', () => {
    render(<LiveFeedItem title="API Test" status="running" timestamp={new Date().toISOString()} environment="staging" />);
    expect(screen.getByText('staging')).toBeTruthy();
  });

  it('should display timestamp as relative time', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    render(<LiveFeedItem title="Test" status="failed" timestamp={fiveMinAgo} />);
    expect(screen.getByText('5m ago')).toBeTruthy();
  });

  it('should display "just now" for very recent timestamps', () => {
    render(<LiveFeedItem title="Test" status="pending" timestamp={new Date().toISOString()} />);
    expect(screen.getByText('just now')).toBeTruthy();
  });
});
