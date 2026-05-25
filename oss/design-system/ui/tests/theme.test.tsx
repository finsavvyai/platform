import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, ThemeContext } from '../src/theme/ThemeProvider';

const TestComponent = () => {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('No theme');
  const { theme, toggleTheme, setTheme } = context;
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <button onClick={toggleTheme} data-testid="toggle">
        Toggle
      </button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light
      </button>
    </div>
  );
};

describe('ThemeProvider', () => {
  it('should provide default light theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('should provide custom default theme', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('should toggle theme on toggle call', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    await screen.getByTestId('toggle').click();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('should set theme to dark', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    await screen.getByTestId('set-dark').click();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('should set theme to light', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    );
    await screen.getByTestId('set-light').click();
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      render(<TestComponent />);
    }).toThrow();
  });
});
