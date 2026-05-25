import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardLayout } from '../src/layouts/DashboardLayout';

const mockNav = [
  { label: 'Dashboard', href: '/' },
  { label: 'Settings', href: '/settings' },
];

const mockUser = {
  name: 'John Doe',
  email: 'john@example.com',
};

describe('DashboardLayout', () => {
  it('should render layout with sidebar and content', () => {
    render(
      <DashboardLayout navigation={mockNav} user={mockUser}>
        <div>Test Content</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should display navigation items', () => {
    render(
      <DashboardLayout navigation={mockNav} user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('nav-Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-Settings')).toBeInTheDocument();
  });

  it('should display user name', () => {
    render(
      <DashboardLayout navigation={mockNav} user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <DashboardLayout navigation={mockNav} user={mockUser}>
        <div data-testid="custom-content">Custom Content</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  it('should have sidebar toggle button', () => {
    render(
      <DashboardLayout navigation={mockNav} user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
  });

  it('should render all navigation items from props', () => {
    const nav = [
      { label: 'Home', href: '/' },
      { label: 'Profile', href: '/profile' },
      { label: 'Support', href: '/support' },
    ];
    render(
      <DashboardLayout navigation={nav} user={mockUser}>
        <div>Content</div>
      </DashboardLayout>
    );
    expect(screen.getByTestId('nav-Home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-Profile')).toBeInTheDocument();
    expect(screen.getByTestId('nav-Support')).toBeInTheDocument();
  });
});
