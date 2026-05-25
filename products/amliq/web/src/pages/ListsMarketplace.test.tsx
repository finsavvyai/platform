import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ListsMarketplace } from './ListsMarketplace';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));
vi.mock('../components/ui/SearchField', () => ({
  SearchField: ({ value, onChange, placeholder }: any) => (
    <input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
vi.mock('../components/lists/ListMarketplaceCard', () => ({
  ListMarketplaceCard: ({ list, onToggle }: any) => (
    <div>
      <span>Card: {list.name}</span>
      <button onClick={onToggle}>Toggle {list.name}</button>
    </div>
  ),
}));
vi.mock('../components/lists/FilterBar', () => ({
  FilterBar: ({ items, active, onSelect, label }: any) => (
    <div>
      {items.map((i: string) => (
        <button key={i} onClick={() => onSelect(i)} aria-pressed={active === i}>{label}: {i}</button>
      ))}
    </div>
  ),
}));

const mockList = {
  id: 'l1', name: 'OFAC SDN', description: 'US sanctions', region: 'Americas',
  category: 'sanctions', source_url: '', entity_count: 15000,
  update_frequency: 'daily', last_synced: '2026-01-01', enabled: true, tier: 'free',
};

beforeEach(() => { vi.clearAllMocks() });

describe('ListsMarketplace', () => {
  it('shows loading spinner', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    render(<ListsMarketplace />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders list cards after load', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [mockList] });
    render(<ListsMarketplace />);
    await waitFor(() => expect(screen.getByText('Card: OFAC SDN')).toBeInTheDocument());
  });

  it('shows entity count in hero', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [mockList] });
    render(<ListsMarketplace />);
    await waitFor(() => expect(screen.getByText(/15,000/)).toBeInTheDocument());
  });

  it('filters by search term', async () => {
    const list2 = { ...mockList, id: 'l2', name: 'EU Consolidated', description: 'EU list' };
    vi.mocked(api.get).mockResolvedValue({ lists: [mockList, list2] });
    render(<ListsMarketplace />);
    await waitFor(() => screen.getByText('Card: OFAC SDN'));
    await userEvent.type(screen.getByPlaceholderText(/search lists/i), 'EU');
    expect(screen.getByText('Card: EU Consolidated')).toBeInTheDocument();
    expect(screen.queryByText('Card: OFAC SDN')).not.toBeInTheDocument();
  });

  it('shows available list count', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [mockList] });
    render(<ListsMarketplace />);
    await waitFor(() => expect(screen.getByText(/1 lists available/i)).toBeInTheDocument());
  });

  it('toggle calls api.post and updates enabled state', async () => {
    vi.mocked(api.get).mockResolvedValue({ lists: [mockList] });
    vi.mocked(api.post).mockResolvedValue({});
    render(<ListsMarketplace />);
    await waitFor(() => screen.getByText('Toggle OFAC SDN'));
    await userEvent.click(screen.getByRole('button', { name: /toggle ofac sdn/i }));
    expect(api.post).toHaveBeenCalledWith('/lists/marketplace/l1/disable', {});
  });

  it('filters by region via FilterBar', async () => {
    const euList = { ...mockList, id: 'l2', name: 'EU List', region: 'Europe' };
    vi.mocked(api.get).mockResolvedValue({ lists: [mockList, euList] });
    render(<ListsMarketplace />);
    await waitFor(() => screen.getByText('Card: OFAC SDN'));
    await userEvent.click(screen.getByRole('button', { name: /region: europe/i }));
    expect(screen.getByText('Card: EU List')).toBeInTheDocument();
    expect(screen.queryByText('Card: OFAC SDN')).not.toBeInTheDocument();
  });
});
