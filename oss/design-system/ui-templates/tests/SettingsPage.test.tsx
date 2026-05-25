import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPage } from '../src/pages/SettingsPage';

const mockUser = {
  name: 'John Doe',
  email: 'john@example.com',
};

describe('SettingsPage', () => {
  it('should render settings page', () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
  });

  it('should display all tabs', () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    expect(screen.getByTestId('tab-profile')).toBeInTheDocument();
    expect(screen.getByTestId('tab-security')).toBeInTheDocument();
    expect(screen.getByTestId('tab-notifications')).toBeInTheDocument();
  });

  it('should show profile tab content by default', () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    expect(screen.getByTestId('content-profile')).toBeInTheDocument();
  });

  it('should switch to security tab', async () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    await screen.getByTestId('tab-security').click();
    expect(screen.getByTestId('content-security')).toBeInTheDocument();
  });

  it('should switch to notifications tab', async () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    await screen.getByTestId('tab-notifications').click();
    expect(screen.getByTestId('content-notifications')).toBeInTheDocument();
  });

  it('should display user name in profile tab', () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('should display user email in profile tab', () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
  });

  it('should have password inputs in security tab', async () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    await screen.getByTestId('tab-security').click();
    expect(screen.getByTestId('input-current-pwd')).toBeInTheDocument();
    expect(screen.getByTestId('input-new-pwd')).toBeInTheDocument();
  });

  it('should have notification checkboxes in notifications tab', async () => {
    render(
      <SettingsPage user={mockUser} onUpdate={() => {}} />
    );
    await screen.getByTestId('tab-notifications').click();
    expect(screen.getByTestId('notify-email')).toBeInTheDocument();
    expect(screen.getByTestId('notify-sms')).toBeInTheDocument();
  });
});
