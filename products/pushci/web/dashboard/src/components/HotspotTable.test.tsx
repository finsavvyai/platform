import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HotspotTable, { type HotspotRow } from './HotspotTable';

const fixtures: HotspotRow[] = [
  { path: 'api/src/alpha.ts', bus_factor: 1, total: 30, top_author_hash: 'hashA', last_touched: '2026-04-01' },
  { path: 'api/src/beta.ts', bus_factor: 2, total: 5, top_author_hash: 'hashB', last_touched: '2026-03-10' },
  { path: 'internal/lonely.go', bus_factor: 1, total: 12, top_author_hash: 'hashC', last_touched: '2026-02-15' },
];

describe('HotspotTable', () => {
  it('renders an empty-state message when rows is empty', () => {
    render(<HotspotTable rows={[]} />);
    expect(screen.getByText(/No risky hotspots detected/i)).toBeInTheDocument();
  });

  it('renders a row per hotspot with file path + touches', () => {
    render(<HotspotTable rows={fixtures} />);
    expect(screen.getByText('api/src/alpha.ts')).toBeInTheDocument();
    expect(screen.getByText('internal/lonely.go')).toBeInTheDocument();
    expect(screen.getByText('30x')).toBeInTheDocument();
  });

  it('shows a loading skeleton when loading', () => {
    render(<HotspotTable rows={[]} loading />);
    expect(screen.getByText(/Loading hotspots/i)).toBeInTheDocument();
  });

  it('sorts by total DESC by default (alpha before lonely)', () => {
    render(<HotspotTable rows={fixtures} />);
    const rows = screen.getAllByRole('row');
    // row[0] is the header
    expect(rows[1]).toHaveTextContent('api/src/alpha.ts');
    expect(rows[2]).toHaveTextContent('internal/lonely.go');
  });

  it('toggles sort direction when the same column is clicked twice', async () => {
    render(<HotspotTable rows={fixtures} />);
    const touchHeader = screen.getByText('Touches');
    await userEvent.click(touchHeader); // ASC
    const rowsAsc = screen.getAllByRole('row');
    expect(rowsAsc[1]).toHaveTextContent('api/src/beta.ts');
  });
});
