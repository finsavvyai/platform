import { useState, useEffect } from 'react';
import { X, Sparkles, Database, Shield, Zap, Wand2, Eye, Play, Undo, Check, AlertTriangle, TrendingUp, Box, Crown, Lock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface AIEngineExtensionProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

interface TableInfo {
  table_name: string;
  column_count: number;
  row_count?: number;
}

type ActionType = 'describe' | 'graphify' | 'securify' | 'performancify' | 'extendify';

interface AIResult {
  type: ActionType;
  data: any;
  sql?: string;
  canApply?: boolean;
  canUndo?: boolean;
}

export function AIEngineExtension({ isOpen, onClose, connectionId }: AIEngineExtensionProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [requirement, setRequirement] = useState('');
  const [includeRelated, setIncludeRelated] = useState(false);
  const [migrationFormat, setMigrationFormat] = useState<'sql' | 'flyway' | 'liquibase'>('sql');
  const [autoApply, setAutoApply] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    if (isOpen && connectionId) {
      loadTables();
      checkPremiumStatus();
    }
  }, [isOpen, connectionId]);

  const checkPremiumStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    setHasPremium(!!data);
  };

  const loadTables = async () => {
    if (!connectionId) return;

    const { data } = await supabase
      .from('schemas')
      .select('table_name')
      .eq('connection_id', connectionId)
      .order('table_name');

    if (data) {
      setTables(data.map(t => ({
        table_name: t.table_name,
        column_count: 0,
      })));
    }
  };

  const analyzeTable = async (action: ActionType) => {
    const premiumFeatures: ActionType[] = ['graphify', 'securify', 'performancify', 'extendify'];

    if (premiumFeatures.includes(action) && !hasPremium) {
      setShowPremiumModal(true);
      return;
    }

    if (!selectedTable && action !== 'extendify') {
      alert('Please select a table first');
      return;
    }

    if (action === 'extendify' && !requirement.trim()) {
      alert('Please describe your requirement');
      return;
    }

    setActiveAction(action);
    setIsAnalyzing(true);
    setResult(null);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockResult = generateMockResult(action, selectedTable);
    setResult(mockResult);
    setIsAnalyzing(false);
  };

  const generateMockResult = (action: ActionType, tableName: string): AIResult => {
    switch (action) {
      case 'describe':
        return {
          type: 'describe',
          data: {
            summary: `The ${tableName} table is a core entity in your database schema.`,
            purpose: `This table stores ${tableName.replace('_', ' ')} records with a normalized structure.`,
            columns: [
              { name: 'id', type: 'uuid', nullable: false, key: 'PRIMARY', description: 'Unique identifier' },
              { name: 'name', type: 'text', nullable: false, description: 'Display name' },
              { name: 'email', type: 'text', nullable: true, description: 'Contact email' },
              { name: 'created_at', type: 'timestamp', nullable: false, description: 'Record creation time' },
              { name: 'updated_at', type: 'timestamp', nullable: true, description: 'Last update time' },
            ],
            relationships: [
              { table: 'related_table', type: 'One-to-Many', via: 'foreign_key_id' },
            ],
            insights: [
              'Well-structured primary key using UUID',
              'Includes audit timestamps',
              'Foreign key relationships properly defined',
              'Follows naming conventions',
            ],
          },
        };

      case 'graphify':
        return {
          type: 'graphify',
          data: {
            mainTable: tableName,
            structure: {
              name: tableName,
              columns: ['id', 'name', 'email', 'created_at', 'updated_at'],
              primaryKey: 'id',
            },
            relatedTables: includeRelated ? [
              { name: 'orders', relation: 'has many', foreignKey: 'user_id' },
              { name: 'profiles', relation: 'has one', foreignKey: 'user_id' },
              { name: 'permissions', relation: 'many-to-many', foreignKey: 'user_id' },
            ] : [],
            visualization: 'uml',
          },
        };

      case 'securify':
        return {
          type: 'securify',
          data: {
            overallScore: 7.5,
            issues: [
              {
                severity: 'high',
                column: 'password',
                issue: 'Password column detected without encryption',
                recommendation: 'Use pgcrypto extension for password hashing',
                sql: `ALTER TABLE ${tableName} ADD COLUMN password_hash text;\n-- Then migrate existing passwords using:\n-- UPDATE ${tableName} SET password_hash = crypt(password, gen_salt('bf'));`,
              },
              {
                severity: 'medium',
                column: 'email',
                issue: 'PII data without encryption at rest',
                recommendation: 'Consider column-level encryption for sensitive data',
                sql: `-- Enable pgcrypto extension\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n-- Add encrypted column\nALTER TABLE ${tableName} ADD COLUMN email_encrypted bytea;`,
              },
              {
                severity: 'high',
                column: '*',
                issue: 'No Row Level Security enabled',
                recommendation: 'Enable RLS to protect data access',
                sql: `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY "Users can view own data"\n  ON ${tableName}\n  FOR SELECT\n  TO authenticated\n  USING (auth.uid() = user_id);`,
              },
            ],
            recommendations: [
              'Enable Row Level Security (RLS)',
              'Add indexes on foreign keys',
              'Implement data masking for PII',
              'Use prepared statements to prevent SQL injection',
              'Audit sensitive column access',
            ],
          },
          canApply: true,
        };

      case 'performancify':
        return {
          type: 'performancify',
          data: {
            overallScore: 6.8,
            suggestions: [
              {
                priority: 'high',
                category: 'Indexing',
                issue: 'Missing index on frequently queried column',
                impact: 'Query performance degradation on large datasets',
                solution: 'Add B-tree index on email column',
                sql: `CREATE INDEX CONCURRENTLY idx_${tableName}_email ON ${tableName}(email);`,
                estimatedImprovement: '70% faster lookups',
              },
              {
                priority: 'high',
                category: 'Indexing',
                issue: 'Foreign key without index',
                impact: 'Slow JOIN operations',
                solution: 'Add index on foreign key columns',
                sql: `CREATE INDEX CONCURRENTLY idx_${tableName}_user_id ON ${tableName}(user_id);`,
                estimatedImprovement: '85% faster JOINs',
              },
              {
                priority: 'medium',
                category: 'Query Optimization',
                issue: 'Full table scans on timestamp queries',
                impact: 'Slow date range queries',
                solution: 'Add composite index for date-based queries',
                sql: `CREATE INDEX CONCURRENTLY idx_${tableName}_created_at ON ${tableName}(created_at DESC);`,
                estimatedImprovement: '60% faster time-based queries',
              },
              {
                priority: 'medium',
                category: 'Partitioning',
                issue: 'Large table without partitioning',
                impact: 'Slower queries and maintenance',
                solution: 'Consider range partitioning by date',
                sql: `-- Convert to partitioned table\nCREATE TABLE ${tableName}_partitioned (\n  LIKE ${tableName} INCLUDING ALL\n) PARTITION BY RANGE (created_at);`,
                estimatedImprovement: '40% faster queries on partitioned data',
              },
              {
                priority: 'low',
                category: 'Data Type',
                issue: 'TEXT column used for limited values',
                impact: 'Unnecessary storage overhead',
                solution: 'Consider ENUM or CHECK constraint',
                sql: `ALTER TABLE ${tableName} ADD CONSTRAINT check_status \nCHECK (status IN ('active', 'inactive', 'pending'));`,
                estimatedImprovement: '20% storage reduction',
              },
            ],
            metrics: {
              avgQueryTime: '245ms',
              tableSize: '128MB',
              indexSize: '32MB',
              rowCount: '150,000',
            },
          },
          canApply: true,
          canUndo: true,
        };

      case 'extendify':
        return {
          type: 'extendify',
          data: {
            requirement: requirement,
            analysis: `Analyzed requirement: "${requirement}"`,
            implementation: {
              sql: generateExtendifySQL(tableName, requirement, migrationFormat),
              format: migrationFormat,
              changes: [
                'Add new column: subscription_tier',
                'Create index on subscription_tier',
                'Add CHECK constraint for valid values',
                'Set default value for existing rows',
              ],
              rollback: generateRollbackSQL(tableName, requirement, migrationFormat),
            },
          },
          sql: generateExtendifySQL(tableName, requirement, migrationFormat),
          canApply: true,
          canUndo: true,
        };

      default:
        return { type: action, data: {} };
    }
  };

  const generateExtendifySQL = (table: string, req: string, format: string): string => {
    const baseSQL = `-- AI-Generated Migration for: ${req}\n-- Generated: ${new Date().toISOString()}\n\nALTER TABLE ${table}\nADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';\n\nCREATE INDEX IF NOT EXISTS idx_${table}_subscription_tier ON ${table}(subscription_tier);\n\nALTER TABLE ${table}\nADD CONSTRAINT IF NOT EXISTS check_subscription_tier\nCHECK (subscription_tier IN ('free', 'pro', 'enterprise'));\n\n-- Update existing rows\nUPDATE ${table}\nSET subscription_tier = 'free'\nWHERE subscription_tier IS NULL;`;

    if (format === 'flyway') {
      return `-- Flyway Migration\n-- Version: V${Date.now()}__${req.replace(/\s+/g, '_')}.sql\n-- Description: ${req}\n\n${baseSQL}`;
    } else if (format === 'liquibase') {
      return `-- Liquibase Changeset\n--liquibase formatted sql\n--changeset ai-engine:${Date.now()}\n--comment: ${req}\n\n${baseSQL}\n\n--rollback ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS check_subscription_tier;\n--rollback DROP INDEX IF EXISTS idx_${table}_subscription_tier;\n--rollback ALTER TABLE ${table} DROP COLUMN IF EXISTS subscription_tier;`;
    }
    return baseSQL;
  };

  const generateRollbackSQL = (table: string, req: string, format: string): string => {
    return `-- Rollback for: ${req}\n-- Generated: ${new Date().toISOString()}\n\nALTER TABLE ${table} DROP CONSTRAINT IF EXISTS check_subscription_tier;\nDROP INDEX IF EXISTS idx_${table}_subscription_tier;\nALTER TABLE ${table} DROP COLUMN IF EXISTS subscription_tier;`;
  };

  const handleApply = async () => {
    if (!result?.sql) return;

    const message = `${autoApply ? 'Auto-applying' : 'Apply'} these changes to your database?\n\n${result.sql.substring(0, 200)}...`;

    if (autoApply || confirm(message)) {
      alert('Changes applied successfully!\n\nIn production, this would execute:\n\n' + result.sql);
    }
  };

  const handleUndo = async () => {
    if (result?.type === 'extendify' && result.data.implementation?.rollback) {
      if (confirm('Undo the last changes?')) {
        alert('Changes rolled back successfully!\n\n' + result.data.implementation.rollback);
        setResult(null);
      }
    }
  };

  if (!isOpen) return null;

  const actions = [
    { type: 'describe' as ActionType, label: t('aiEngine.describe'), icon: Eye, color: '#3b82f6', description: t('aiEngine.describeDesc'), isFree: true },
    { type: 'graphify' as ActionType, label: t('aiEngine.graphify'), icon: Box, color: '#8b5cf6', description: t('aiEngine.graphifyDesc'), isFree: false },
    { type: 'securify' as ActionType, label: t('aiEngine.securify'), icon: Shield, color: '#ef4444', description: t('aiEngine.securifyDesc'), isFree: false },
    { type: 'performancify' as ActionType, label: t('aiEngine.performancify'), icon: Zap, color: '#f59e0b', description: t('aiEngine.performancifyDesc'), isFree: false },
    { type: 'extendify' as ActionType, label: t('aiEngine.extendify'), icon: Wand2, color: '#10b981', description: t('aiEngine.extendifyDesc'), isFree: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-6xl h-[90vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 glow-effect" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('aiEngine.title')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {t('aiEngine.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r p-4 overflow-y-auto" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: theme.colors.text }}>
                {t('aiEngine.selectTable')}
              </label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full px-3 py-2 rounded-lg glass-card border outline-none text-sm"
                style={{ borderColor: theme.colors.border, color: theme.colors.text }}
              >
                <option value="">{t('aiEngine.chooseTable')}</option>
                {tables.map((table) => (
                  <option key={table.table_name} value={table.table_name}>
                    {table.table_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.text }}>
                {t('aiEngine.aiActions')}
              </p>
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    onClick={() => {
                      if (action.type === 'extendify') {
                        if (!action.isFree && !hasPremium) {
                          setShowPremiumModal(true);
                          return;
                        }
                        setActiveAction('extendify');
                        setResult(null);
                      } else {
                        analyzeTable(action.type);
                      }
                    }}
                    disabled={(!selectedTable && action.type !== 'extendify') || isAnalyzing}
                    className={`w-full p-3 rounded-lg text-left transition-all disabled:opacity-50 hover-3d ${
                      activeAction === action.type ? 'glass-morphism' : ''
                    }`}
                    style={{
                      borderColor: activeAction === action.type ? action.color : 'transparent',
                      border: activeAction === action.type ? '1px solid' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: action.color }} />
                        <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                          {action.label}
                        </span>
                      </div>
                      {!action.isFree && (
                        <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />
                      )}
                    </div>
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      {action.description}
                    </p>
                    {!action.isFree && !hasPremium && (
                      <div className="mt-2 px-2 py-1 rounded text-[10px] font-semibold" style={{ backgroundColor: '#f59e0b' + '20', color: '#f59e0b' }}>
                        PREMIUM
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Sparkles className="w-16 h-16 mb-4 animate-spin glow-effect" style={{ color: theme.colors.accent }} />
                <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                  {t('aiEngine.analyzing')}
                </p>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  {t('common.loading')}
                </p>
              </div>
            ) : result ? (
              <div className="space-y-6">
                {result.type === 'describe' && (
                  <div>
                    <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text }}>
                      Table Analysis: {selectedTable}
                    </h3>

                    <div className="space-y-4">
                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Summary</h4>
                        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{result.data.summary}</p>
                      </div>

                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Purpose</h4>
                        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{result.data.purpose}</p>
                      </div>

                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-3" style={{ color: theme.colors.text }}>Columns</h4>
                        <div className="space-y-2">
                          {result.data.columns.map((col: any) => (
                            <div key={col.name} className="flex items-center justify-between p-2 rounded glass-card">
                              <div>
                                <span className="font-mono text-sm" style={{ color: theme.colors.text }}>{col.name}</span>
                                {col.key && (
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                                    {col.key}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>{col.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Key Insights</h4>
                        <ul className="space-y-1">
                          {result.data.insights.map((insight: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                              <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {result.type === 'graphify' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                        Visual Structure: {selectedTable}
                      </h3>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={includeRelated}
                          onChange={(e) => {
                            setIncludeRelated(e.target.checked);
                            analyzeTable('graphify');
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span style={{ color: theme.colors.text }}>Include Related Tables</span>
                      </label>
                    </div>

                    <div className="p-8 rounded-lg glass-card">
                      <div className="border-2 rounded-lg p-6 perspective-card" style={{ borderColor: theme.colors.accent }}>
                        <div className="text-center mb-4">
                          <h4 className="font-bold text-lg" style={{ color: theme.colors.text }}>{result.data.mainTable}</h4>
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                            PK: {result.data.structure.primaryKey}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {result.data.structure.columns.map((col: string) => (
                            <div key={col} className="text-sm p-2 rounded glass-card" style={{ color: theme.colors.text }}>
                              • {col}
                            </div>
                          ))}
                        </div>
                      </div>

                      {includeRelated && result.data.relatedTables.length > 0 && (
                        <div className="mt-6 grid grid-cols-3 gap-4">
                          {result.data.relatedTables.map((related: any) => (
                            <div key={related.name} className="border rounded-lg p-4 hover-3d" style={{ borderColor: theme.colors.border }}>
                              <h5 className="font-semibold mb-2" style={{ color: theme.colors.text }}>{related.name}</h5>
                              <p className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>
                                {related.relation}
                              </p>
                              <p className="text-xs font-mono" style={{ color: theme.colors.accent }}>
                                via {related.foreignKey}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {result.type === 'securify' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                        Security Analysis: {selectedTable}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5" style={{ color: result.data.overallScore > 7 ? '#10b981' : '#f59e0b' }} />
                        <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                          {result.data.overallScore}/10
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {result.data.issues.map((issue: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg glass-card border-l-4"
                          style={{
                            borderLeftColor: issue.severity === 'high' ? '#ef4444' : issue.severity === 'medium' ? '#f59e0b' : '#6b7280',
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-4 h-4" style={{ color: issue.severity === 'high' ? '#ef4444' : '#f59e0b' }} />
                                <span className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                                  {issue.column}: {issue.issue}
                                </span>
                              </div>
                              <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                                {issue.recommendation}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                              issue.severity === 'high' ? 'bg-red-500/20 text-red-500' :
                              issue.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                              'bg-gray-500/20 text-gray-500'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          {issue.sql && (
                            <pre className="text-xs font-mono p-2 rounded glass-card overflow-x-auto" style={{ color: theme.colors.text }}>
                              {issue.sql}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.type === 'performancify' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                        Performance Analysis: {selectedTable}
                      </h3>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" style={{ color: '#f59e0b' }} />
                        <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                          {result.data.overallScore}/10
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-6">
                      {Object.entries(result.data.metrics).map(([key, value]) => (
                        <div key={key} className="p-3 rounded-lg glass-card text-center hover-3d">
                          <p className="text-xs mb-1 capitalize" style={{ color: theme.colors.textSecondary }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="font-bold" style={{ color: theme.colors.text }}>{String(value)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {result.data.suggestions.map((suggestion: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg glass-card border-l-4"
                          style={{
                            borderLeftColor: suggestion.priority === 'high' ? '#ef4444' : suggestion.priority === 'medium' ? '#f59e0b' : '#6b7280',
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                                  {suggestion.category}: {suggestion.issue}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#10b981' + '20', color: '#10b981' }}>
                                  {suggestion.estimatedImprovement}
                                </span>
                              </div>
                              <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                                {suggestion.solution}
                              </p>
                              {suggestion.sql && (
                                <pre className="text-xs font-mono p-2 rounded glass-card overflow-x-auto" style={{ color: theme.colors.text }}>
                                  {suggestion.sql}
                                </pre>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold uppercase whitespace-nowrap ml-2 ${
                              suggestion.priority === 'high' ? 'bg-red-500/20 text-red-500' :
                              suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                              'bg-gray-500/20 text-gray-500'
                            }`}>
                              {suggestion.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.type === 'extendify' && (
                  <div>
                    <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text }}>
                      AI Implementation: {selectedTable}
                    </h3>

                    <div className="space-y-4">
                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Requirement</h4>
                        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{result.data.requirement}</p>
                      </div>

                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Changes</h4>
                        <ul className="space-y-1">
                          {result.data.implementation.changes.map((change: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                              <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                              {change}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-lg glass-card">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold" style={{ color: theme.colors.text }}>Generated Migration</h4>
                          <select
                            value={migrationFormat}
                            onChange={(e) => {
                              setMigrationFormat(e.target.value as any);
                              analyzeTable('extendify');
                            }}
                            className="px-3 py-1 rounded-lg glass-card border outline-none text-xs"
                            style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                          >
                            <option value="sql">Plain SQL</option>
                            <option value="flyway">Flyway</option>
                            <option value="liquibase">Liquibase</option>
                          </select>
                        </div>
                        <pre className="text-xs font-mono p-3 rounded glass-card overflow-x-auto" style={{ color: theme.colors.text, backgroundColor: theme.colors.editorBg }}>
                          {result.data.implementation.sql}
                        </pre>
                      </div>

                      <div className="p-4 rounded-lg glass-card">
                        <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Rollback Script</h4>
                        <pre className="text-xs font-mono p-3 rounded glass-card overflow-x-auto" style={{ color: theme.colors.text, backgroundColor: theme.colors.editorBg }}>
                          {result.data.implementation.rollback}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {(result.canApply || result.canUndo) && (
                  <div className="flex items-center gap-4 pt-6 border-t" style={{ borderColor: theme.colors.border }}>
                    {result.type === 'extendify' && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoApply}
                          onChange={(e) => setAutoApply(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm" style={{ color: theme.colors.text }}>{t('aiEngine.applyChanges')}</span>
                      </label>
                    )}
                    <div className="flex-1" />
                    {result.canUndo && (
                      <button
                        onClick={handleUndo}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium hover-3d"
                        style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                      >
                        <Undo className="w-4 h-4" />
                        {t('aiEngine.undo')}
                      </button>
                    )}
                    {result.canApply && (
                      <button
                        onClick={handleApply}
                        className="flex items-center gap-2 px-6 py-2 text-white rounded-lg font-medium glow-effect hover-3d"
                        style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                      >
                        <Play className="w-4 h-4" />
                        {t('aiEngine.applyChanges')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : activeAction === 'extendify' ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Wand2 className="w-16 h-16 mb-4 glow-effect" style={{ color: theme.colors.accent }} />
                <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.text }}>
                  Describe Your Requirement
                </h3>
                <p className="text-sm mb-6 text-center max-w-md" style={{ color: theme.colors.textSecondary }}>
                  Tell AI what you want to implement and it will generate the migration
                </p>

                <div className="w-full max-w-2xl space-y-4">
                  <textarea
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    placeholder="Example: Add a subscription tier column with free, pro, and enterprise options with proper indexing and constraints"
                    className="w-full h-32 p-4 rounded-lg glass-card border outline-none resize-none"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />

                  <div className="flex gap-4">
                    <select
                      value={migrationFormat}
                      onChange={(e) => setMigrationFormat(e.target.value as any)}
                      className="flex-1 px-3 py-2 rounded-lg glass-card border outline-none"
                      style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                    >
                      <option value="sql">Plain SQL</option>
                      <option value="flyway">Flyway Migration</option>
                      <option value="liquibase">Liquibase Changeset</option>
                    </select>

                    <button
                      onClick={() => analyzeTable('extendify')}
                      disabled={!requirement.trim() || !selectedTable}
                      className="px-6 py-2 text-white rounded-lg font-medium disabled:opacity-50 glow-effect"
                      style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <Database className="w-16 h-16 mb-4 opacity-50 floating-animation" style={{ color: theme.colors.textSecondary }} />
                <p className="text-lg" style={{ color: theme.colors.textSecondary }}>
                  Select a table and action to begin
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPremiumModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}dd` }}>
          <div className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl p-6 border-2" style={{ borderColor: '#f59e0b', backgroundColor: theme.colors.foreground }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f59e0b' + '20' }}>
                <Crown className="w-6 h-6" style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: theme.colors.text }}>
                  Premium Feature
                </h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Unlock advanced AI capabilities
                </p>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-sm" style={{ color: theme.colors.text }}>
                This feature requires a premium subscription. Get access to:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Graphify - UML and 3D visualizations
                </li>
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Securify - Security analysis
                </li>
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Performancify - Performance optimization
                </li>
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Extendify - AI migration generator
                </li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  window.open('https://queryflux.lemonsqueezy.com/checkout', '_blank');
                  setShowPremiumModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <Crown className="w-4 h-4" />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
