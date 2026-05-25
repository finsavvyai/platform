// Tests for GitHubActionsConnectionForm — token entry + redacted preview.
// License: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubActionsConnectionForm, { redactToken } from './GitHubActionsConnectionForm';

describe('redactToken', () => {
  it('keeps the ghp_ prefix + last 4 and hides the middle', () => {
    expect(redactToken('ghp_ABCDEFGHIJKLMNOPQRSTUVwxyz')).toBe('ghp_…wxyz');
  });

  it('handles fine-grained ghu_ tokens', () => {
    expect(redactToken('ghu_12345678901234567890abcd')).toBe('ghu_…abcd');
  });

  it('returns empty for empty input', () => { expect(redactToken('')).toBe(''); });
});

describe('GitHubActionsConnectionForm', () => {
  it('disables submit until token is long enough', async () => {
    render(<GitHubActionsConnectionForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /connect github actions/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/personal access token/i), 'ghp_short');
    expect(screen.getByRole('button', { name: /connect github actions/i })).toBeDisabled();
  });

  it('submits token + label payload when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GitHubActionsConnectionForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/personal access token/i), 'ghp_ABCDEFGHIJKLMNOPQRSTUVwxyz');
    await userEvent.type(screen.getByLabelText(/label/i), 'Work');
    await userEvent.click(screen.getByRole('button', { name: /connect github actions/i }));
    expect(onSubmit).toHaveBeenCalledWith({ token: 'ghp_ABCDEFGHIJKLMNOPQRSTUVwxyz', label: 'Work' });
  });

  it('shows redacted preview as user types', async () => {
    render(<GitHubActionsConnectionForm onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/personal access token/i), 'ghp_MYSECRETtokenvalue1234');
    expect(screen.getByLabelText(/token preview/i)).toHaveTextContent('ghp_…1234');
  });

  it('renders the error via alert role', () => {
    render(<GitHubActionsConnectionForm onSubmit={vi.fn()} error="403 forbidden" />);
    expect(screen.getByRole('alert')).toHaveTextContent('403 forbidden');
  });
});
