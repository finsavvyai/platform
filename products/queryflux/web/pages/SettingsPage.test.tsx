import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('renders Settings heading', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: /^Settings$/i })).toBeInTheDocument();
  });

  it('shows theme options Light, Dark, System', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('switches theme when a theme button is clicked', () => {
    render(<SettingsPage />);
    const lightButton = screen.getByText('Light').closest('button')!;
    fireEvent.click(lightButton);
    // After clicking Light, it should have the active border
    expect(lightButton.className).toContain('border-purple-600');
  });

  it('shows version info', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Version:')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('shows API URL', () => {
    render(<SettingsPage />);
    expect(screen.getByText('API URL:')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:8080')).toBeInTheDocument();
  });
});
