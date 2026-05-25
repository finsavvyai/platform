import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeDisplay() {
  const { theme, setTheme, cycle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('midnight')}>Set Midnight</button>
      <button onClick={cycle}>Cycle</button>
    </div>
  );
}

function renderWithProvider() {
  return render(<ThemeProvider><ThemeDisplay /></ThemeProvider>);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
});

describe('ThemeContext', () => {
  it('defaults to light theme', () => {
    renderWithProvider();
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('restores theme from localStorage', () => {
    localStorage.setItem('amliq-theme', 'dark');
    renderWithProvider();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('setTheme changes theme', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Set Dark' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('setTheme persists to localStorage', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Set Midnight' }));
    expect(localStorage.getItem('amliq-theme')).toBe('midnight');
  });

  it('cycle advances through themes', async () => {
    renderWithProvider();
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    await userEvent.click(screen.getByRole('button', { name: 'Cycle' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Cycle' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('midnight');
    await userEvent.click(screen.getByRole('button', { name: 'Cycle' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('marketing');
    await userEvent.click(screen.getByRole('button', { name: 'Cycle' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('applies data-theme attribute to document', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Set Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
