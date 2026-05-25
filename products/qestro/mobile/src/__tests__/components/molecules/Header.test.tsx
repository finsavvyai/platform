import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Header } from '@/components/molecules/Header';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', textPrimary: '#f5f5f7', textSecondary: '#8e8e93',
      accentPrimary: '#3b82f6',
    },
    isDark: true,
  }),
}));

describe('Header', () => {
  beforeEach(() => { mockBack.mockClear(); });

  it('should render title', () => {
    render(<Header title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('should render back button when showBack is true', () => {
    render(<Header title="Test Plans" showBack />);
    const backBtn = screen.getByLabelText('Go back');
    expect(backBtn).toBeTruthy();
  });

  it('should navigate back when back button pressed', () => {
    render(<Header title="Details" showBack />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('should render project name when activeProject provided', () => {
    const project = { id: '1', name: 'My Project', type: 'web' as const, status: 'active' as const, createdAt: '', updatedAt: '' };
    render(<Header title="Dashboard" activeProject={project} onProjectPress={jest.fn()} />);
    expect(screen.getByText('My Project')).toBeTruthy();
  });

  it('should render notification bell when handler provided', () => {
    render(<Header title="Dashboard" onNotificationsPress={jest.fn()} />);
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });
});
