/**
 * Code Generator — table selection and schema statistics panel
 */

import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DatabaseSchema } from '../hooks/codeGenTypes';
import { calculateSchemaStats } from '../hooks/codeGenUtils';

interface CodeGeneratorSchemaPanelProps {
  schema: DatabaseSchema;
  selectedTables: string[];
  onToggleTable: (name: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function CodeGeneratorSchemaPanel({
  schema, selectedTables, onToggleTable, onSelectAll, onClear,
}: CodeGeneratorSchemaPanelProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const stats = calculateSchemaStats(schema);

  return (
    <>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold" style={{ color: theme.colors.text }}>
            {t('codegen.selectTables')}
          </label>
          <div className="flex gap-2">
            <button onClick={onSelectAll} className="text-xs text-blue-500 hover:underline">{t('codegen.selectAll')}</button>
            <button onClick={onClear} className="text-xs text-blue-500 hover:underline">{t('codegen.clear')}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {schema.tables.map((table) => (
            <button key={table.name} onClick={() => onToggleTable(table.name)}
              className={`rounded-lg border p-3 text-left transition-all ${selectedTables.includes(table.name) ? 'border-blue-500 bg-blue-500 bg-opacity-10' : ''}`}
              style={{ borderColor: theme.colors.border, color: theme.colors.text }}>
              <p className="text-sm font-medium">{table.name}</p>
              <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{table.columns.length} columns</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4" style={{ borderColor: theme.colors.border }}>
        <p className="mb-2 text-sm font-semibold" style={{ color: theme.colors.text }}>Schema Statistics</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Tables', value: stats.totalTables },
            { label: 'Columns', value: stats.totalColumns },
            { label: 'Indexes', value: stats.totalIndexes },
            { label: 'Foreign Keys', value: stats.totalForeignKeys },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-lg font-bold" style={{ color: theme.colors.accent }}>{value}</p>
              <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
