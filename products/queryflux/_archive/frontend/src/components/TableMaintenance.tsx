import React, { useState } from 'react';
import { Database, RefreshCw, Trash2, Archive, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';

interface TableInfo {
  schema: string;
  name: string;
  size: string;
  rowCount: number;
  deadTuples: number;
  lastVacuum?: Date;
  lastAnalyze?: Date;
  lastAutoVacuum?: Date;
  lastAutoAnalyze?: Date;
  bloatRatio: number;
  indexesSize: string;
}

interface MaintenanceOperation {
  id: string;
  operation: 'VACUUM' | 'VACUUM FULL' | 'ANALYZE' | 'REINDEX' | 'CLUSTER';
  table: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  details?: string;
}

interface TableMaintenanceProps {
  tables: TableInfo[];
  operations: MaintenanceOperation[];
  onVacuum?: (schema: string, table: string, full?: boolean) => Promise<void>;
  onAnalyze?: (schema: string, table: string) => Promise<void>;
  onReindex?: (schema: string, table: string) => Promise<void>;
  onCluster?: (schema: string, table: string, indexName: string) => Promise<void>;
  onTruncate?: (schema: string, table: string) => Promise<void>;
}

export function TableMaintenance({
  tables,
  operations,
  onVacuum,
  onAnalyze,
  onReindex,
  onCluster,
  onTruncate,
}: TableMaintenanceProps) {
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTables = tables.filter(
    (table) =>
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.schema.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVacuum = async (table: TableInfo, full: boolean = false) => {
    if (!onVacuum) return;

    const confirmed = window.confirm(
      `Are you sure you want to ${full ? 'VACUUM FULL' : 'VACUUM'} table ${table.schema}.${table.name}?${
        full ? '\n\nWARNING: VACUUM FULL will lock the table and may take a long time!' : ''
      }`
    );

    if (confirmed) {
      try {
        await onVacuum(table.schema, table.name, full);
      } catch (error) {
        console.error('Failed to vacuum table:', error);
      }
    }
  };

  const handleAnalyze = async (table: TableInfo) => {
    if (!onAnalyze) return;

    try {
      await onAnalyze(table.schema, table.name);
    } catch (error) {
      console.error('Failed to analyze table:', error);
    }
  };

  const handleReindex = async (table: TableInfo) => {
    if (!onReindex) return;

    const confirmed = window.confirm(
      `Are you sure you want to REINDEX table ${table.schema}.${table.name}?\n\nThis will rebuild all indexes on the table.`
    );

    if (confirmed) {
      try {
        await onReindex(table.schema, table.name);
      } catch (error) {
        console.error('Failed to reindex table:', error);
      }
    }
  };

  const handleTruncate = async (table: TableInfo) => {
    if (!onTruncate) return;

    const confirmed = window.confirm(
      `⚠️ WARNING: Are you sure you want to TRUNCATE table ${table.schema}.${table.name}?\n\nThis will DELETE ALL DATA from the table and CANNOT BE UNDONE!\n\nType the table name to confirm.`
    );

    if (confirmed) {
      const typedName = prompt(`Type "${table.name}" to confirm truncation:`);
      if (typedName === table.name) {
        try {
          await onTruncate(table.schema, table.name);
        } catch (error) {
          console.error('Failed to truncate table:', error);
        }
      }
    }
  };

  const getBloatLevel = (bloatRatio: number) => {
    if (bloatRatio < 10) return { label: 'Healthy', color: 'text-green-600 dark:text-green-400' };
    if (bloatRatio < 30) return { label: 'Warning', color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: 'Critical', color: 'text-red-600 dark:text-red-400' };
  };

  const needsMaintenance = (table: TableInfo) => {
    return (
      table.bloatRatio > 20 ||
      table.deadTuples > table.rowCount * 0.1 ||
      (table.lastVacuum && (new Date().getTime() - table.lastVacuum.getTime()) / (1000 * 60 * 60 * 24) > 7)
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
            <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Table Maintenance</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Monitor and maintain database tables
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tables..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Recent Operations */}
        {operations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Recent Operations
            </h3>
            <div className="space-y-2">
              {operations.slice(0, 3).map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {op.status === 'running' && (
                      <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    )}
                    {op.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                    {op.status === 'failed' && (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {op.operation} on {op.table}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Started {op.startTime.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {op.endTime && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Duration: {((op.endTime.getTime() - op.startTime.getTime()) / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tables List */}
        <div className="space-y-4">
          {filteredTables.map((table) => {
            const bloat = getBloatLevel(table.bloatRatio);
            const needsAction = needsMaintenance(table);

            return (
              <div
                key={`${table.schema}.${table.name}`}
                className={`p-4 border rounded-lg transition-colors ${
                  needsAction
                    ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {table.schema}.{table.name}
                      </h4>
                      {needsAction && (
                        <span className="px-2 py-1 text-xs font-semibold bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200 rounded">
                          NEEDS MAINTENANCE
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Size</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {table.size}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Rows</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {table.rowCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Dead Tuples</p>
                        <p
                          className={`text-sm font-semibold ${
                            table.deadTuples > table.rowCount * 0.1
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {table.deadTuples.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Bloat</p>
                        <p className={`text-sm font-semibold ${bloat.color}`}>
                          {table.bloatRatio.toFixed(1)}% - {bloat.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                      {table.lastVacuum && (
                        <div>
                          <strong>Last Vacuum:</strong> {table.lastVacuum.toLocaleString()}
                        </div>
                      )}
                      {table.lastAnalyze && (
                        <div>
                          <strong>Last Analyze:</strong> {table.lastAnalyze.toLocaleString()}
                        </div>
                      )}
                      {table.indexesSize && (
                        <div>
                          <strong>Indexes Size:</strong> {table.indexesSize}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {onVacuum && (
                    <>
                      <button
                        onClick={() => handleVacuum(table, false)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        VACUUM
                      </button>
                      <button
                        onClick={() => handleVacuum(table, true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        VACUUM FULL
                      </button>
                    </>
                  )}
                  {onAnalyze && (
                    <button
                      onClick={() => handleAnalyze(table)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      <BarChart3 className="w-3 h-3" />
                      ANALYZE
                    </button>
                  )}
                  {onReindex && (
                    <button
                      onClick={() => handleReindex(table)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                    >
                      <Archive className="w-3 h-3" />
                      REINDEX
                    </button>
                  )}
                  {onTruncate && (
                    <button
                      onClick={() => handleTruncate(table)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      TRUNCATE
                    </button>
                  )}
                </div>

                {needsAction && (
                  <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-yellow-800 dark:text-yellow-200">
                      <p className="font-semibold mb-1">Maintenance Recommended:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {table.bloatRatio > 20 && <li>High bloat ratio detected</li>}
                        {table.deadTuples > table.rowCount * 0.1 && <li>Significant dead tuples</li>}
                        {table.lastVacuum &&
                          (new Date().getTime() - table.lastVacuum.getTime()) /
                            (1000 * 60 * 60 * 24) >
                            7 && <li>Not vacuumed in over 7 days</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredTables.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No tables found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
