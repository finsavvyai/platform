import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Database, Table, Key, ChevronRight, ChevronDown, Columns, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Schema } from './schema-types';

export type { Column, TableSchema, Schema } from './schema-types';

interface SchemaTreeProps {
  schemas: Schema[];
  onTableClick?: (schema: string, table: string) => void;
  onColumnClick?: (schema: string, table: string, column: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
}

export function SchemaTree({
  schemas,
  onTableClick,
  onColumnClick,
  onRefresh,
  loading = false,
  className,
}: SchemaTreeProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }
      return next;
    });
  };

  const toggleTable = (tableKey: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex h-full flex-col overflow-hidden rounded-2xl bg-background/35', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-card/45 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
            <Database className="w-4 h-4 text-primary" />
          </span>
          <span className="text-sm font-black">Schema Explorer</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-3">
        {schemas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/45">
              <Database className="h-7 w-7 opacity-60" />
            </div>
            <p className="text-sm">No schemas available</p>
            <p className="text-xs mt-2">Connect to a database to view schemas</p>
          </div>
        ) : (
          <div className="space-y-1">
            {schemas.map((schema) => {
              const isExpanded = expandedSchemas.has(schema.name);

              return (
                <div key={schema.name}>
                  {/* Schema */}
                  <button
                    onClick={() => toggleSchema(schema.name)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md',
                      'hover:bg-primary/10 transition-colors text-left',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <Database className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{schema.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {schema.tables.length} tables
                    </span>
                  </button>

                  {/* Tables */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {schema.tables.map((table) => {
                        const tableKey = `${schema.name}.${table.name}`;
                        const isTableExpanded = expandedTables.has(tableKey);

                        return (
                          <div key={tableKey}>
                            {/* Table */}
                            <button
                              onClick={() => {
                                toggleTable(tableKey);
                                onTableClick?.(schema.name, table.name);
                              }}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 rounded-md',
                                'hover:bg-primary/10 transition-colors text-left',
                                'focus:outline-none focus:ring-2 focus:ring-primary/50'
                              )}
                            >
                              {isTableExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                              <Table className="w-4 h-4 text-blue-500" />
                              <span className="text-sm">{table.name}</span>
                              {table.rowCount !== undefined && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {table.rowCount.toLocaleString()} rows
                                </span>
                              )}
                            </button>

                            {/* Columns */}
                            {isTableExpanded && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {table.columns.map((column) => (
                                  <button
                                    key={column.name}
                                    onClick={() =>
                                      onColumnClick?.(schema.name, table.name, column.name)
                                    }
                                    className={cn(
                                      'w-full flex items-center gap-2 px-3 py-1.5 rounded-md',
                                      'hover:bg-primary/10 transition-colors text-left text-sm',
                                      'focus:outline-none focus:ring-2 focus:ring-primary/50'
                                    )}
                                  >
                                    {column.isPrimaryKey ? (
                                      <Key className="w-3 h-3 text-yellow-500" />
                                    ) : (
                                      <Columns className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    <span>{column.name}</span>
                                    <span className="ml-auto text-xs text-muted-foreground font-mono">
                                      {column.type}
                                    </span>
                                    {!column.nullable && (
                                      <span className="text-xs text-destructive">NOT NULL</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
