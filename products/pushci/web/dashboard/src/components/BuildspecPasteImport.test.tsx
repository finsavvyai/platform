// Tests for BuildspecPasteImport. Uses an injected migrate fn so we never
// hit the real /api/migrate/buildspec endpoint from unit tests.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuildspecPasteImport from './BuildspecPasteImport';
import type { BuildspecMigrateResponse } from '../hooks/useBuildspecMigrate';

const sample: BuildspecMigrateResponse = {
  pushciYaml: "version: '1'\nstages:\n  - name: build\n    run: npm ci && npm test\n",
  warnings: ['artifacts.files glob flattened to a single tarball'],
  envVarsNeeded: [
    { name: 'AWS_ACCESS_KEY_ID', suggestion: 'used by original buildspec env.variables' },
  ],
};

describe('BuildspecPasteImport', () => {
  it('renders the empty state initially', () => {
    render(<BuildspecPasteImport migrateFn={vi.fn()} />);
    expect(screen.getByTestId('buildspec-empty')).toBeInTheDocument();
    expect(screen.getByTestId('buildspec-convert-btn')).toBeDisabled();
  });

  it('enables Convert once the textarea has content', async () => {
    render(<BuildspecPasteImport migrateFn={vi.fn().mockResolvedValue(sample)} />);
    await userEvent.type(screen.getByTestId('buildspec-input'), 'version: 0.2');
    expect(screen.getByTestId('buildspec-convert-btn')).not.toBeDisabled();
  });

  it('calls migrateFn and renders yaml + warnings + env vars', async () => {
    const migrateFn = vi.fn().mockResolvedValue(sample);
    render(<BuildspecPasteImport migrateFn={migrateFn} />);
    await userEvent.type(screen.getByTestId('buildspec-input'), 'version: 0.2');
    await userEvent.click(screen.getByTestId('buildspec-convert-btn'));

    await waitFor(() => expect(migrateFn).toHaveBeenCalledWith('version: 0.2'));
    expect(screen.getByTestId('buildspec-yaml')).toHaveTextContent('npm ci && npm test');
    expect(screen.getByTestId('buildspec-warnings')).toHaveTextContent(/artifacts.files/i);
    expect(screen.getByTestId('buildspec-envvars')).toHaveTextContent('AWS_ACCESS_KEY_ID');
    expect(screen.getByTestId('buildspec-envvars')).toHaveTextContent('pushci secret set');
  });

  it('renders an error with retry when migrateFn rejects', async () => {
    const migrateFn = vi.fn().mockRejectedValue(new Error('backend not reachable'));
    render(<BuildspecPasteImport migrateFn={migrateFn} />);
    await userEvent.type(screen.getByTestId('buildspec-input'), 'version: 0.2');
    await userEvent.click(screen.getByTestId('buildspec-convert-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('buildspec-error')).toHaveTextContent(/backend not reachable/i),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows a clean-conversion message when warnings and env vars are empty', async () => {
    const migrateFn = vi.fn().mockResolvedValue({
      pushciYaml: 'version: "1"',
      warnings: [],
      envVarsNeeded: [],
    } satisfies BuildspecMigrateResponse);
    render(<BuildspecPasteImport migrateFn={migrateFn} />);
    await userEvent.type(screen.getByTestId('buildspec-input'), 'v');
    await userEvent.click(screen.getByTestId('buildspec-convert-btn'));
    await waitFor(() =>
      expect(screen.getByText(/clean conversion/i)).toBeInTheDocument(),
    );
  });

  it('Clear resets the output and textarea', async () => {
    const migrateFn = vi.fn().mockResolvedValue(sample);
    render(<BuildspecPasteImport migrateFn={migrateFn} />);
    const input = screen.getByTestId('buildspec-input') as HTMLTextAreaElement;
    await userEvent.type(input, 'version: 0.2');
    await userEvent.click(screen.getByTestId('buildspec-convert-btn'));
    await waitFor(() => expect(screen.getByTestId('buildspec-yaml')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(input.value).toBe('');
    expect(screen.getByTestId('buildspec-empty')).toBeInTheDocument();
  });
});
