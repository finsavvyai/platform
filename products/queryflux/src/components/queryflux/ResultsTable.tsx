import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Download, Copy, Filter } from 'lucide-react';
import { Button } from '../ui/Button';

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

interface ResultsTableProps {
  result: QueryResult | null;
  loading?: boolean;
  error?: string | null;
  onExport?: () => void;
  className?: string;
}

export function ResultsTable({
  result,
  loading = false,
  error = null,
  onExport,
  className,
}: ResultsTableProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    if (!result || sortColumn === null) return result?.rows || [];

    const sorted = [...result.rows];
    sorted.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [result, sortColumn, sortDirection]);

  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  const handleCopyCell = (value: any) => {
    navigator.clipboard.writeText(String(value || ''));
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Executing query...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-6', className)}>
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <h4 className="font-semibold mb-2">Query Error</h4>
          <pre className="text-sm font-mono whitespace-pre-wrap">{error}</pre>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Execute a query to see results</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col overflow-hidden rounded-2xl bg-background/45', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-card/45 p-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{result.rowCount}</span> rows
          </span>
          <span className="text-muted-foreground">
            in <span className="font-semibold text-foreground">{result.executionTime}</span>ms
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 border-b border-border bg-card/95 backdrop-blur-xl">
            <tr>
              {result.columns.map((column, index) => (
                <th
                  key={index}
                  onClick={() => handleSort(index)}
                  className={cn(
                    'cursor-pointer px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-muted-foreground',
                    'hover:bg-primary/10 hover:text-foreground transition-colors',
                    'border-r border-border/70 last:border-r-0'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{column}</span>
                    {sortColumn === index && (
                      <span className="text-xs text-muted-foreground">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/60 transition-colors hover:bg-primary/10"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      'px-4 py-2.5 text-sm',
                      'border-r border-border/60 last:border-r-0',
                      'group relative'
                    )}
                    onDoubleClick={() => handleCopyCell(cell)}
                    title="Double-click to copy"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(cell === null && 'text-muted-foreground italic')}>
                        {cell === null ? 'NULL' : String(cell)}
                      </span>
                      <button
                        onClick={() => handleCopyCell(cell)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {sortedRows.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No rows returned</p>
          </div>
        )}
      </div>
    </div>
  );
}
