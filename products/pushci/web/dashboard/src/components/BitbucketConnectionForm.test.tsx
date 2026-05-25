// Tests for the BitbucketConnectionForm component.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BitbucketConnectionForm from './BitbucketConnectionForm';

describe('BitbucketConnectionForm', () => {
  it('submits app-password payload by default', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BitbucketConnectionForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/username/i), 'jane');
    await userEvent.type(screen.getByLabelText(/app password/i), 'ATBB-secret');
    await userEvent.type(screen.getByLabelText(/label/i), 'Work');
    await userEvent.click(screen.getByRole('button', { name: /connect bitbucket/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      user: 'jane', appPassword: 'ATBB-secret', label: 'Work', defaultWorkspace: undefined,
    });
  });

  it('toggles to bearer mode and submits bearer payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BitbucketConnectionForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('tab', { name: /oauth bearer/i }));
    await userEvent.type(screen.getByLabelText(/oauth bearer token/i), 'tok-xyz');
    await userEvent.click(screen.getByRole('button', { name: /connect bitbucket/i }));
    expect(onSubmit).toHaveBeenCalledWith({ bearer: 'tok-xyz', label: undefined, defaultWorkspace: undefined });
  });

  it('disables submit when required fields missing', () => {
    render(<BitbucketConnectionForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /connect bitbucket/i })).toBeDisabled();
  });

  it('renders error message via alert role', () => {
    render(<BitbucketConnectionForm onSubmit={vi.fn()} error="invalid creds" />);
    expect(screen.getByRole('alert')).toHaveTextContent('invalid creds');
  });
});
