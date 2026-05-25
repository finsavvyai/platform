import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RuleBuilder } from './RuleBuilder';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { post: vi.fn() },
}));

const onSave = vi.fn();
const onCancel = vi.fn();

beforeEach(() => { vi.clearAllMocks() });

function renderBuilder() {
  return render(<RuleBuilder onSave={onSave} onCancel={onCancel} />);
}

describe('RuleBuilder', () => {
  it('renders form with default fields', () => {
    renderBuilder();
    expect(screen.getByText('New automation rule')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/alert compliance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument();
  });

  it('calls onCancel on close button', async () => {
    renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows error when name is empty', async () => {
    renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  });

  it('shows error when action target is empty', async () => {
    renderBuilder();
    await userEvent.type(screen.getByPlaceholderText(/alert compliance/i), 'My rule');
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/target/i);
  });

  it('saves rule and calls onSave', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    renderBuilder();
    await userEvent.type(screen.getByPlaceholderText(/alert compliance/i), 'Test rule');
    const emailInput = screen.getByPlaceholderText(/analyst@example.com/i);
    await userEvent.type(emailInput, 'analyst@test.com');
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/automation/rules', expect.objectContaining({
      name: 'Test rule',
      enabled: true,
    }));
  });

  it('shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('API down'));
    renderBuilder();
    await userEvent.type(screen.getByPlaceholderText(/alert compliance/i), 'Test rule');
    await userEvent.type(screen.getByPlaceholderText(/analyst@example.com/i), 'analyst@test.com');
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('API down'));
  });

  it('adds actions and remove button appears with multiple', async () => {
    renderBuilder();
    // initially 1 action — no remove button shown
    expect(screen.queryAllByRole('button', { name: /remove action/i })).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /add action/i }));
    // now 2 actions — remove buttons appear
    expect(screen.getAllByRole('button', { name: /remove action/i })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: /remove action/i })[1]);
    // back to 1 action — remove button hidden again
    expect(screen.queryAllByRole('button', { name: /remove action/i })).toHaveLength(0);
  });
});
