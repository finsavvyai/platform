import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Brain, Shield, Database, Table, RefreshCw, Check, AlertCircle, Sparkles, ChevronDown, ChevronUp, Play, Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface DataMaskingPluginProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

type MaskingType = 'hash' | 'encrypt' | 'tokenize' | 'redact' | 'shuffle' | 'partial' | 'null';

interface FieldSensitivity {
  fieldName: string;
  dataType: string;
  sensitivityLevel: 'high' | 'medium' | 'low';
  suggestedMasking: MaskingType;
  reason: string;
  sampleData: string;
}

interface TableConfig {
  tableName: string;
  isEnabled: boolean;
  fields: FieldConfig[];
  aiAnalyzed: boolean;
}

interface FieldConfig {
  fieldName: string;
  dataType: string;
  maskingType: MaskingType | 'none';
  preserveFormat: boolean;
  isReversible: boolean;
}

interface MaskingPreview {
  original: string;
  masked: string;
}

export function DataMaskingPlugin({ isOpen, onClose, connectionId }: DataMaskingPluginProps) {
  const { theme } = useTheme();
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, FieldSensitivity[]>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'configure' | 'preview' | 'audit'>('configure');
  const [preview, setPreview] = useState<Map<string, MaskingPreview[]>>(new Map());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const maskingTypes = [
    { id: 'none' as const, label: 'No Masking', icon: Eye, color: '#6b7280' },
    { id: 'hash' as const, label: 'Hash', icon: Shield, color: '#8b5cf6' },
    { id: 'encrypt' as const, label: 'Encrypt', icon: Shield, color: '#3b82f6' },
    { id: 'tokenize' as const, label: 'Tokenize', icon: Database, color: '#10b981' },
    { id: 'redact' as const, label: 'Redact', icon: EyeOff, color: '#ef4444' },
    { id: 'shuffle' as const, label: 'Shuffle', icon: RefreshCw, color: '#f59e0b' },
    { id: 'partial' as const, label: 'Partial Mask', icon: EyeOff, color: '#ec4899' },
    { id: 'null' as const, label: 'Set Null', icon: X, color: '#64748b' },
  ];

  useEffect(() => {
    if (isOpen && connectionId) {
      loadDatabaseSchema();
      loadExistingConfigurations();
    }
  }, [isOpen, connectionId]);

  const loadDatabaseSchema = async () => {
    const mockTables: TableConfig[] = [
      {
        tableName: 'users',
        isEnabled: false,
        aiAnalyzed: false,
        fields: [
          { fieldName: 'id', dataType: 'uuid', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'email', dataType: 'text', maskingType: 'none', preserveFormat: true, isReversible: false },
          { fieldName: 'password', dataType: 'text', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'full_name', dataType: 'text', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'phone', dataType: 'text', maskingType: 'none', preserveFormat: true, isReversible: false },
          { fieldName: 'ssn', dataType: 'text', maskingType: 'none', preserveFormat: true, isReversible: false },
          { fieldName: 'credit_card', dataType: 'text', maskingType: 'none', preserveFormat: true, isReversible: false },
          { fieldName: 'address', dataType: 'text', maskingType: 'none', preserveFormat: false, isReversible: false },
        ]
      },
      {
        tableName: 'orders',
        isEnabled: false,
        aiAnalyzed: false,
        fields: [
          { fieldName: 'id', dataType: 'uuid', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'user_id', dataType: 'uuid', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'total_amount', dataType: 'numeric', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'payment_method', dataType: 'text', maskingType: 'none', preserveFormat: false, isReversible: false },
        ]
      },
      {
        tableName: 'payments',
        isEnabled: false,
        aiAnalyzed: false,
        fields: [
          { fieldName: 'id', dataType: 'uuid', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'card_number', dataType: 'text', maskingType: 'none', preserveFormat: true, isReversible: false },
          { fieldName: 'cvv', dataType: 'text', maskingType: 'none', preserveFormat: false, isReversible: false },
          { fieldName: 'expiry_date', dataType: 'date', maskingType: 'none', preserveFormat: true, isReversible: false },
        ]
      }
    ];

    setTables(mockTables);
  };

  const loadExistingConfigurations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('plugin_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('plugin_id', 'data-masking-ai');

    if (data && data.length > 0) {
    }
  };

  const analyzeTableWithAI = async (tableName: string) => {
    setIsAnalyzing(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockSuggestions: Map<string, FieldSensitivity[]> = new Map();

    if (tableName === 'users') {
      mockSuggestions.set('users', [
        {
          fieldName: 'email',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'hash',
          reason: 'Personal Identifiable Information (PII) - Email addresses can identify individuals',
          sampleData: 'john.doe@example.com'
        },
        {
          fieldName: 'password',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'hash',
          reason: 'Sensitive credential - Should always be hashed',
          sampleData: 'hashed_value_here'
        },
        {
          fieldName: 'full_name',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'shuffle',
          reason: 'PII - Direct identifier of individuals',
          sampleData: 'John Michael Doe'
        },
        {
          fieldName: 'phone',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'partial',
          reason: 'PII - Phone numbers are direct contact information',
          sampleData: '+1-555-123-4567'
        },
        {
          fieldName: 'ssn',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'encrypt',
          reason: 'Critical PII - Social Security Numbers must be protected',
          sampleData: '123-45-6789'
        },
        {
          fieldName: 'credit_card',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'tokenize',
          reason: 'Payment Card Industry (PCI) sensitive data',
          sampleData: '4532-1234-5678-9010'
        },
        {
          fieldName: 'address',
          dataType: 'text',
          sensitivityLevel: 'medium',
          suggestedMasking: 'shuffle',
          reason: 'PII - Physical address information',
          sampleData: '123 Main St, Anytown, USA'
        }
      ]);
    } else if (tableName === 'payments') {
      mockSuggestions.set('payments', [
        {
          fieldName: 'card_number',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'tokenize',
          reason: 'PCI-DSS requirement - Card numbers must be protected',
          sampleData: '4532-1234-5678-9010'
        },
        {
          fieldName: 'cvv',
          dataType: 'text',
          sensitivityLevel: 'high',
          suggestedMasking: 'redact',
          reason: 'PCI-DSS requirement - CVV should never be stored',
          sampleData: '123'
        },
        {
          fieldName: 'expiry_date',
          dataType: 'date',
          sensitivityLevel: 'medium',
          suggestedMasking: 'partial',
          reason: 'Payment information - Should be partially masked',
          sampleData: '12/2025'
        }
      ]);
    }

    setAiSuggestions(new Map([...aiSuggestions, ...mockSuggestions]));

    setTables(tables.map(t =>
      t.tableName === tableName ? { ...t, aiAnalyzed: true } : t
    ));

    setIsAnalyzing(false);
  };

  const applyAISuggestions = (tableName: string) => {
    const suggestions = aiSuggestions.get(tableName);
    if (!suggestions) return;

    setTables(tables.map(table => {
      if (table.tableName !== tableName) return table;

      return {
        ...table,
        isEnabled: true,
        fields: table.fields.map(field => {
          const suggestion = suggestions.find(s => s.fieldName === field.fieldName);
          if (!suggestion) return field;

          return {
            ...field,
            maskingType: suggestion.suggestedMasking,
            preserveFormat: ['phone', 'ssn', 'credit_card', 'card_number', 'expiry_date'].includes(field.fieldName),
            isReversible: suggestion.suggestedMasking === 'encrypt' || suggestion.suggestedMasking === 'tokenize'
          };
        })
      };
    }));
  };

  const updateFieldMasking = (tableName: string, fieldName: string, maskingType: MaskingType | 'none') => {
    setTables(tables.map(table => {
      if (table.tableName !== tableName) return table;

      return {
        ...table,
        fields: table.fields.map(field =>
          field.fieldName === fieldName ? { ...field, maskingType } : field
        )
      };
    }));
  };

  const toggleTable = (tableName: string) => {
    setTables(tables.map(table =>
      table.tableName === tableName ? { ...table, isEnabled: !table.isEnabled } : table
    ));
  };

  const generatePreview = async (tableName: string) => {
    const mockPreviews: MaskingPreview[] = [
      { original: 'john.doe@example.com', masked: 'a8f5f167f44f4964e6c998dee827110c' },
      { original: 'Jane Smith', masked: 'Michael Johnson' },
      { original: '+1-555-123-4567', masked: '+1-XXX-XXX-4567' },
      { original: '123-45-6789', masked: '***-**-6789' },
      { original: '4532-1234-5678-9010', masked: 'tok_a8f5f167f44f' },
    ];

    setPreview(new Map(preview.set(tableName, mockPreviews)));
  };

  const saveConfiguration = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const configurationsToSave = tables
      .filter(table => table.isEnabled)
      .flatMap(table =>
        table.fields
          .filter(field => field.maskingType !== 'none')
          .map(field => ({
            user_id: user.id,
            plugin_id: 'data-masking-ai',
            table_name: table.tableName,
            field_name: field.fieldName,
            masking_type: field.maskingType,
            masking_config: {
              preserveFormat: field.preserveFormat,
              isReversible: field.isReversible
            },
            is_active: true
          }))
      );

    if (configurationsToSave.length === 0) {
      alert('No masking configurations to save');
      return;
    }

    await supabase
      .from('plugin_configurations')
      .delete()
      .eq('user_id', user.id)
      .eq('plugin_id', 'data-masking-ai');

    const { error } = await supabase
      .from('plugin_configurations')
      .insert(configurationsToSave);

    if (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration');
      return;
    }

    alert('Masking configuration saved successfully!');
  };

  const toggleTableExpanded = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-7xl h-[90vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.colors.accent + '20' }}>
              <EyeOff className="w-5 h-5" style={{ color: theme.colors.accent }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                AI Data Masking Pro
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Intelligent data privacy and protection
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full glass-morphism hover-3d transition-all">
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex border-b" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={() => setActiveTab('configure')}
            className={`px-6 py-3 font-medium transition-all ${activeTab === 'configure' ? 'border-b-2' : ''}`}
            style={{
              borderColor: activeTab === 'configure' ? theme.colors.accent : 'transparent',
              color: activeTab === 'configure' ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            Configure Masking
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 font-medium transition-all ${activeTab === 'preview' ? 'border-b-2' : ''}`}
            style={{
              borderColor: activeTab === 'preview' ? theme.colors.accent : 'transparent',
              color: activeTab === 'preview' ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 font-medium transition-all ${activeTab === 'audit' ? 'border-b-2' : ''}`}
            style={{
              borderColor: activeTab === 'audit' ? theme.colors.accent : 'transparent',
              color: activeTab === 'audit' ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            Audit Log
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'configure' && (
            <div className="space-y-4">
              {!connectionId && (
                <div className="p-4 rounded-lg bg-yellow-500/20 border border-yellow-500 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 text-yellow-500" />
                  <div className="text-sm text-yellow-500">
                    <p className="font-semibold mb-1">No database connection selected</p>
                    <p>Please select a database connection to configure data masking.</p>
                  </div>
                </div>
              )}

              {tables.map(table => {
                const isExpanded = expandedTables.has(table.tableName);
                const suggestions = aiSuggestions.get(table.tableName);
                const activeMaskingCount = table.fields.filter(f => f.maskingType !== 'none').length;

                return (
                  <div key={table.tableName} className="glass-card rounded-lg overflow-hidden" style={{ borderColor: theme.colors.border }}>
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                      onClick={() => toggleTableExpanded(table.tableName)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp className="w-5 h-5" style={{ color: theme.colors.textSecondary }} /> : <ChevronDown className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />}
                        <Database className="w-5 h-5" style={{ color: theme.colors.accent }} />
                        <div>
                          <h3 className="font-semibold" style={{ color: theme.colors.text }}>{table.tableName}</h3>
                          <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            {table.fields.length} fields • {activeMaskingCount} masked
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!table.aiAnalyzed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              analyzeTableWithAI(table.tableName);
                            }}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                          >
                            <Brain className="w-3 h-3" />
                            {isAnalyzing ? 'Analyzing...' : 'AI Analyze'}
                          </button>
                        )}

                        {table.aiAnalyzed && suggestions && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              applyAISuggestions(table.tableName);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: '#10b981' + '20', color: '#10b981' }}
                          >
                            <Sparkles className="w-3 h-3" />
                            Apply Suggestions
                          </button>
                        )}

                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={table.isEnabled}
                            onChange={() => toggleTable(table.tableName)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm" style={{ color: theme.colors.text }}>Enable</span>
                        </label>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t space-y-4" style={{ borderColor: theme.colors.border }}>
                        {suggestions && suggestions.length > 0 && (
                          <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.accent + '10' }}>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.accent }}>
                              <Brain className="w-4 h-4" />
                              AI Recommendations
                            </h4>
                            <div className="space-y-2">
                              {suggestions.map(suggestion => (
                                <div key={suggestion.fieldName} className="text-xs space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold" style={{ color: theme.colors.text }}>
                                      {suggestion.fieldName}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      suggestion.sensitivityLevel === 'high' ? 'bg-red-500/20 text-red-500' :
                                      suggestion.sensitivityLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                                      'bg-green-500/20 text-green-500'
                                    }`}>
                                      {suggestion.sensitivityLevel.toUpperCase()}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                                      {suggestion.suggestedMasking.toUpperCase()}
                                    </span>
                                  </div>
                                  <p style={{ color: theme.colors.textSecondary }}>{suggestion.reason}</p>
                                  <p style={{ color: theme.colors.textSecondary }}>Example: {suggestion.sampleData}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {table.fields.map(field => (
                            <div key={field.fieldName} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                              <div>
                                <p className="font-medium text-sm" style={{ color: theme.colors.text }}>{field.fieldName}</p>
                                <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{field.dataType}</p>
                              </div>

                              <select
                                value={field.maskingType}
                                onChange={(e) => updateFieldMasking(table.tableName, field.fieldName, e.target.value as MaskingType | 'none')}
                                disabled={!table.isEnabled}
                                className="px-3 py-1.5 rounded-lg text-sm"
                                style={{
                                  backgroundColor: theme.colors.foreground,
                                  color: theme.colors.text,
                                  borderColor: theme.colors.border
                                }}
                              >
                                {maskingTypes.map(type => (
                                  <option key={type.id} value={type.id}>{type.label}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={saveConfiguration}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  <Save className="w-5 h-5" />
                  Save Configuration
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              {tables.filter(t => t.isEnabled).map(table => (
                <div key={table.tableName} className="glass-card rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold" style={{ color: theme.colors.text }}>{table.tableName}</h3>
                    <button
                      onClick={() => generatePreview(table.tableName)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                    >
                      <Play className="w-4 h-4" />
                      Generate Preview
                    </button>
                  </div>

                  {preview.get(table.tableName) && (
                    <div className="space-y-2">
                      {preview.get(table.tableName)!.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4 p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                          <div>
                            <p className="text-xs font-semibold mb-1" style={{ color: theme.colors.textSecondary }}>Original</p>
                            <p className="text-sm" style={{ color: theme.colors.text }}>{item.original}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold mb-1" style={{ color: theme.colors.textSecondary }}>Masked</p>
                            <p className="text-sm font-mono" style={{ color: theme.colors.accent }}>{item.masked}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg glass-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5" style={{ color: '#10b981' }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: theme.colors.text }}>Configuration saved</p>
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>3 tables, 12 fields masked</p>
                  </div>
                </div>
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>2 hours ago</span>
              </div>

              <div className="p-4 rounded-lg glass-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5" style={{ color: theme.colors.accent }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: theme.colors.text }}>AI analysis completed</p>
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>users table analyzed, 7 sensitive fields detected</p>
                  </div>
                </div>
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>3 hours ago</span>
              </div>

              <div className="p-4 rounded-lg glass-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" style={{ color: '#3b82f6' }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: theme.colors.text }}>Masking applied</p>
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>1,234 records masked in users table</p>
                  </div>
                </div>
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>1 day ago</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
