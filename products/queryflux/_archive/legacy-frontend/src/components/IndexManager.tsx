import React, { useState } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Zap, AlertCircle, Check, X } from 'lucide-react';

interface Index {
  id: string;
  name: string;
  tableName: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  unique: boolean;
  partial?: string;
  size?: string;
  lastUsed?: Date;
}

interface IndexManagerProps {
  indexes: Index[];
  tables: string[];
  onCreateIndex?: (index: Omit<Index, 'id' | 'size' | 'lastUsed'>) => Promise<void>;
  onDropIndex?: (indexId: string) => Promise<void>;
  onReindex?: (indexId: string) => Promise<void>;
}

export function IndexManager({
  indexes,
  tables,
  onCreateIndex,
  onDropIndex,
  onReindex,
}: IndexManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newIndex, setNewIndex] = useState<Omit<Index, 'id' | 'size' | 'lastUsed'>>({
    name: '',
    tableName: '',
    columns: [],
    type: 'btree',
    unique: false,
  });
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const handleCreateIndex = async () => {
    if (!onCreateIndex) return;

    if (!newIndex.name || !newIndex.tableName || newIndex.columns.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    try {
      await onCreateIndex(newIndex);
      setIsCreating(false);
      setNewIndex({
        name: '',
        tableName: '',
        columns: [],
        type: 'btree',
        unique: false,
      });
      setSelectedColumns([]);
    } catch (error) {
      console.error('Failed to create index:', error);
    }
  };

  const handleDropIndex = async (indexId: string, indexName: string) => {
    if (!onDropIndex) return;

    const confirmed = window.confirm(
      `Are you sure you want to drop index "${indexName}"? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        await onDropIndex(indexId);
      } catch (error) {
        console.error('Failed to drop index:', error);
      }
    }
  };

  const handleReindex = async (indexId: string) => {
    if (!onReindex) return;

    try {
      await onReindex(indexId);
    } catch (error) {
      console.error('Failed to reindex:', error);
    }
  };

  const getIndexTypeColor = (type: Index['type']) => {
    switch (type) {
      case 'btree':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'hash':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'gin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'gist':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'brin':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Index Manager</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage and optimize database indexes
            </p>
          </div>
        </div>
        {onCreateIndex && (
          <button
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Index
          </button>
        )}
      </div>

      {/* Create Index Form */}
      {isCreating && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Create New Index
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Index Name *
              </label>
              <input
                type="text"
                value={newIndex.name}
                onChange={(e) => setNewIndex({ ...newIndex, name: e.target.value })}
                placeholder="idx_table_column"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Table *
              </label>
              <select
                value={newIndex.tableName}
                onChange={(e) => {
                  setNewIndex({ ...newIndex, tableName: e.target.value, columns: [] });
                  setSelectedTable(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a table</option>
                {tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Index Type *
              </label>
              <select
                value={newIndex.type}
                onChange={(e) =>
                  setNewIndex({ ...newIndex, type: e.target.value as Index['type'] })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="btree">B-Tree (default)</option>
                <option value="hash">Hash</option>
                <option value="gin">GIN (inverted index)</option>
                <option value="gist">GiST (generalized search tree)</option>
                <option value="brin">BRIN (block range index)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Columns * (comma-separated)
              </label>
              <input
                type="text"
                value={newIndex.columns.join(', ')}
                onChange={(e) =>
                  setNewIndex({
                    ...newIndex,
                    columns: e.target.value.split(',').map((c) => c.trim()).filter(Boolean),
                  })
                }
                placeholder="column1, column2"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={newIndex.unique}
                  onChange={(e) => setNewIndex({ ...newIndex, unique: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Unique Index
              </label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Partial Index WHERE Clause (optional)
              </label>
              <input
                type="text"
                value={newIndex.partial || ''}
                onChange={(e) => setNewIndex({ ...newIndex, partial: e.target.value })}
                placeholder="column > 100"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleCreateIndex}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Create Index
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewIndex({
                  name: '',
                  tableName: '',
                  columns: [],
                  type: 'btree',
                  unique: false,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">Index Type Guidelines:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>B-Tree:</strong> Best for equality and range queries (default)</li>
                  <li><strong>Hash:</strong> Only for equality comparisons (=)</li>
                  <li><strong>GIN:</strong> For full-text search, arrays, JSONB</li>
                  <li><strong>GiST:</strong> For geometric data and full-text search</li>
                  <li><strong>BRIN:</strong> For very large tables with naturally ordered data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Index List */}
      <div className="flex-1 overflow-auto p-6">
        {indexes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Zap className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No indexes found</p>
            <p className="text-sm mt-1">Create an index to improve query performance</p>
          </div>
        ) : (
          <div className="space-y-4">
            {indexes.map((index) => (
              <div
                key={index.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {index.name}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getIndexTypeColor(
                          index.type
                        )}`}
                      >
                        {index.type.toUpperCase()}
                      </span>
                      {index.unique && (
                        <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 rounded">
                          UNIQUE
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        <strong>Table:</strong> {index.tableName}
                      </p>
                      <p>
                        <strong>Columns:</strong> {index.columns.join(', ')}
                      </p>
                      {index.partial && (
                        <p>
                          <strong>Partial:</strong> WHERE {index.partial}
                        </p>
                      )}
                      {index.size && (
                        <p>
                          <strong>Size:</strong> {index.size}
                        </p>
                      )}
                      {index.lastUsed && (
                        <p>
                          <strong>Last Used:</strong>{' '}
                          {new Date(index.lastUsed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onReindex && (
                      <button
                        onClick={() => handleReindex(index.id)}
                        className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Reindex"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    )}
                    {onDropIndex && (
                      <button
                        onClick={() => handleDropIndex(index.id, index.name)}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Drop Index"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
