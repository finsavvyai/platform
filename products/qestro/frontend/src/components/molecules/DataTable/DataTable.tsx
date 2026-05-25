import React from 'react';
import { cn } from '../../../lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: unknown) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  sortBy,
  sortDirection,
  onSort,
  emptyMessage = 'No data available',
  className
}: DataTableProps<T>) {
  const handleSort = (columnKey: string, sortable?: boolean) => {
    if (sortable && onSort) {
      onSort(columnKey);
    }
  };

  const renderSortIcon = (columnKey: string, sortable?: boolean) => {
    if (!sortable) return null;

    if (sortBy === columnKey) {
      return sortDirection === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    }

    return <ChevronsUpDown className="h-4 w-4 text-gray-600" />;
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  return (
    <div className={cn('bg-black/20 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    'px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider',
                    alignClasses[column.align || 'left'],
                    column.sortable && 'cursor-pointer select-none hover:text-gray-300'
                  )}
                  onClick={() => handleSort(column.key, column.sortable)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.header}</span>
                    {renderSortIcon(column.key, column.sortable)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={index}
                  data-testid={`datatable-row-${index}`}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'border-b border-white/10 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-white/5',
                    index === data.length - 1 && 'border-b-0'
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-6 py-4 text-sm text-white',
                        alignClasses[column.align || 'left']
                      )}
                    >
                      {column.render ? column.render(item) : (item[column.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
