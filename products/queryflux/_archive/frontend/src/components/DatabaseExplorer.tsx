import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Table, Eye, Code, Folder, RefreshCw, Database } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface DatabaseExplorerProps {
  connectionId: string;
  onSelectObject: (schema: string, objectType: string, objectName: string) => void;
}

interface DatabaseObject {
  schema_name: string;
  object_type: string;
  object_name: string;
  columns?: Array<{ name: string; type: string }>;
}

interface SchemaGroup {
  schema: string;
  tables: DatabaseObject[];
  views: DatabaseObject[];
  functions: DatabaseObject[];
}

export function DatabaseExplorer({ connectionId, onSelectObject }: DatabaseExplorerProps) {
  const { theme } = useTheme();
  const [schemas, setSchemas] = useState<SchemaGroup[]>([]);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDatabaseObjects();
  }, [connectionId]);

  const loadDatabaseObjects = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('connection_objects')
        .select('*')
        .eq('connection_id', connectionId);

      if (data) {
        const grouped = data.reduce((acc, obj) => {
          let schema = acc.find(s => s.schema === obj.schema_name);
          if (!schema) {
            schema = { schema: obj.schema_name, tables: [], views: [], functions: [] };
            acc.push(schema);
          }

          const dbObject: DatabaseObject = {
            schema_name: obj.schema_name,
            object_type: obj.object_type,
            object_name: obj.object_name,
            columns: obj.columns || [],
          };

          if (obj.object_type === 'table') {
            schema.tables.push(dbObject);
          } else if (obj.object_type === 'view') {
            schema.views.push(dbObject);
          } else if (obj.object_type === 'function' || obj.object_type === 'procedure') {
            schema.functions.push(dbObject);
          }

          return acc;
        }, [] as SchemaGroup[]);

        setSchemas(grouped);
      }
    } catch (error) {
      console.error('Failed to load database objects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSchema = (schema: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schema)) {
      newExpanded.delete(schema);
    } else {
      newExpanded.add(schema);
    }
    setExpandedSchemas(newExpanded);
  };

  const toggleType = (key: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTypes(newExpanded);
  };

  return (
    <div
      className="w-72 border-r flex flex-col h-full glass-morphism"
      style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}
    >
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color: theme.colors.accent }} />
          <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>
            Database Explorer
          </h3>
        </div>
        <button
          onClick={loadDatabaseObjects}
          disabled={isLoading}
          className="p-1.5 rounded-lg glass-morphism hover:scale-110 transition-all"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} style={{ color: theme.colors.textSecondary }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {schemas.length === 0 && !isLoading && (
          <div className="text-center py-12 px-4">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: theme.colors.textSecondary }} />
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
              No database objects found
            </p>
            <button
              onClick={loadDatabaseObjects}
              className="mt-4 text-xs px-3 py-1.5 rounded-lg glass-morphism"
              style={{ color: theme.colors.accent }}
            >
              Load Objects
            </button>
          </div>
        )}

        {schemas.map((schemaGroup) => {
          const isSchemaExpanded = expandedSchemas.has(schemaGroup.schema);

          return (
            <div key={schemaGroup.schema}>
              <button
                onClick={() => toggleSchema(schemaGroup.schema)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all hover:bg-white/5"
              >
                {isSchemaExpanded ? (
                  <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                ) : (
                  <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                )}
                <Folder className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.accent }} />
                <span className="text-xs font-semibold truncate" style={{ color: theme.colors.text }}>
                  {schemaGroup.schema}
                </span>
              </button>

              {isSchemaExpanded && (
                <div className="ml-5 mt-1 space-y-1">
                  {schemaGroup.tables.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleType(`${schemaGroup.schema}-tables`)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-white/5"
                      >
                        {expandedTypes.has(`${schemaGroup.schema}-tables`) ? (
                          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        ) : (
                          <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        )}
                        <Table className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        <span className="text-xs flex-1 truncate" style={{ color: theme.colors.textSecondary }}>
                          Tables
                        </span>
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {schemaGroup.tables.length}
                        </span>
                      </button>

                      {expandedTypes.has(`${schemaGroup.schema}-tables`) && (
                        <div className="ml-5 space-y-0.5">
                          {schemaGroup.tables.map((table) => (
                            <button
                              key={table.object_name}
                              onClick={() => onSelectObject(table.schema_name, 'table', table.object_name)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all hover:bg-white/5"
                            >
                              <Table className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.accent }} />
                              <span className="text-xs truncate" style={{ color: theme.colors.text }}>
                                {table.object_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {schemaGroup.views.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleType(`${schemaGroup.schema}-views`)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-white/5"
                      >
                        {expandedTypes.has(`${schemaGroup.schema}-views`) ? (
                          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        ) : (
                          <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        )}
                        <Eye className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        <span className="text-xs flex-1 truncate" style={{ color: theme.colors.textSecondary }}>
                          Views
                        </span>
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {schemaGroup.views.length}
                        </span>
                      </button>

                      {expandedTypes.has(`${schemaGroup.schema}-views`) && (
                        <div className="ml-5 space-y-0.5">
                          {schemaGroup.views.map((view) => (
                            <button
                              key={view.object_name}
                              onClick={() => onSelectObject(view.schema_name, 'view', view.object_name)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all hover:bg-white/5"
                            >
                              <Eye className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.accent }} />
                              <span className="text-xs truncate" style={{ color: theme.colors.text }}>
                                {view.object_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {schemaGroup.functions.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleType(`${schemaGroup.schema}-functions`)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-white/5"
                      >
                        {expandedTypes.has(`${schemaGroup.schema}-functions`) ? (
                          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        ) : (
                          <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        )}
                        <Code className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                        <span className="text-xs flex-1 truncate" style={{ color: theme.colors.textSecondary }}>
                          Functions
                        </span>
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {schemaGroup.functions.length}
                        </span>
                      </button>

                      {expandedTypes.has(`${schemaGroup.schema}-functions`) && (
                        <div className="ml-5 space-y-0.5">
                          {schemaGroup.functions.map((func) => (
                            <button
                              key={func.object_name}
                              onClick={() => onSelectObject(func.schema_name, func.object_type, func.object_name)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all hover:bg-white/5"
                            >
                              <Code className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.accent }} />
                              <span className="text-xs truncate" style={{ color: theme.colors.text }}>
                                {func.object_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
