import React, { useState, useRef, useEffect } from 'react';
import { CreditCard as Edit2, Save, X, Trash2, Plus, RefreshCw, Download } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

interface Row {
  [key: string]: any;
}

interface DataGridProps {
  columns: Column[];
  data: Row[];
  onUpdate?: (rowIndex: number, columnName: string, newValue: any) => Promise<void>;
  onDelete?: (rowIndex: number) => Promise<void>;
  onInsert?: (newRow: Row) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onExport?: () => void;
  isLoading?: boolean;
  tableName?: string;
}

export function DataGrid({
  columns,
  data,
  onUpdate,
  onDelete,
  onInsert,
  onRefresh,
  onExport,
  isLoading = false,
  tableName
}: DataGridProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<Row>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellDoubleClick = (rowIndex: number, columnName: string, currentValue: any) => {
    setEditingCell({ row: rowIndex, col: columnName });
    setEditValue(currentValue ?? '');
  };

  const handleSaveCell = async () => {
    if (!editingCell || !onUpdate) return;

    try {
      await onUpdate(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update cell:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveCell();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteRow = async (rowIndex: number) => {
    if (!onDelete) return;

    const confirmed = window.confirm('Are you sure you want to delete this row?');
    if (confirmed) {
      try {
        await onDelete(rowIndex);
      } catch (error) {
        console.error('Failed to delete row:', error);
      }
    }
  };

  const handleAddRow = () => {
    setIsAddingRow(true);
    const initialRow: Row = {};
    columns.forEach(col => {
      initialRow[col.name] = '';
    });
    setNewRow(initialRow);
  };

  const handleSaveNewRow = async () => {
    if (!onInsert) return;

    try {
      await onInsert(newRow);
      setIsAddingRow(false);
      setNewRow({});
    } catch (error) {
      console.error('Failed to insert row:', error);
    }
  };

  const handleCancelNewRow = () => {
    setIsAddingRow(false);
    setNewRow({});
  };

  const toggleRowSelection = (rowIndex: number) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex);
    } else {
      newSelection.add(rowIndex);
    }
    setSelectedRows(newSelection);
  };

  const selectAllRows = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map((_, i) => i)));
    }
  };

  const renderCellValue = (value: any, column: Column) => {
    if (value === null) return <span className="text-gray-400 italic">NULL</span>;
    if (value === '') return <span className="text-gray-300">empty</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getInputType = (column: Column) => {
    if (column.type.includes('int') || column.type.includes('numeric') || column.type.includes('decimal')) {
      return 'number';
    }
    if (column.type.includes('date') && !column.type.includes('datetime')) {
      return 'date';
    }
    if (column.type.includes('time')) {
      return 'datetime-local';
    }
    if (column.type.includes('bool')) {
      return 'checkbox';
    }
    return 'text';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tableName || 'Query Results'}
          </h3>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
            {data.length} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onInsert && (
            <button
              onClick={handleAddRow}
              disabled={isAddingRow}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
            <tr>
              <th className="w-12 px-4 py-3 text-left border-b border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={selectAllRows}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </th>
              {columns.map((column) => (
                <th
                  key={column.name}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2">
                    {column.name}
                    {column.isPrimaryKey && (
                      <span className="px-1.5 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                        PK
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-normal text-gray-500 dark:text-gray-400 normal-case mt-0.5">
                    {column.type}
                  </div>
                </th>
              ))}
              {(onUpdate || onDelete) && (
                <th className="w-24 px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {/* New Row Form */}
            {isAddingRow && (
              <tr className="bg-green-50 dark:bg-green-900/20">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveNewRow}
                      className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                      title="Save new row"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelNewRow}
                      className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                {columns.map((column) => (
                  <td key={column.name} className="px-4 py-2">
                    <input
                      type={getInputType(column)}
                      value={newRow[column.name] || ''}
                      onChange={(e) => setNewRow({ ...newRow, [column.name]: e.target.value })}
                      placeholder={column.nullable ? 'NULL' : 'Required'}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </td>
                ))}
                <td></td>
              </tr>
            )}

            {/* Data Rows */}
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  selectedRows.has(rowIndex) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <td className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowIndex)}
                    onChange={() => toggleRowSelection(rowIndex)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </td>
                {columns.map((column) => {
                  const isEditing =
                    editingCell?.row === rowIndex && editingCell?.col === column.name;
                  const cellValue = row[column.name];

                  return (
                    <td
                      key={column.name}
                      className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 cursor-pointer"
                      onDoubleClick={() =>
                        !column.isPrimaryKey && handleCellDoubleClick(rowIndex, column.name, cellValue)
                      }
                      title={column.isPrimaryKey ? 'Primary key (read-only)' : 'Double-click to edit'}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={inputRef}
                            type={getInputType(column)}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleSaveCell}
                            className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                            title="Save (Enter)"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                            title="Cancel (Esc)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={column.isPrimaryKey ? 'font-medium' : ''}>
                            {renderCellValue(cellValue, column)}
                          </span>
                          {!column.isPrimaryKey && onUpdate && (
                            <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                {(onUpdate || onDelete) && (
                  <td className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      {onDelete && (
                        <button
                          onClick={() => handleDeleteRow(rowIndex)}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && !isAddingRow && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium">No data to display</p>
            <p className="text-sm mt-1">Execute a query to see results here</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedRows.size > 0 && `${selectedRows.size} row${selectedRows.size > 1 ? 's' : ''} selected`}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total: {data.length} rows
        </div>
      </div>
    </div>
  );
}
