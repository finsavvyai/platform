import React, { useState } from 'react';

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
}

interface Row {
  [key: string]: any;
}

interface DataGridProps {
  columns?: Column[];
  data?: Row[];
  isLoading?: boolean;
  tableName?: string;
}

export const DataGrid: React.FC<DataGridProps> = ({
  columns = [],
  data = [],
  isLoading = false,
  tableName = 'Query Results'
}) => {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Mock data when no data provided
  const mockColumns: Column[] = [
    { name: 'id', type: 'integer', isPrimaryKey: true },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'created_at', type: 'timestamp' }
  ];

  const mockData: Row[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2024-01-15T10:30:00Z' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2024-01-16T14:22:00Z' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', created_at: '2024-01-17T09:15:00Z' }
  ];

  const displayColumns = columns.length > 0 ? columns : mockColumns;
  const displayData = data.length > 0 ? data : mockData;

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
    if (selectedRows.size === displayData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayData.map((_, i) => i));
    }
  };

  const renderCellValue = (value: any) => {
    if (value === null || value === undefined) return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>NULL</span>;
    if (value === '') return <span style={{ color: '#d1d5db' }}>empty</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '400px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#6b7280'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Loading data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '400px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            {tableName}
          </h3>
          <span style={{
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            borderRadius: '12px'
          }}>
            {displayData.length} rows
          </span>
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280'
        }}>
          Sample data
        </div>
      </div>

      {/* Data Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#f9fafb',
            zIndex: 10
          }}>
            <tr>
              <th style={{
                width: '40px',
                padding: '12px 16px',
                textAlign: 'left',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <input
                  type="checkbox"
                  checked={selectedRows.size === displayData.length && displayData.length > 0}
                  onChange={selectAllRows}
                  style={{ cursor: 'pointer' }}
                  aria-label="Select all rows"
                />
              </th>
              {displayColumns.map((column) => (
                <th
                  key={column.name}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {column.name}
                    {column.isPrimaryKey && (
                      <span style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        backgroundColor: '#fef3c7',
                        color: '#d97706',
                        borderRadius: '4px'
                      }}>
                        PK
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 'normal',
                    color: '#6b7280',
                    marginTop: '2px',
                    textTransform: 'none',
                    letterSpacing: 'normal'
                  }}>
                    {column.type}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{
                  backgroundColor: selectedRows.has(rowIndex) ? '#eff6ff' : 'white',
                  transition: 'background-color 0.15s ease-in-out'
              }}
              onMouseEnter={(e) => {
                if (!selectedRows.has(rowIndex)) {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedRows.has(rowIndex)) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <td style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <input
                  type="checkbox"
                  checked={selectedRows.has(rowIndex)}
                  onChange={() => toggleRowSelection(rowIndex)}
                  style={{ cursor: 'pointer' }}
                  aria-label={`Select row ${rowIndex + 1}`}
                />
              </td>
              {displayColumns.map((column) => {
                const cellValue = row[column.name];
                return (
                  <td
                    key={column.name}
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      color: '#1f2937',
                      borderBottom: '1px solid #f3f4f6',
                      fontWeight: column.isPrimaryKey ? '500' : 'normal'
                    }}
                  >
                    {renderCellValue(cellValue)}
                  </td>
                );
              })}
            </tr>
          ))}
          </tbody>
        </table>

        {displayData.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            color: '#6b7280'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              No data to display
            </div>
            <div style={{
              fontSize: '14px'
            }}>
              Execute a query to see results here
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div>
          {selectedRows.size > 0 && `${selectedRows.size} row${selectedRows.size > 1 ? 's' : ''} selected`}
        </div>
        <div>
          Total: {displayData.length} rows
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DataGrid;