import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaTree } from './SchemaTree';
import type { Schema } from './schema-types';

const mockSchemas: Schema[] = [
  {
    name: 'public',
    tables: [
      {
        name: 'users',
        rowCount: 1234,
        columns: [
          { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
          { name: 'email', type: 'varchar(255)', nullable: false },
          { name: 'name', type: 'varchar(100)', nullable: true },
        ],
      },
      {
        name: 'orders',
        rowCount: 567,
        columns: [
          { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
          { name: 'user_id', type: 'integer', nullable: false },
        ],
      },
    ],
  },
];

describe('SchemaTree', () => {
  it('renders Schema Explorer header', () => {
    render(<SchemaTree schemas={mockSchemas} />);
    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
  });

  it('shows empty state when no schemas', () => {
    render(<SchemaTree schemas={[]} />);
    expect(screen.getByText('No schemas available')).toBeInTheDocument();
    expect(
      screen.getByText('Connect to a database to view schemas')
    ).toBeInTheDocument();
  });

  it('renders schema names when provided', () => {
    render(<SchemaTree schemas={mockSchemas} />);
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('2 tables')).toBeInTheDocument();
  });

  it('expanding a schema shows tables', async () => {
    const user = userEvent.setup();
    render(<SchemaTree schemas={mockSchemas} />);

    // Tables should not be visible yet
    expect(screen.queryByText('users')).not.toBeInTheDocument();

    // Click schema to expand
    await user.click(screen.getByText('public'));

    // Now tables should be visible
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('expanding a table shows columns', async () => {
    const user = userEvent.setup();
    render(<SchemaTree schemas={mockSchemas} />);

    // Expand schema first
    await user.click(screen.getByText('public'));

    // Columns should not be visible yet
    expect(screen.queryByText('email')).not.toBeInTheDocument();

    // Click table to expand
    await user.click(screen.getByText('users'));

    // Columns should now be visible
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('calls onTableClick when table is clicked', async () => {
    const user = userEvent.setup();
    const handleTableClick = vi.fn();
    render(<SchemaTree schemas={mockSchemas} onTableClick={handleTableClick} />);

    // Expand schema
    await user.click(screen.getByText('public'));

    // Click table
    await user.click(screen.getByText('users'));

    expect(handleTableClick).toHaveBeenCalledWith('public', 'users');
  });

  it('calls onColumnClick when column is clicked', async () => {
    const user = userEvent.setup();
    const handleColumnClick = vi.fn();
    render(
      <SchemaTree schemas={mockSchemas} onColumnClick={handleColumnClick} />
    );

    // Expand schema
    await user.click(screen.getByText('public'));

    // Expand table
    await user.click(screen.getByText('users'));

    // Click column
    await user.click(screen.getByText('email'));

    expect(handleColumnClick).toHaveBeenCalledWith('public', 'users', 'email');
  });

  it('shows primary key indicator for PK columns', async () => {
    const user = userEvent.setup();
    render(<SchemaTree schemas={mockSchemas} />);

    // Expand schema and table
    await user.click(screen.getByText('public'));
    await user.click(screen.getByText('users'));

    // The PK column 'id' should have type shown
    expect(screen.getByText('integer')).toBeInTheDocument();

    // Check for NOT NULL indicator on PK column
    // id is isPrimaryKey=true, nullable=false => should show Key icon
    // We verify by checking the column row contains the key icon class
    const idButton = screen.getByText('id').closest('button');
    expect(idButton).toBeTruthy();
    // The Key icon (SVG) should be present as a child of the id button
    const svgElements = idButton!.querySelectorAll('svg');
    // Key icon has the class text-yellow-500
    const keyIcon = Array.from(svgElements).find((svg) =>
      svg.classList.contains('text-yellow-500')
    );
    expect(keyIcon).toBeTruthy();
  });
});
