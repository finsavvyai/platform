import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AutomationRules from './AutomationRules';
import { api } from '../../api/client';
import type { AutomationRule } from '../../components/automation/RuleBuilder';

vi.mock('../../api/client', () => ({
  api: { get: vi.fn(), del: vi.fn() },
}));

vi.mock('../../components/automation/RuleBuilder', () => ({
  RuleBuilder: ({ onSave, onCancel }: any) => (
    <div>
      <span>RuleBuilder</span>
      <button onClick={onSave}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
  AutomationRule: {},
}));

vi.mock('../../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

vi.mock('../../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: any) => <p>{title}</p>,
}));

const mockRules: AutomationRule[] = [
  {
    id: 'rule-1',
    name: 'Alert on high severity',
    trigger: 'alert.opened',
    condition: 'severity >= high',
    actions: [{ type: 'email', target: 'analyst@co.com' }],
    enabled: true,
  },
];

beforeEach(() => { vi.clearAllMocks() });

function renderPage() {
  return render(<MemoryRouter><AutomationRules /></MemoryRouter>);
}

describe('AutomationRules', () => {
  it('renders page title', async () => {
    vi.mocked(api.get).mockResolvedValue({ rules: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Automations')).toBeInTheDocument());
  });

  it('shows empty state when no rules', async () => {
    vi.mocked(api.get).mockResolvedValue({ rules: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No automations yet')).toBeInTheDocument());
  });

  it('renders rules list', async () => {
    vi.mocked(api.get).mockResolvedValue({ rules: mockRules });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alert on high severity')).toBeInTheDocument());
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('opens rule builder on new rule click', async () => {
    vi.mocked(api.get).mockResolvedValue({ rules: [] });
    renderPage();
    await waitFor(() => screen.getByText('No automations yet'));
    await userEvent.click(screen.getByRole('button', { name: /new rule/i }));
    expect(screen.getByText('RuleBuilder')).toBeInTheDocument();
  });

  it('closes rule builder on cancel', async () => {
    vi.mocked(api.get).mockResolvedValue({ rules: [] });
    renderPage();
    await waitFor(() => screen.getByText('No automations yet'));
    await userEvent.click(screen.getByRole('button', { name: /new rule/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('RuleBuilder')).not.toBeInTheDocument();
  });

  it('reloads after save', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ rules: [] })
      .mockResolvedValueOnce({ rules: mockRules });
    renderPage();
    await waitFor(() => screen.getByText('No automations yet'));
    await userEvent.click(screen.getByRole('button', { name: /new rule/i }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText('Alert on high severity')).toBeInTheDocument());
  });

  it('deletes rule and reloads', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ rules: mockRules })
      .mockResolvedValueOnce({ rules: [] });
    vi.mocked(api.del).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await waitFor(() => screen.getByText('Alert on high severity'));
    await userEvent.click(screen.getByRole('button', { name: /delete rule/i }));
    await waitFor(() => expect(screen.getByText('No automations yet')).toBeInTheDocument());
    expect(api.del).toHaveBeenCalledWith('/automation/rules/rule-1');
  });

  it('shows error when load fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network error'));
  });
});
