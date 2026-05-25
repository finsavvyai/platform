import { useState } from 'react';
import { Database, Table, Key, Link, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  relationships: Relationship[];
}

interface ColumnSchema {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  nullable: boolean;
}

interface Relationship {
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

interface SchemaVisualizerProps {
  databaseName: string;
}

export function SchemaVisualizer({ databaseName }: SchemaVisualizerProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const sampleTables: TableSchema[] = [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, nullable: false },
        { name: 'email', type: 'text', isPrimaryKey: false, isForeignKey: false, nullable: false },
        { name: 'name', type: 'text', isPrimaryKey: false, isForeignKey: false, nullable: true },
        { name: 'created_at', type: 'timestamp', isPrimaryKey: false, isForeignKey: false, nullable: false },
      ],
      relationships: [
        { fromTable: 'users', toTable: 'orders', fromColumn: 'id', toColumn: 'user_id', type: 'one-to-many' },
        { fromTable: 'users', toTable: 'profiles', fromColumn: 'id', toColumn: 'user_id', type: 'one-to-one' },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, nullable: false },
        { name: 'user_id', type: 'uuid', isPrimaryKey: false, isForeignKey: true, nullable: false },
        { name: 'total', type: 'decimal', isPrimaryKey: false, isForeignKey: false, nullable: false },
        { name: 'status', type: 'text', isPrimaryKey: false, isForeignKey: false, nullable: false },
        { name: 'created_at', type: 'timestamp', isPrimaryKey: false, isForeignKey: false, nullable: false },
      ],
      relationships: [
        { fromTable: 'orders', toTable: 'users', fromColumn: 'user_id', toColumn: 'id', type: 'one-to-many' },
        { fromTable: 'orders', toTable: 'order_items', fromColumn: 'id', toColumn: 'order_id', type: 'one-to-many' },
      ],
    },
    {
      name: 'products',
      columns: [
        { name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, nullable: false },
        { name: 'name', type: 'text', isPrimaryKey: false, isForeignKey: false, nullable: false },
        { name: 'price', type: 'decimal', isPrimaryKey: false, isForeignKey: false, nullable: false },
        { name: 'stock', type: 'integer', isPrimaryKey: false, isForeignKey: false, nullable: false },
      ],
      relationships: [
        { fromTable: 'products', toTable: 'order_items', fromColumn: 'id', toColumn: 'product_id', type: 'one-to-many' },
      ],
    },
    {
      name: 'order_items',
      columns: [
        { name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, nullable: false },
        { name: 'order_id', type: 'uuid', isPrimaryKey: false, isForeignKey: true, nullable: false },
        { name: 'product_id', type: 'uuid', isPrimaryKey: false, isForeignKey: true, nullable: false },
        { name: 'quantity', type: 'integer', isPrimaryKey: false, isForeignKey: false, nullable: false },
      ],
      relationships: [
        { fromTable: 'order_items', toTable: 'orders', fromColumn: 'order_id', toColumn: 'id', type: 'one-to-many' },
        { fromTable: 'order_items', toTable: 'products', fromColumn: 'product_id', toColumn: 'id', type: 'one-to-many' },
      ],
    },
  ];

  const selectedTableData = sampleTables.find(t => t.name === selectedTable);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: theme.colors.accent }} />
          <h3 className="font-semibold" style={{ color: theme.colors.text }}>Schema Visualization</h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg glass-morphism hover-3d"
        >
          {isExpanded ? (
            <Minimize2 className="w-4 h-4" style={{ color: theme.colors.text }} />
          ) : (
            <Maximize2 className="w-4 h-4" style={{ color: theme.colors.text }} />
          )}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r overflow-y-auto" style={{ borderColor: theme.colors.border }}>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold" style={{ color: theme.colors.textSecondary }}>
              TABLES ({sampleTables.length})
            </p>
            {sampleTables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`w-full text-left p-3 rounded-lg transition-all hover-3d ${
                  selectedTable === table.name ? 'glass-morphism-strong glow-effect' : 'glass-morphism'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4" style={{
                    color: selectedTable === table.name ? theme.colors.accent : theme.colors.textSecondary
                  }} />
                  <span className="text-sm font-medium" style={{
                    color: selectedTable === table.name ? theme.colors.text : theme.colors.textSecondary
                  }}>
                    {table.name}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                  {table.columns.length} columns
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedTableData ? (
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center glow-effect"
                    style={{ backgroundColor: theme.colors.accent + '20' }}
                  >
                    <Table className="w-6 h-6" style={{ color: theme.colors.accent }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                      {selectedTableData.name}
                    </h3>
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      {selectedTableData.columns.length} columns • {selectedTableData.relationships.length} relationships
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>Columns</p>
                  {selectedTableData.columns.map((column) => (
                    <div
                      key={column.name}
                      className="flex items-center justify-between p-3 glass-morphism rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {column.isPrimaryKey && (
                          <Key className="w-4 h-4" style={{ color: theme.colors.accent }} />
                        )}
                        {column.isForeignKey && (
                          <Link className="w-4 h-4" style={{ color: theme.colors.accent }} />
                        )}
                        <div>
                          <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                            {column.name}
                          </p>
                          <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            {column.type} {column.nullable ? '(nullable)' : '(required)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {column.isPrimaryKey && (
                          <span
                            className="px-2 py-1 text-xs rounded-full"
                            style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                          >
                            PK
                          </span>
                        )}
                        {column.isForeignKey && (
                          <span
                            className="px-2 py-1 text-xs rounded-full"
                            style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                          >
                            FK
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTableData.relationships.length > 0 && (
                <div className="glass-card p-6 rounded-2xl">
                  <p className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>Relationships</p>
                  <div className="space-y-2">
                    {selectedTableData.relationships.map((rel, index) => (
                      <div
                        key={index}
                        className="p-3 glass-morphism rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Link className="w-4 h-4" style={{ color: theme.colors.accent }} />
                          <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                            {rel.fromTable}.{rel.fromColumn} → {rel.toTable}.{rel.toColumn}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {rel.type.replace('-', ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center glass-card p-12 rounded-2xl">
                <Database className="w-16 h-16 mx-auto mb-4" style={{ color: theme.colors.textSecondary }} />
                <p className="text-lg font-medium mb-2" style={{ color: theme.colors.text }}>
                  Select a Table
                </p>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Choose a table from the list to view its schema
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
