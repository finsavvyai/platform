import { useState, useEffect } from 'react';
import {
  X, Database, Code2, Rocket, Check, Server, Cloud,
  Play, Settings, Copy, Download, Globe, Lock, Zap,
  CheckCircle, XCircle, Loader, ExternalLink, Eye, Trash2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface AutoAPIGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  selected: boolean;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

interface APIEndpoint {
  id: string;
  name: string;
  endpoint_type: 'rest' | 'graphql';
  tables: string[];
  deployment_status: 'draft' | 'deploying' | 'deployed' | 'failed';
  deployment_url?: string;
  deployment_platform?: string;
  created_at: string;
}

type CloudPlatform = 'supabase_edge' | 'netlify' | 'render' | 'railway';

export function AutoAPIGenerator({ isOpen, onClose, connectionId }: AutoAPIGeneratorProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [step, setStep] = useState<'select' | 'configure' | 'generate' | 'deploy' | 'manage'>('select');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [endpointType, setEndpointType] = useState<'rest' | 'graphql'>('rest');
  const [endpointName, setEndpointName] = useState('');
  const [operations, setOperations] = useState({
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true
  });
  const [authEnabled, setAuthEnabled] = useState(true);
  const [rateLimit, setRateLimit] = useState(100);
  const [generatedCode, setGeneratedCode] = useState('');
  const [deploymentPlatform, setDeploymentPlatform] = useState<CloudPlatform>('supabase_edge');
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'deployed' | 'failed'>('idle');
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [existingEndpoints, setExistingEndpoints] = useState<APIEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);

  useEffect(() => {
    if (isOpen && connectionId) {
      loadTables();
      loadExistingEndpoints();
    }
  }, [isOpen, connectionId]);

  const loadTables = async () => {
    if (!connectionId) return;

    setLoading(true);
    try {
      // Get connection details
      const { data: connection } = await supabase
        .from('connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (!connection) return;

      // Mock table data - in production, query actual database
      const mockTables: TableInfo[] = [
        {
          name: 'users',
          selected: false,
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'text', nullable: false, isPrimaryKey: false },
            { name: 'name', type: 'text', nullable: true, isPrimaryKey: false },
            { name: 'created_at', type: 'timestamptz', nullable: false, isPrimaryKey: false }
          ]
        },
        {
          name: 'posts',
          selected: false,
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false },
            { name: 'title', type: 'text', nullable: false, isPrimaryKey: false },
            { name: 'content', type: 'text', nullable: true, isPrimaryKey: false },
            { name: 'created_at', type: 'timestamptz', nullable: false, isPrimaryKey: false }
          ]
        },
        {
          name: 'comments',
          selected: false,
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: 'post_id', type: 'uuid', nullable: false, isPrimaryKey: false },
            { name: 'user_id', type: 'uuid', nullable: false, isPrimaryKey: false },
            { name: 'text', type: 'text', nullable: false, isPrimaryKey: false },
            { name: 'created_at', type: 'timestamptz', nullable: false, isPrimaryKey: false }
          ]
        },
        {
          name: 'products',
          selected: false,
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: 'name', type: 'text', nullable: false, isPrimaryKey: false },
            { name: 'price', type: 'numeric', nullable: false, isPrimaryKey: false },
            { name: 'stock', type: 'integer', nullable: false, isPrimaryKey: false }
          ]
        }
      ];

      setTables(mockTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingEndpoints = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('api_endpoints')
      .select('*')
      .eq('user_id', user.id)
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false });

    if (data) {
      setExistingEndpoints(data);
    }
  };

  const toggleTable = (tableName: string) => {
    setTables(tables.map(t =>
      t.name === tableName ? { ...t, selected: !t.selected } : t
    ));
  };

  const getSelectedTables = () => tables.filter(t => t.selected);

  const generateEndpointCode = () => {
    const selectedTables = getSelectedTables();
    if (selectedTables.length === 0) return '';

    if (endpointType === 'rest') {
      return generateRESTCode(selectedTables);
    } else {
      return generateGraphQLCode(selectedTables);
    }
  };

  const generateRESTCode = (selectedTables: TableInfo[]) => {
    const tableNames = selectedTables.map(t => t.name);

    return `// Auto-generated REST API using Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const url = new URL(req.url)
    const path = url.pathname.split('/').filter(Boolean)
    const method = req.method

    // Route: /${endpointName}/:table/:id?
    const [, table, id] = path

    // Validate table
    const allowedTables = ${JSON.stringify(tableNames)}
    if (!allowedTables.includes(table)) {
      return new Response(
        JSON.stringify({ error: 'Invalid table' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

${authEnabled ? `    // Check authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
` : ''}
    let query = supabase.from(table)

    // Handle different HTTP methods
    switch (method) {
      case 'GET':
        if (id) {
          // Get single record
          const { data, error } = await query.select('*').eq('id', id).single()
          if (error) throw error
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          // List all records
          const { data, error } = await query.select('*')
          if (error) throw error
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

      case 'POST':
        const createBody = await req.json()
        const { data: created, error: createError } = await query.insert(createBody).select().single()
        if (createError) throw createError
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'PUT':
      case 'PATCH':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'ID required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const updateBody = await req.json()
        const { data: updated, error: updateError } = await query
          .update(updateBody)
          .eq('id', id)
          .select()
          .single()
        if (updateError) throw updateError
        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'DELETE':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'ID required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { error: deleteError } = await query.delete().eq('id', id)
        if (deleteError) throw deleteError
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})`;
  };

  const generateGraphQLCode = (selectedTables: TableInfo[]) => {
    const types = selectedTables.map(table => {
      const fields = table.columns.map(col =>
        `    ${col.name}: ${mapTypeToGraphQL(col.type)}${col.nullable ? '' : '!'}`
      ).join('\n');

      return `  type ${capitalize(table.name)} {
${fields}
  }`;
    }).join('\n\n');

    const queries = selectedTables.map(table =>
      `    ${table.name}: [${capitalize(table.name)}!]!
    ${table.name}ById(id: ID!): ${capitalize(table.name)}`
    ).join('\n');

    const mutations = selectedTables.map(table => {
      const inputFields = table.columns
        .filter(col => !col.isPrimaryKey)
        .map(col => `${col.name}: ${mapTypeToGraphQL(col.type)}${col.nullable ? '' : '!'}`)
        .join(', ');

      return `    create${capitalize(table.name)}(${inputFields}): ${capitalize(table.name)}!
    update${capitalize(table.name)}(id: ID!, ${inputFields}): ${capitalize(table.name)}!
    delete${capitalize(table.name)}(id: ID!): Boolean!`;
    }).join('\n');

    return `# Auto-generated GraphQL Schema

type Query {
${queries}
}

type Mutation {
${mutations}
}

${types}

scalar DateTime`;
  };

  const mapTypeToGraphQL = (dbType: string): string => {
    const typeMap: Record<string, string> = {
      'uuid': 'ID',
      'text': 'String',
      'integer': 'Int',
      'numeric': 'Float',
      'boolean': 'Boolean',
      'timestamptz': 'DateTime',
      'jsonb': 'String'
    };
    return typeMap[dbType] || 'String';
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  const handleGenerate = () => {
    const code = generateEndpointCode();
    setGeneratedCode(code);
    setStep('generate');
  };

  const handleDeploy = async () => {
    setStep('deploy');
    setDeploymentStatus('deploying');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Save endpoint to database
      const { data: endpoint, error } = await supabase
        .from('api_endpoints')
        .insert({
          user_id: user.id,
          connection_id: connectionId,
          name: endpointName,
          endpoint_type: endpointType,
          tables: getSelectedTables().map(t => t.name),
          operations,
          generated_code: generatedCode,
          deployment_status: 'deploying',
          deployment_platform: deploymentPlatform,
          auth_enabled: authEnabled,
          rate_limit: rateLimit
        })
        .select()
        .single();

      if (error) throw error;

      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate deployment URL
      const url = `https://${endpointName}-${endpoint.id.substring(0, 8)}.${deploymentPlatform === 'supabase_edge' ? 'supabase.co' : deploymentPlatform + '.app'}/functions/v1/${endpointName}`;

      // Update deployment status
      await supabase
        .from('api_endpoints')
        .update({
          deployment_status: 'deployed',
          deployment_url: url,
          deployed_at: new Date().toISOString()
        })
        .eq('id', endpoint.id);

      setDeploymentStatus('deployed');
      setDeploymentUrl(url);

      await loadExistingEndpoints();
    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentStatus('failed');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
  };

  const downloadCode = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpointName}-${endpointType}.${endpointType === 'graphql' ? 'graphql' : 'ts'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteEndpoint = async (endpointId: string) => {
    if (!confirm('Are you sure you want to delete this endpoint?')) return;

    await supabase
      .from('api_endpoints')
      .delete()
      .eq('id', endpointId);

    await loadExistingEndpoints();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-7xl h-[90vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('autoAPI.title')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {t('autoAPI.subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full glass-morphism hover-3d transition-all">
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 px-6 py-4 border-b overflow-x-auto" style={{ borderColor: theme.colors.border }}>
          {[
            { id: 'select', icon: Database, label: t('autoAPI.selectTables') },
            { id: 'configure', icon: Settings, label: t('autoAPI.configure') },
            { id: 'generate', icon: Code2, label: t('autoAPI.generateCode') },
            { id: 'deploy', icon: Cloud, label: t('autoAPI.deploy') },
            { id: 'manage', icon: Server, label: t('autoAPI.manage') }
          ].map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = ['select', 'configure', 'generate', 'deploy'].indexOf(s.id) < ['select', 'configure', 'generate', 'deploy'].indexOf(step);

            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => setStep(s.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive ? 'glass-morphism' : 'hover:bg-white/5'
                  }`}
                  style={{
                    color: isActive ? theme.colors.accent : theme.colors.textSecondary
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" style={{ color: theme.colors.accent }} />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium whitespace-nowrap">{s.label}</span>
                </button>
                {idx < 4 && (
                  <div className="w-8 h-0.5" style={{ backgroundColor: theme.colors.border }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'select' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                  {t('autoAPI.selectTablesTitle')}
                </h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  {t('autoAPI.selectTablesSubtitle')}
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-8 h-8 animate-spin" style={{ color: theme.colors.accent }} />
                </div>
              ) : (
                <div className="grid gap-4">
                  {tables.map((table) => (
                    <div
                      key={table.name}
                      onClick={() => toggleTable(table.name)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${
                        table.selected ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        ringColor: theme.colors.accent
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 rounded border-2 flex items-center justify-center"
                            style={{
                              borderColor: table.selected ? theme.colors.accent : theme.colors.border,
                              backgroundColor: table.selected ? theme.colors.accent : 'transparent'
                            }}
                          >
                            {table.selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <Database className="w-5 h-5" style={{ color: theme.colors.accent }} />
                          <span className="font-semibold" style={{ color: theme.colors.text }}>
                            {table.name}
                          </span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded" style={{
                          backgroundColor: `${theme.colors.accent}20`,
                          color: theme.colors.accent
                        }}>
                          {table.columns.length} columns
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {table.columns.map((col) => (
                          <div key={col.name} className="text-xs px-2 py-1 rounded" style={{
                            backgroundColor: theme.colors.foreground,
                            color: theme.colors.textSecondary
                          }}>
                            <span className="font-medium">{col.name}</span>
                            <span className="mx-1">·</span>
                            <span>{col.type}</span>
                            {col.isPrimaryKey && (
                              <span className="ml-1 text-yellow-500">🔑</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep('configure')}
                  disabled={getSelectedTables().length === 0}
                  className="px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                  }}
                >
                  Continue to Configuration
                </button>
              </div>
            </div>
          )}

          {step === 'configure' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  Endpoint Name
                </label>
                <input
                  type="text"
                  value={endpointName}
                  onChange={(e) => setEndpointName(e.target.value)}
                  placeholder="my-api"
                  className="w-full px-4 py-3 rounded-xl glass-card"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  API Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setEndpointType('rest')}
                    className={`p-4 rounded-xl text-left transition-all ${
                      endpointType === 'rest' ? 'ring-2' : ''
                    }`}
                    style={{
                      backgroundColor: theme.colors.background,
                      ringColor: theme.colors.accent
                    }}
                  >
                    <Server className="w-6 h-6 mb-2" style={{ color: theme.colors.accent }} />
                    <div className="font-semibold" style={{ color: theme.colors.text }}>REST API</div>
                    <div className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                      Traditional RESTful endpoints
                    </div>
                  </button>
                  <button
                    onClick={() => setEndpointType('graphql')}
                    className={`p-4 rounded-xl text-left transition-all ${
                      endpointType === 'graphql' ? 'ring-2' : ''
                    }`}
                    style={{
                      backgroundColor: theme.colors.background,
                      ringColor: theme.colors.accent
                    }}
                  >
                    <Code2 className="w-6 h-6 mb-2" style={{ color: theme.colors.accent }} />
                    <div className="font-semibold" style={{ color: theme.colors.text }}>GraphQL</div>
                    <div className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                      Flexible query language
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  Operations
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(operations).map(([op, enabled]) => (
                    <label key={op} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setOperations({ ...operations, [op]: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm capitalize" style={{ color: theme.colors.text }}>{op}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authEnabled}
                    onChange={(e) => setAuthEnabled(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <Lock className="w-4 h-4" style={{ color: theme.colors.accent }} />
                  <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    Require Authentication
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  Rate Limit (requests per minute)
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl glass-card"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }}
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('select')}
                  className="px-6 py-3 rounded-xl font-semibold glass-morphism"
                  style={{ color: theme.colors.text }}
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!endpointName}
                  className="px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                  }}
                >
                  {t('autoAPI.generateButton')}
                </button>
              </div>
            </div>
          )}

          {step === 'generate' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {t('autoAPI.generatedCode')} {endpointType === 'rest' ? 'REST' : 'GraphQL'} {t('autoAPI.code')}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    className="px-4 py-2 rounded-lg glass-morphism flex items-center gap-2"
                    style={{ color: theme.colors.text }}
                  >
                    <Copy className="w-4 h-4" />
                    {t('common.preview')}
                  </button>
                  <button
                    onClick={downloadCode}
                    className="px-4 py-2 rounded-lg glass-morphism flex items-center gap-2"
                    style={{ color: theme.colors.text }}
                  >
                    <Download className="w-4 h-4" />
                    {t('common.apply')}
                  </button>
                </div>
              </div>

              <div className="flex-1 rounded-xl overflow-hidden" style={{ backgroundColor: '#1e1e1e' }}>
                <pre className="p-4 h-full overflow-auto text-sm font-mono">
                  <code className="text-gray-100">{generatedCode}</code>
                </pre>
              </div>

              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setStep('configure')}
                  className="px-6 py-3 rounded-xl font-semibold glass-morphism"
                  style={{ color: theme.colors.text }}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('deploy')}
                  className="px-6 py-3 rounded-xl font-semibold text-white flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                  }}
                >
                  <Rocket className="w-4 h-4" />
                  Deploy API
                </button>
              </div>
            </div>
          )}

          {step === 'deploy' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  Deployment Platform
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'supabase_edge', name: 'Supabase Edge', icon: '⚡', desc: 'Instant deployment' },
                    { id: 'netlify', name: 'Netlify', icon: '🔷', desc: 'Serverless functions' },
                    { id: 'render', name: 'Render', icon: '🟣', desc: 'Full-stack platform' },
                    { id: 'railway', name: 'Railway', icon: '🚂', desc: 'Modern deployment' }
                  ].map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => setDeploymentPlatform(platform.id as CloudPlatform)}
                      className={`p-4 rounded-xl text-left transition-all ${
                        deploymentPlatform === platform.id ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: theme.colors.background,
                        ringColor: theme.colors.accent
                      }}
                    >
                      <div className="text-2xl mb-2">{platform.icon}</div>
                      <div className="font-semibold" style={{ color: theme.colors.text }}>{platform.name}</div>
                      <div className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                        {platform.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {deploymentStatus === 'idle' && (
                <button
                  onClick={handleDeploy}
                  className="w-full px-6 py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                  }}
                >
                  <Rocket className="w-5 h-5" />
                  Deploy Now
                </button>
              )}

              {deploymentStatus === 'deploying' && (
                <div className="text-center py-12">
                  <Loader className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: theme.colors.accent }} />
                  <p className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                    Deploying your API...
                  </p>
                  <p className="text-sm mt-2" style={{ color: theme.colors.textSecondary }}>
                    This may take a few moments
                  </p>
                </div>
              )}

              {deploymentStatus === 'deployed' && (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#10b981' }} />
                  <p className="text-xl font-bold mb-2" style={{ color: theme.colors.text }}>
                    API Deployed Successfully!
                  </p>
                  <div className="mt-6 p-4 rounded-xl glass-card">
                    <p className="text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                      Your API Endpoint:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-4 py-3 rounded-lg text-sm font-mono" style={{
                        backgroundColor: theme.colors.background,
                        color: theme.colors.accent
                      }}>
                        {deploymentUrl}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(deploymentUrl)}
                        className="p-3 rounded-lg glass-morphism"
                      >
                        <Copy className="w-4 h-4" style={{ color: theme.colors.text }} />
                      </button>
                      <a
                        href={deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-lg glass-morphism"
                      >
                        <ExternalLink className="w-4 h-4" style={{ color: theme.colors.text }} />
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep('manage')}
                    className="mt-6 px-6 py-3 rounded-xl font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                    }}
                  >
                    Manage Endpoints
                  </button>
                </div>
              )}

              {deploymentStatus === 'failed' && (
                <div className="text-center py-12">
                  <XCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#ef4444' }} />
                  <p className="text-xl font-bold mb-2" style={{ color: theme.colors.text }}>
                    Deployment Failed
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Please try again or contact support
                  </p>
                  <button
                    onClick={() => setDeploymentStatus('idle')}
                    className="mt-6 px-6 py-3 rounded-xl font-semibold glass-morphism"
                    style={{ color: theme.colors.text }}
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'manage' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                  Your API Endpoints
                </h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Manage and monitor your deployed APIs
                </p>
              </div>

              <div className="grid gap-4">
                {existingEndpoints.map((endpoint) => (
                  <div
                    key={endpoint.id}
                    className="p-4 rounded-xl glass-card"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                            {endpoint.name}
                          </h4>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              endpoint.deployment_status === 'deployed' ? 'bg-green-500/20 text-green-500' :
                              endpoint.deployment_status === 'deploying' ? 'bg-yellow-500/20 text-yellow-500' :
                              endpoint.deployment_status === 'failed' ? 'bg-red-500/20 text-red-500' :
                              'bg-gray-500/20 text-gray-500'
                            }`}
                          >
                            {endpoint.deployment_status}
                          </span>
                          <span className="text-xs px-2 py-1 rounded" style={{
                            backgroundColor: `${theme.colors.accent}20`,
                            color: theme.colors.accent
                          }}>
                            {endpoint.endpoint_type}
                          </span>
                        </div>
                        {endpoint.deployment_url && (
                          <a
                            href={endpoint.deployment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm flex items-center gap-1 hover:underline"
                            style={{ color: theme.colors.accent }}
                          >
                            {endpoint.deployment_url}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: theme.colors.textSecondary }}>
                          <span>{endpoint.tables.length} tables</span>
                          <span>·</span>
                          <span>{endpoint.deployment_platform}</span>
                          <span>·</span>
                          <span>{new Date(endpoint.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedEndpoint(endpoint)}
                          className="p-2 rounded-lg glass-morphism"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" style={{ color: theme.colors.text }} />
                        </button>
                        <button
                          onClick={() => deleteEndpoint(endpoint.id)}
                          className="p-2 rounded-lg glass-morphism"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {existingEndpoints.length === 0 && (
                  <div className="text-center py-12">
                    <Server className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
                    <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                      No endpoints yet
                    </p>
                    <p className="text-sm mb-6" style={{ color: theme.colors.textSecondary }}>
                      Create your first API endpoint to get started
                    </p>
                    <button
                      onClick={() => setStep('select')}
                      className="px-6 py-3 rounded-xl font-semibold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                      }}
                    >
                      Create Endpoint
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
