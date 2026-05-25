import { useState, useCallback, useMemo } from 'react';
import { QueryEditor } from '../components/queryflux/QueryEditor';
import { ResultsTable } from '../components/queryflux/ResultsTable';
import { SchemaTree } from '../components/queryflux/SchemaTree';
import { NlpQueryBar } from '../components/queryflux/NlpQueryBar';
import { useConnectionStore } from '../stores/connectionStore';
import { useExecuteQuery, useSaveQuery } from '../hooks/useQueries';
import { useSchema } from '../hooks/useSchema';
import { cn } from '@/lib/utils';
import type { NlpDialect } from '../types/api';
import { Database, PanelLeftClose, Sparkles, TriangleAlert } from 'lucide-react';

export function EnhancedQueryEditorPage() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);

  const defaultDialect = useMemo((): NlpDialect => {
    const conn = connections.find((c) => c.id === activeConnectionId);
    if (!conn) return 'postgresql';
    const t = conn.type;
    if (t === 'mysql' || t === 'mariadb') return 'mysql';
    if (t === 'mongodb') return 'mongodb';
    if (t === 'sqlite') return 'sqlite';
    return 'postgresql';
  }, [connections, activeConnectionId]);

  const { data: schemas = [], isLoading: schemaLoading, refetch: refreshSchema } = useSchema(activeConnectionId);
  const executeQuery = useExecuteQuery();
  const saveQuery = useSaveQuery();

  const result = executeQuery.data
    ? {
        columns: executeQuery.data.columns,
        rows: (executeQuery.data.rows ?? []).map((row) =>
          executeQuery.data!.columns.map((col) => (row as Record<string, unknown>)[col])
        ),
        rowCount: executeQuery.data.rowCount,
        executionTime: executeQuery.data.executionTime,
      }
    : null;

  const handleExecute = useCallback(
    async (sql: string) => {
      if (!activeConnectionId) return;
      executeQuery.mutate({ connectionId: activeConnectionId, sql });
    },
    [activeConnectionId, executeQuery]
  );

  const handleSave = useCallback(
    (sql: string) => {
      if (!activeConnectionId) return;
      saveQuery.mutate({ sql, connectionId: activeConnectionId, name: 'Untitled' });
    },
    [activeConnectionId, saveQuery]
  );

  const handleTableClick = (schema: string, table: string) => {
    setQuery(`SELECT * FROM ${schema}.${table} LIMIT 100;`);
  };

  const handleColumnClick = (schema: string, table: string, column: string) => {
    setQuery(`SELECT ${column} FROM ${schema}.${table} LIMIT 100;`);
  };

  const [showSchema, setShowSchema] = useState(true);
  const errorMessage = executeQuery.error?.message ?? null;

  const schemaContext = useMemo(() => {
    if (!schemas.length) return undefined;
    return JSON.stringify(schemas);
  }, [schemas]);

  return (
    <div className="flex h-full flex-col overflow-hidden p-3 md:p-4">
      <div className="mb-3 flex flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-card/45 px-4 py-3 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-warning">
            <Sparkles className="h-3.5 w-3.5" />
            AI-assisted SQL workbench
          </div>
          <h1 className="truncate text-2xl font-black tracking-tight">Query Editor</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:flex">
          <span className="premium-pill rounded-full px-3 py-2 font-semibold text-muted-foreground">
            Dialect: {defaultDialect}
          </span>
          <span className="premium-pill rounded-full px-3 py-2 font-semibold text-muted-foreground">
            Schema: {schemas.length || 0}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
      {showSchema && (
        <div className="hidden w-80 flex-shrink-0 md:block">
          <SchemaTree
            schemas={schemas}
            loading={schemaLoading}
            onTableClick={handleTableClick}
            onColumnClick={handleColumnClick}
            onRefresh={() => refreshSchema()}
          />
        </div>
      )}

      <div className="premium-panel flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
        {!activeConnectionId && (
          <div className="flex items-center gap-2 border-b border-warning/35 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">
            <TriangleAlert className="h-4 w-4" />
            No connection selected. Go to Connections to select one.
          </div>
        )}

        <NlpQueryBar schema={schemaContext} defaultDialect={defaultDialect} onSqlGenerated={setQuery} />

        <div className="min-h-0 flex-1 border-b border-border/70 p-3">
          <QueryEditor
            value={query}
            onChange={setQuery}
            onExecute={handleExecute}
            onSave={handleSave}
          />
        </div>

        <div className="min-h-0 flex-1 p-3">
          <ResultsTable
            result={result}
            loading={executeQuery.isPending}
            error={errorMessage}
          />
        </div>
      </div>

      <button
        onClick={() => setShowSchema(!showSchema)}
        className={cn(
          'fixed left-0 top-1/2 z-50 -translate-y-1/2 md:left-auto md:right-4',
          'rounded-r-2xl border border-border bg-card/90 px-2 py-4 backdrop-blur-xl md:rounded-2xl',
          'cursor-pointer text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground'
        )}
        title={showSchema ? 'Hide schema' : 'Show schema'}
      >
        <span className="sr-only">{showSchema ? 'Hide schema' : 'Show schema'}</span>
        {showSchema ? <PanelLeftClose className="h-4 w-4" /> : <Database className="h-4 w-4" />}
      </button>
      </div>
    </div>
  );
}
