/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntegrationGuides from './IntegrationGuides';

vi.mock('./getting-started-data', () => ({
  clients: [
    {
      id: 'cursor',
      name: 'Cursor',
      icon: ({ className }: any) => <span className={className}>icon</span>,
      color: 'text-blue-400',
      time: '2 min',
      steps: ['Step one', 'Step two'],
      note: 'Optional note',
    },
    {
      id: 'vscode',
      name: 'VS Code',
      icon: ({ className }: any) => <span className={className}>icon</span>,
      color: 'text-green-400',
      time: '3 min',
      steps: ['Install extension'],
      note: null,
    },
  ],
}));

describe('IntegrationGuides', () => {
  it('renders heading', () => {
    render(<IntegrationGuides />);
    expect(screen.getByText('Integration Guides')).toBeDefined();
  });

  it('renders client names', () => {
    render(<IntegrationGuides />);
    expect(screen.getByText('Cursor')).toBeDefined();
    expect(screen.getByText('VS Code')).toBeDefined();
  });

  it('expands a guide on click', () => {
    render(<IntegrationGuides />);
    fireEvent.click(screen.getByText('Cursor'));
    expect(screen.getByText('Step one')).toBeDefined();
    expect(screen.getByText('Step two')).toBeDefined();
    expect(screen.getByText('Optional note')).toBeDefined();
  });

  it('collapses when clicking the same guide', () => {
    render(<IntegrationGuides />);
    fireEvent.click(screen.getByText('Cursor'));
    expect(screen.getByText('Step one')).toBeDefined();
    fireEvent.click(screen.getByText('Cursor'));
    expect(screen.queryByText('Step one')).toBeNull();
  });

  it('shows setup time', () => {
    render(<IntegrationGuides />);
    expect(screen.getByText('~2 min setup')).toBeDefined();
    expect(screen.getByText('~3 min setup')).toBeDefined();
  });
});
