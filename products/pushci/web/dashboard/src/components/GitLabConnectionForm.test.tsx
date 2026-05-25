import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitLabConnectionForm from './GitLabConnectionForm';

describe('GitLabConnectionForm', () => {
  it('disables submit until a token of at least 8 chars is entered', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<GitLabConnectionForm onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: /connect/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/personal access token/i), 'glpat-1234');
    expect(submit).not.toBeDisabled();
  });

  it('redacts the token preview', async () => {
    const user = userEvent.setup();
    render(<GitLabConnectionForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/personal access token/i), 'glpat-ABCDEFGHIJKL');
    expect(screen.getByTestId('token-preview').textContent).toBe('glpa…IJKL');
  });

  it('calls onSubmit with trimmed fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<GitLabConnectionForm onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText(/base url/i));
    await user.type(screen.getByLabelText(/base url/i), 'https://gitlab.acme.eu ');
    await user.type(screen.getByLabelText(/personal access token/i), ' glpat-TOKEN1234 ');
    await user.click(screen.getByRole('button', { name: /connect/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      baseUrl: 'https://gitlab.acme.eu',
      label: undefined,
      privateToken: 'glpat-TOKEN1234',
    });
  });

  it('shows an error alert when provided', () => {
    render(<GitLabConnectionForm onSubmit={vi.fn()} error="token rejected" />);
    expect(screen.getByRole('alert')).toHaveTextContent('token rejected');
  });
});
