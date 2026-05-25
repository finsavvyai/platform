import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LiveConsole } from '@/components/molecules/LiveConsole';
import type { LogEntry } from '@/components/molecules/LiveConsole';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: { borderColor: '#2c2c2e', textMuted: '#636366' },
    isDark: true,
  }),
}));

describe('LiveConsole', () => {
  it('should show empty message when no logs', () => {
    render(<LiveConsole logs={[]} />);
    expect(screen.getByText('Waiting for logs...')).toBeTruthy();
  });

  it('should render log entries', () => {
    const logs: LogEntry[] = [
      { id: '1', level: 'info', message: 'Test started' },
      { id: '2', level: 'error', message: 'Assertion failed' },
    ];
    render(<LiveConsole logs={logs} />);
    expect(screen.getByText('Test started')).toBeTruthy();
    expect(screen.getByText('Assertion failed')).toBeTruthy();
  });

  it('should display level prefixes', () => {
    const logs: LogEntry[] = [
      { id: '1', level: 'info', message: 'hello' },
      { id: '2', level: 'success', message: 'passed' },
    ];
    render(<LiveConsole logs={logs} />);
    expect(screen.getByText('[INFO]')).toBeTruthy();
    expect(screen.getByText('[PASS]')).toBeTruthy();
  });
});
