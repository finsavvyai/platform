/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ApiKeyManager } from './ApiKeyManager';
import type { ApiKey } from './types';

vi.mock('lucide-react', () => ({
  Copy: ({ className }: { className?: string }) => (
    <span data-testid="copy-icon" className={className} />
  ),
  Check: ({ className }: { className?: string }) => (
    <span data-testid="check-icon" className={className} />
  ),
  Plus: ({ className }: { className?: string }) => (
    <span data-testid="plus-icon" className={className} />
  ),
  Trash2: ({ className }: { className?: string }) => (
    <span data-testid="trash-icon" className={className} />
  ),
  Eye: ({ className }: { className?: string }) => (
    <span data-testid="eye-icon" className={className} />
  ),
  EyeOff: ({ className }: { className?: string }) => (
    <span data-testid="eyeoff-icon" className={className} />
  ),
  Globe: ({ className }: { className?: string }) => (
    <span data-testid="globe-icon" className={className} />
  ),
  Pencil: ({ className }: { className?: string }) => (
    <span data-testid="pencil-icon" className={className} />
  ),
}));

vi.mock('@/lib/use-api', () => ({
  useApiKey: () => 'test-token',
}));

vi.mock('@/lib/tokenforge-api', () => ({
  generateApiKey: vi.fn(() =>
    Promise.resolve({
      key: 'tf_12345678123412341234123456789abc',
      entry: {
        id: 'key_new',
        name: 'Test Key',
        prefix: 'tf_1234...',
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      },
    }),
  ),
  revokeApiKey: vi.fn(() => Promise.resolve()),
}));

const mockKeys: ApiKey[] = [
  {
    id: 'key_01',
    name: 'Production',
    prefix: 'tf_abc1...',
    createdAt: '2026-01-15T10:00:00Z',
    lastUsedAt: '2026-02-27T14:55:00Z',
  },
  {
    id: 'key_02',
    name: 'Staging',
    prefix: 'tf_def2...',
    createdAt: '2026-02-01T08:30:00Z',
    lastUsedAt: null,
  },
];

beforeEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => '12345678-1234-1234-1234-123456789abc',
    },
    configurable: true,
  });
});

describe('ApiKeyManager', () => {
  it('renders all API keys', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    expect(screen.getByText('Production')).toBeDefined();
    expect(screen.getByText('Staging')).toBeDefined();
  });

  it('renders hidden key prefixes by default', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    // Keys are hidden by default — dots shown instead of prefix
    const dots = screen.getAllByText('••••••••••••');
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });

  it('shows last used info', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    expect(screen.getByText(/Last used/)).toBeDefined();
    expect(screen.getByText('Never used')).toBeDefined();
  });

  it('renders Generate New Key button', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    expect(screen.getByText('Generate New Key')).toBeDefined();
  });

  it('opens modal on Generate click', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    fireEvent.click(screen.getByText('Generate New Key'));
    expect(screen.getByText('Generate New API Key')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., Production')).toBeDefined();
  });

  it('generates a key with name input', async () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    fireEvent.click(screen.getByText('Generate New Key'));
    const input = screen.getByPlaceholderText('e.g., Production');
    fireEvent.change(input, { target: { value: 'Test Key' } });
    fireEvent.click(screen.getByText('Generate'));
    await waitFor(() => {
      expect(screen.getByText('API Key Generated')).toBeDefined();
    });
    expect(screen.getByText(/Copy this key now/)).toBeDefined();
  });

  it('closes modal on Done', async () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    fireEvent.click(screen.getByText('Generate New Key'));
    const input = screen.getByPlaceholderText('e.g., Production');
    fireEvent.change(input, { target: { value: 'Test Key' } });
    fireEvent.click(screen.getByText('Generate'));
    await waitFor(() => {
      expect(screen.getByText('Done')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('API Key Generated')).toBeNull();
  });

  it('shows empty state when no keys', () => {
    render(<ApiKeyManager initialKeys={[]} />);
    expect(screen.getByText('No API keys created yet.')).toBeDefined();
  });

  it('renders revoke buttons for each key', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    const trashIcons = screen.getAllByTestId('trash-icon');
    expect(trashIcons).toHaveLength(2);
  });

  it('disables generate when name is empty', () => {
    render(<ApiKeyManager initialKeys={mockKeys} />);
    fireEvent.click(screen.getByText('Generate New Key'));
    const generateBtn = screen.getByText('Generate');
    expect(generateBtn.closest('button')?.disabled).toBe(true);
  });
});
